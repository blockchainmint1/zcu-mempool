// Discovers token contracts from Transfer logs and caches their metadata.
//
// The explorer needs name/symbol/decimals to render a token page, and those
// only exist on-chain behind eth_call. This loop finds contracts that have
// emitted a Transfer event but are not in token_meta yet, calls the four
// standard getters, and stores what came back.

import { pool } from "./db.js";
import { rpc } from "./rpc.js";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// keccak selectors for the ERC-20/721 metadata getters.
const SEL = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  supportsInterface721: "0x01ffc9a780ac58cd00000000000000000000000000000000000000000000000000000000",
} as const;

const MAX_ATTEMPTS = 5;

async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    return await rpc<string>("eth_call", [{ to, data }, "latest"]);
  } catch {
    return null;
  }
}

/** Decode an ABI-encoded string return value, tolerating bytes32-style tokens. */
function decodeString(hex: string | null): string | null {
  if (!hex || hex === "0x") return null;
  const body = hex.slice(2);

  // Dynamic string: offset, length, data.
  if (body.length >= 128) {
    const len = Number(BigInt("0x" + body.slice(64, 128)));
    if (len > 0 && len <= 1024 && body.length >= 128 + len * 2) {
      const bytes = Buffer.from(body.slice(128, 128 + len * 2), "hex");
      const s = bytes.toString("utf8").replace(/\u0000+$/, "").trim();
      if (s) return s;
    }
  }

  // bytes32 (older tokens like MKR return a fixed-width name).
  if (body.length === 64) {
    const s = Buffer.from(body, "hex").toString("utf8").replace(/\u0000+/g, "").trim();
    if (s) return s;
  }

  return null;
}

function decodeUint(hex: string | null): bigint | null {
  if (!hex || hex === "0x") return null;
  try {
    return BigInt(hex);
  } catch {
    return null;
  }
}

interface Discovered {
  address: string;
  firstBlock: number;
  hasTokenId: boolean;
}

async function findUncached(limit: number): Promise<Discovered[]> {
  const { rows } = await pool.query(
    `SELECT l.address,
            min(l.block_number)::bigint AS first_block,
            bool_or(l.topic3 IS NOT NULL) AS has_token_id
       FROM logs l
       LEFT JOIN token_meta m ON m.address = l.address
      WHERE l.topic0 = $1
        AND (m.address IS NULL OR (m.type = 'unknown' AND m.attempts < $3))
      GROUP BY l.address
      LIMIT $2`,
    [TRANSFER_TOPIC, limit, MAX_ATTEMPTS],
  );

  return rows.map((r: { address: string; first_block: number; has_token_id: boolean }) => ({
    address: r.address,
    firstBlock: Number(r.first_block),
    hasTokenId: r.has_token_id,
  }));
}

async function loadOne(t: Discovered): Promise<void> {
  const [nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all([
    ethCall(t.address, SEL.name),
    ethCall(t.address, SEL.symbol),
    ethCall(t.address, SEL.decimals),
    ethCall(t.address, SEL.totalSupply),
  ]);

  const decimals = decodeUint(decimalsHex);
  // An indexed tokenId in topic3 is the ERC-721 tell; a decimals() answer is
  // the ERC-20 tell. Prefer the log shape, which cannot be faked by a stub.
  const type = t.hasTokenId ? "erc721" : decimals != null ? "erc20" : "unknown";

  await pool.query(
    `INSERT INTO token_meta (address, type, name, symbol, decimals, total_supply,
                             first_seen_block, checked_at, attempts)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now(), 1)
     ON CONFLICT (address) DO UPDATE SET
       type = EXCLUDED.type,
       name = COALESCE(EXCLUDED.name, token_meta.name),
       symbol = COALESCE(EXCLUDED.symbol, token_meta.symbol),
       decimals = COALESCE(EXCLUDED.decimals, token_meta.decimals),
       total_supply = COALESCE(EXCLUDED.total_supply, token_meta.total_supply),
       checked_at = now(),
       attempts = token_meta.attempts + 1`,
    [
      t.address,
      type,
      decodeString(nameHex),
      decodeString(symbolHex),
      decimals != null && decimals <= 255n ? Number(decimals) : null,
      decodeUint(supplyHex)?.toString() ?? null,
      t.firstBlock,
    ],
  );
}

/** Fill metadata for newly seen tokens. Returns how many were processed. */
export async function refreshTokenMeta(limit = 25): Promise<number> {
  const pending = await findUncached(limit);
  for (const t of pending) {
    try {
      await loadOne(t);
    } catch (e) {
      console.error(`token meta ${t.address}: ${(e as Error).message}`);
    }
  }
  return pending.length;
}

/** Refresh totalSupply for known ERC-20s so a token page is not stale. */
export async function refreshTokenSupplies(limit = 25): Promise<number> {
  const { rows } = await pool.query(
    `SELECT address FROM token_meta
      WHERE type <> 'unknown'
      ORDER BY checked_at NULLS FIRST
      LIMIT $1`,
    [limit],
  );

  for (const r of rows as { address: string }[]) {
    const supply = decodeUint(await ethCall(r.address, SEL.totalSupply));
    await pool.query(
      `UPDATE token_meta SET total_supply = COALESCE($2, total_supply), checked_at = now()
        WHERE address = $1`,
      [r.address, supply?.toString() ?? null],
    );
  }

  return rows.length;
}
