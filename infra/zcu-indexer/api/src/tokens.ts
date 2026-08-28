// Token queries.
//
// Holder balances are computed from Transfer logs rather than stored, so they
// stay correct through reorgs (rolled-back blocks cascade their logs away).
// At ZCU's current volume this is a millisecond-scale aggregation; the
// MAX_TRANSFERS cap keeps it bounded if a token ever gets very busy.

import type pg from "pg";

export const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const MAX_TRANSFERS = 200_000;
const ZERO = "0x0000000000000000000000000000000000000000";

type Pool = pg.Pool;

function addrFromTopic(t: string | null): string | null {
  return t ? "0x" + String(t).slice(26).toLowerCase() : null;
}

function amountOf(data: string | null): bigint {
  if (!data || data === "0x") return 0n;
  try {
    return BigInt(data);
  } catch {
    return 0n;
  }
}

interface MetaRow {
  address: string;
  type: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  total_supply: string | null;
  first_seen_block: number | null;
}

function shapeMeta(r: MetaRow | undefined, address: string) {
  return {
    address,
    type: (r?.type ?? "unknown") as "erc20" | "erc721" | "unknown",
    name: r?.name ?? null,
    symbol: r?.symbol ?? null,
    decimals: r?.decimals ?? null,
    totalSupply: r?.total_supply ?? null,
    firstSeenBlock: r?.first_seen_block ?? null,
  };
}

export async function tokenList(pool: Pool, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;

  const [{ rows: countRows }, { rows }] = await Promise.all([
    pool.query<{ total: number }>(
      `SELECT count(DISTINCT address)::bigint AS total FROM logs WHERE topic0 = $1`,
      [TRANSFER_TOPIC],
    ),
    pool.query(
      `SELECT l.address,
              count(*)::bigint                       AS transfer_count,
              min(l.block_number)::bigint            AS first_block,
              max(l.block_number)::bigint            AS last_block,
              max(l.timestamp)::bigint               AS last_timestamp,
              m.type, m.name, m.symbol, m.decimals, m.total_supply, m.first_seen_block
         FROM logs l
         LEFT JOIN token_meta m ON m.address = l.address
        WHERE l.topic0 = $1
        GROUP BY l.address, m.type, m.name, m.symbol, m.decimals,
                 m.total_supply, m.first_seen_block
        ORDER BY transfer_count DESC, l.address
        LIMIT $2 OFFSET $3`,
      [TRANSFER_TOPIC, pageSize, offset],
    ),
  ]);

  const total = countRows[0]?.total ?? 0;

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    tokens: rows.map((r) => ({
      ...shapeMeta(r as MetaRow, r.address),
      transferCount: Number(r.transfer_count),
      firstBlock: Number(r.first_block),
      lastBlock: Number(r.last_block),
      lastTransferAt: Number(r.last_timestamp),
    })),
  };
}

/** Full holder set for a token, derived from its transfer log. */
async function computeHolders(pool: Pool, token: string, isNft: boolean) {
  const { rows } = await pool.query(
    `SELECT topic1, topic2, topic3, data
       FROM logs
      WHERE topic0 = $1 AND address = $2
      ORDER BY block_number ASC, log_index ASC
      LIMIT $3`,
    [TRANSFER_TOPIC, token, MAX_TRANSFERS],
  );

  const balances = new Map<string, bigint>();
  const add = (a: string | null, delta: bigint) => {
    if (!a || a === ZERO) return;
    balances.set(a, (balances.get(a) ?? 0n) + delta);
  };

  for (const r of rows) {
    const from = addrFromTopic(r.topic1);
    const to = addrFromTopic(r.topic2);
    // ERC-721 moves exactly one token per event; ERC-20 moves `data` units.
    const amount = isNft ? 1n : amountOf(r.data);
    add(from, -amount);
    add(to, amount);
  }

  const holders = [...balances.entries()]
    .filter(([, v]) => v > 0n)
    .sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1));

  return { holders, transfersScanned: rows.length, truncated: rows.length >= MAX_TRANSFERS };
}

async function metaOf(pool: Pool, token: string): Promise<MetaRow | undefined> {
  const { rows } = await pool.query<MetaRow>(
    `SELECT address, type, name, symbol, decimals, total_supply, first_seen_block
       FROM token_meta WHERE address = $1`,
    [token],
  );
  return rows[0];
}

