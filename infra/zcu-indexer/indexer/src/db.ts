// Postgres access for the indexer. One pool, explicit transactions around
// each indexed batch so a crash can never leave a half-written block.

import pg from "pg";

const { Pool } = pg;

// NUMERIC(78,0) comes back as a string by default in node-postgres, which is
// exactly what we want for wei values — do not let it become a float.
pg.types.setTypeParser(1700, (v: string) => v);
// int8 -> number (safe: heights/timestamps/counts are well under 2^53)
pg.types.setTypeParser(20, (v: string) => Number(v));

export const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  max: Number(process.env["PG_POOL_MAX"] ?? 8),
});

export type Client = pg.PoolClient;

export async function withTransaction<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function waitForDb(attempts = 30): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (e) {
      if (i === attempts) throw e;
      console.log(`[db] not ready (attempt ${i}/${attempts}), retrying in 2s`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

export interface IndexState {
  lastIndexedBlock: number;
  lastIndexedHash: string | null;
}

export async function getIndexState(): Promise<IndexState> {
  const { rows } = await pool.query(
    "SELECT last_indexed_block, last_indexed_hash FROM index_state WHERE id = 1",
  );
  const r = rows[0];
  return {
    lastIndexedBlock: r ? Number(r.last_indexed_block) : -1,
    lastIndexedHash: r?.last_indexed_hash ?? null,
  };
}

export async function setIndexState(c: Client, height: number, hash: string): Promise<void> {
  await c.query(
    `UPDATE index_state
        SET last_indexed_block = $1, last_indexed_hash = $2, updated_at = now()
      WHERE id = 1`,
    [height, hash],
  );
}

/** Hash we have stored for a height, or null if we never indexed it. */
export async function getStoredBlockHash(height: number): Promise<string | null> {
  const { rows } = await pool.query("SELECT hash FROM blocks WHERE number = $1", [height]);
  return rows[0]?.hash ?? null;
}

/**
 * Reorg rollback. blocks has ON DELETE CASCADE from transactions and logs,
 * so removing the blocks removes their children too.
 */
export async function rollbackToHeight(height: number): Promise<void> {
  await withTransaction(async (c) => {
    await c.query("DELETE FROM blocks WHERE number > $1", [height]);
    const { rows } = await c.query("SELECT hash FROM blocks WHERE number = $1", [height]);
    await c.query(
      `UPDATE index_state
          SET last_indexed_block = $1, last_indexed_hash = $2, updated_at = now()
        WHERE id = 1`,
      [height, rows[0]?.hash ?? null],
    );
  });
}
