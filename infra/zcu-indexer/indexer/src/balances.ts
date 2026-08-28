// Keeps the richlist honest.
//
// Balances are state, not history — they cannot be derived from indexed
// transactions alone (mining rewards, and later any internal transfers, move
// value without a top-level tx). So we periodically re-read them from the node
// for the addresses we know about, oldest-refreshed first.

import { pool } from "./db.js";
import { getBalances } from "./rpc.js";

const BATCH = Number(process.env["BALANCE_BATCH"] ?? 200);

/**
 * Refresh the least-recently-updated addresses. Returns how many were updated.
 */
export async function refreshBalances(limit = BATCH): Promise<number> {
  const { rows } = await pool.query<{ address: string }>(
    `SELECT address
       FROM addresses
      ORDER BY balance_updated_at ASC NULLS FIRST
      LIMIT $1`,
    [limit],
  );
  if (rows.length === 0) return 0;

  const addresses = rows.map((r) => r.address);
  const balances = await getBalances(addresses);

  const updates: Array<[string, string]> = [];
  addresses.forEach((a, i) => {
    const hex = balances[i];
    if (hex != null) updates.push([a, BigInt(hex).toString()]);
  });
  if (updates.length === 0) return 0;

  // Single round-trip using unnest instead of N updates.
  await pool.query(
    `UPDATE addresses AS a
        SET balance_wei = v.balance::numeric,
            balance_updated_at = now()
       FROM (SELECT unnest($1::text[]) AS address, unnest($2::text[]) AS balance) AS v
      WHERE a.address = v.address`,
    [updates.map((u) => u[0]), updates.map((u) => u[1])],
  );

  return updates.length;
}