export async function tokenSummary(pool: Pool, token: string) {
  const [meta, { rows: agg }] = await Promise.all([
    metaOf(pool, token),
    pool.query(
      `SELECT count(*)::bigint AS transfer_count,
              min(block_number)::bigint AS first_block,
              max(block_number)::bigint AS last_block,
              max(timestamp)::bigint AS last_timestamp
         FROM logs WHERE topic0 = $1 AND address = $2`,
      [TRANSFER_TOPIC, token],
    ),
  ]);

  const a = agg[0];
  const transferCount = Number(a?.transfer_count ?? 0);
  if (transferCount === 0 && !meta) return null;

  const isNft = (meta?.type ?? "") === "erc721";
  const { holders, truncated } = await computeHolders(pool, token, isNft);

  return {
    ...shapeMeta(meta, token),
    transferCount,
    holderCount: holders.length,
    firstBlock: a?.first_block != null ? Number(a.first_block) : null,
    lastBlock: a?.last_block != null ? Number(a.last_block) : null,
    lastTransferAt: a?.last_timestamp != null ? Number(a.last_timestamp) : null,
    holdersTruncated: truncated,
  };
}

export async function tokenHolders(pool: Pool, token: string, limit: number, offset: number) {
  const meta = await metaOf(pool, token);
  const isNft = (meta?.type ?? "") === "erc721";
  const { holders, truncated } = await computeHolders(pool, token, isNft);

  const supply = holders.reduce((s, [, v]) => s + v, 0n);
  const page = holders.slice(offset, offset + limit);

  return {
    ...shapeMeta(meta, token),
    holderCount: holders.length,
    circulating: supply.toString(),
    truncated,
    holders: page.map(([address, balance], i) => ({
      rank: offset + i + 1,
      address,
      balance: balance.toString(),
      shareBps: supply > 0n ? Number((balance * 10_000n) / supply) : 0,
    })),
  };
}

export async function tokenTransfers(pool: Pool, token: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;

  const [{ rows: countRows }, { rows }] = await Promise.all([
    pool.query<{ total: number }>(
      `SELECT count(*)::bigint AS total FROM logs WHERE topic0 = $1 AND address = $2`,
      [TRANSFER_TOPIC, token],
    ),
    pool.query(
      `SELECT tx_hash, block_number, log_index, topic1, topic2, topic3, data, timestamp
         FROM logs
        WHERE topic0 = $1 AND address = $2
        ORDER BY block_number DESC, log_index DESC
        LIMIT $3 OFFSET $4`,
      [TRANSFER_TOPIC, token, pageSize, offset],
    ),
  ]);

  const total = countRows[0]?.total ?? 0;

  return {
    token,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    transfers: rows.map((r) => {
      const isNft = r.topic3 != null;
      return {
        txHash: r.tx_hash,
        blockNumber: r.block_number,
        logIndex: r.log_index,
        from: addrFromTopic(r.topic1),
        to: addrFromTopic(r.topic2),
        value: isNft ? null : amountOf(r.data).toString(),
        tokenId: isNft ? BigInt(r.topic3).toString() : null,
        type: isNft ? ("erc721" as const) : ("erc20" as const),
        timestamp: r.timestamp,
      };
    }),
  };
}

/** ERC-20/721 positions held by one address, with token metadata attached. */
export async function addressTokenBalances(pool: Pool, addr: string) {
  const topic = "0x" + "0".repeat(24) + addr.slice(2);

  const { rows: tokenRows } = await pool.query(
    `SELECT DISTINCT address FROM logs
      WHERE topic0 = $1 AND (topic1 = $2 OR topic2 = $2)
      LIMIT 200`,
    [TRANSFER_TOPIC, topic],
  );

  const out = [];
  for (const t of tokenRows as { address: string }[]) {
    const meta = await metaOf(pool, t.address);
    const isNft = (meta?.type ?? "") === "erc721";
    const { holders } = await computeHolders(pool, t.address, isNft);
    const entry = holders.find(([a]) => a === addr);
    if (!entry) continue;
    out.push({ ...shapeMeta(meta, t.address), balance: entry[1].toString() });
  }

  return { address: addr, positions: out };
}
