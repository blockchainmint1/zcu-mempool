// Read-only HTTP API over the ZCU index.
//
// Node's built-in http server — no framework. Every route is a plain SELECT;
// there are no writes here at all, which is the point: the explorer gets
// history without any path to mutate the index.

import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

pg.types.setTypeParser(1700, (v: string) => v); // numeric -> string (wei)
pg.types.setTypeParser(20, (v: string) => Number(v)); // int8 -> number

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  max: Number(process.env["PG_POOL_MAX"] ?? 10),
});

const PORT = Number(process.env["PORT"] ?? 8080);
const TOKEN = process.env["API_TOKEN"] ?? "";
const MAX_PAGE_SIZE = 100;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// ---------- helpers ----------

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function authorized(req: http.IncomingMessage): boolean {
  if (!TOKEN) return true; // no token configured: local/dev mode
  const header = req.headers["authorization"];
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(TOKEN);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

function intParam(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** 32-byte left-padded address, as it appears in a log topic. */
function topicForAddress(addr: string): string {
  return "0x" + "0".repeat(24) + addr.toLowerCase().slice(2);
}

// ---------- queries ----------

async function addressTxs(addr: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize;

  const [{ rows: countRows }, { rows }] = await Promise.all([
    pool.query<{ total: number }>(
      `SELECT count(*)::bigint AS total
         FROM transactions
        WHERE from_addr = $1 OR to_addr = $1`,
      [addr],
    ),
    pool.query(
      `SELECT hash, block_number, tx_index, from_addr, to_addr, value,
              gas, gas_used, gas_price, fee_wei, status, nonce,
              method_id, contract_address, timestamp
         FROM transactions
        WHERE from_addr = $1 OR to_addr = $1
        ORDER BY block_number DESC, tx_index DESC
        LIMIT $2 OFFSET $3`,
      [addr, pageSize, offset],
    ),
  ]);

  const total = countRows[0]?.total ?? 0;

  return {
    address: addr,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    transactions: rows.map((r) => ({
      hash: r.hash,
      blockNumber: r.block_number,
      transactionIndex: r.tx_index,
      from: r.from_addr,
      to: r.to_addr,
      value: r.value,
      gas: r.gas,
      gasUsed: r.gas_used,
      gasPrice: r.gas_price,
      fee: r.fee_wei,
      status: r.status,
      nonce: r.nonce,
      methodId: r.method_id,
      contractAddress: r.contract_address,
      timestamp: r.timestamp,
      direction: r.from_addr === addr ? ("out" as const) : ("in" as const),
    })),
  };
}

async function addressSummary(addr: string) {
  const { rows } = await pool.query(
    `SELECT address, first_seen_block, last_seen_block, tx_count,
            is_contract, balance_wei, balance_updated_at
       FROM addresses
      WHERE address = $1`,
    [addr],
  );
  const r = rows[0];
  if (!r) {
    return {
      address: addr,
      known: false,
      txCount: 0,
      isContract: false,
      firstSeenBlock: null,
      lastSeenBlock: null,
    };
  }
  return {
    address: r.address,
    known: true,
    txCount: r.tx_count,
    isContract: r.is_contract,
    balance: r.balance_wei,
    firstSeenBlock: r.first_seen_block,
    lastSeenBlock: r.last_seen_block,
    balanceUpdatedAt: r.balance_updated_at,
  };
}

async function addressTokenTransfers(addr: string, page: number, pageSize: number) {
  const topic = topicForAddress(addr);
  const offset = (page - 1) * pageSize;

  const [{ rows: countRows }, { rows }] = await Promise.all([
    pool.query<{ total: number }>(
      `SELECT count(*)::bigint AS total
         FROM logs
        WHERE topic0 = $1 AND (topic1 = $2 OR topic2 = $2)`,
      [TRANSFER_TOPIC, topic],
    ),
    pool.query(
      `SELECT tx_hash, block_number, log_index, address,
              topic1, topic2, topic3, data, timestamp
         FROM logs
        WHERE topic0 = $1 AND (topic1 = $2 OR topic2 = $2)
        ORDER BY block_number DESC, log_index DESC
        LIMIT $3 OFFSET $4`,
      [TRANSFER_TOPIC, topic, pageSize, offset],
    ),
  ]);

  const total = countRows[0]?.total ?? 0;

  return {
    address: addr,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    transfers: rows.map((r) => {
      const from = r.topic1 ? "0x" + String(r.topic1).slice(26) : null;
      const to = r.topic2 ? "0x" + String(r.topic2).slice(26) : null;
      // ERC-20 puts the amount in data; ERC-721 puts the tokenId in topic3.
      const isNft = r.topic3 != null;
      return {
        txHash: r.tx_hash,
        blockNumber: r.block_number,
        logIndex: r.log_index,
        token: r.address,
        from,
        to,
        value: isNft ? null : r.data && r.data !== "0x" ? BigInt(r.data).toString() : "0",
        tokenId: isNft ? BigInt(r.topic3).toString() : null,
        type: isNft ? ("erc721" as const) : ("erc20" as const),
        timestamp: r.timestamp,
        direction: from === addr ? ("out" as const) : ("in" as const),
      };
    }),
  };
}

async function richlist(limit: number, offset: number) {
  const [{ rows: totalRows }, { rows }] = await Promise.all([
    pool.query<{ supply: string }>(
      `SELECT COALESCE(sum(balance_wei), 0)::text AS supply FROM addresses`,
    ),
    pool.query(
      `SELECT address, balance_wei, tx_count, is_contract, first_seen_block
         FROM addresses
        WHERE balance_wei > 0
        ORDER BY balance_wei DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    ),
  ]);

  const indexedSupply = totalRows[0]?.supply ?? "0";
  const supply = BigInt(indexedSupply);

  return {
    indexedSupply,
    holders: rows.map((r, i) => {
      const bal = BigInt(r.balance_wei);
      return {
        rank: offset + i + 1,
        address: r.address,
        balance: r.balance_wei,
        // Share of indexed supply, in basis points, to avoid float drift.
        shareBps: supply > 0n ? Number((bal * 10_000n) / supply) : 0,
        txCount: r.tx_count,
        isContract: r.is_contract,
        firstSeenBlock: r.first_seen_block,
      };
    }),
  };
}

async function stats() {
  const { rows } = await pool.query(
    `SELECT
       (SELECT last_indexed_block FROM index_state WHERE id = 1) AS last_indexed_block,
       (SELECT count(*)::bigint FROM blocks)       AS block_count,
       (SELECT count(*)::bigint FROM transactions) AS tx_count,
       (SELECT count(*)::bigint FROM addresses)    AS address_count,
       (SELECT count(*)::bigint FROM logs)         AS log_count,
       (SELECT max(timestamp) FROM blocks)         AS latest_timestamp`,
  );
  const r = rows[0];
  return {
    lastIndexedBlock: r.last_indexed_block,
    blockCount: r.block_count,
    txCount: r.tx_count,
    addressCount: r.address_count,
    logCount: r.log_count,
    latestBlockTimestamp: r.latest_timestamp,
  };
}

// ---------- router ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  // Unauthenticated liveness probe for docker healthcheck.
  if (path === "/health") {
    try {
      await pool.query("SELECT 1");
      return json(res, 200, { ok: true });
    } catch {
      return json(res, 503, { ok: false });
    }
  }

  if (!authorized(req)) return json(res, 401, { error: "Unauthorized" });

  try {
    const page = intParam(url.searchParams.get("page"), 1, 1, 100_000);
    const pageSize = intParam(url.searchParams.get("pageSize"), 25, 1, MAX_PAGE_SIZE);

    if (path === "/stats") return json(res, 200, await stats());

    if (path === "/richlist") {
      const limit = intParam(url.searchParams.get("limit"), 100, 1, 500);
      const offset = intParam(url.searchParams.get("offset"), 0, 0, 1_000_000);
      return json(res, 200, await richlist(limit, offset));
    }

    const addrMatch = /^\/address\/(0x[0-9a-fA-F]{40})(\/txs|\/tokens)?$/.exec(path);
    if (addrMatch) {
      const addr = addrMatch[1]!.toLowerCase();
      if (!ADDRESS_RE.test(addr)) return json(res, 400, { error: "Invalid address" });

      const sub = addrMatch[2];
      if (sub === "/txs") return json(res, 200, await addressTxs(addr, page, pageSize));
      if (sub === "/tokens")
        return json(res, 200, await addressTokenTransfers(addr, page, pageSize));
      return json(res, 200, await addressSummary(addr));
    }

    return json(res, 404, { error: "Not found" });
  } catch (e) {
    console.error("request error:", e);
    return json(res, 500, { error: "Internal error" });
  }
});

server.listen(PORT, () => {
  console.log(`zcu-indexer-api listening on :${PORT} (auth ${TOKEN ? "on" : "OFF"})`);
});

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    server.close(() => void pool.end().finally(() => process.exit(0)));
  });
}
