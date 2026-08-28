// ZCU indexer entrypoint.
//
// Loop: check tip -> verify no reorg -> index the next batch -> repeat.
// When caught up, sleep POLL_MS. Balance refresh runs on its own cadence.

import { waitForDb, getIndexState, getStoredBlockHash, rollbackToHeight, pool } from "./db.js";
import { getTipHeight, getBlocks, RPC_URL, type RawBlock } from "./rpc.js";
import { indexRange } from "./index-range.js";
import { refreshBalances } from "./balances.js";
import { migrate } from "./migrate.js";
import { refreshTokenMeta, refreshTokenSupplies } from "./token-meta.js";

const BATCH_SIZE = Number(process.env["BATCH_SIZE"] ?? 50);
const POLL_MS = Number(process.env["POLL_MS"] ?? 5000);
const BALANCE_INTERVAL_MS = Number(process.env["BALANCE_INTERVAL_MS"] ?? 60_000);
const TOKEN_INTERVAL_MS = Number(process.env["TOKEN_INTERVAL_MS"] ?? 30_000);
// How far back to check for a reorg on each pass.
const REORG_DEPTH = Number(process.env["REORG_DEPTH"] ?? 12);

let stopping = false;

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/**
 * Walk backwards from the checkpoint until our stored hash matches the chain.
 * Returns the height we are safe to continue from.
 */
async function resolveReorg(lastIndexed: number): Promise<number> {
  if (lastIndexed < 0) return -1;

  const start = Math.max(0, lastIndexed - REORG_DEPTH);
  const heights: number[] = [];
  for (let h = lastIndexed; h >= start; h--) heights.push(h);

  const chain = await getBlocks(heights);

  for (let i = 0; i < heights.length; i++) {
    const height = heights[i]!;
    const onChain = chain[i] as RawBlock | null;
    if (!onChain) continue;
    const stored = await getStoredBlockHash(height);
    if (stored && stored === onChain.hash) {
      if (height !== lastIndexed) {
        log(`reorg detected: rolling back from ${lastIndexed} to ${height}`);
        await rollbackToHeight(height);
      }
      return height;
    }
  }

  // Divergence deeper than REORG_DEPTH — roll back the whole window and
  // let the normal loop re-index it.
  log(`deep reorg: rolling back to ${start}`);
  await rollbackToHeight(start);
  return start;
}

async function syncOnce(): Promise<boolean> {
  const tip = await getTipHeight();
  const state = await getIndexState();

  const safeHeight = await resolveReorg(state.lastIndexedBlock);
  const from = safeHeight + 1;

  if (from > tip) return false; // caught up

  const to = Math.min(tip, from + BATCH_SIZE - 1);
  const started = Date.now();
  const res = await indexRange(from, to);

  if (!res) {
    log(`no blocks returned for ${from}..${to}, will retry`);
    return false;
  }

  const lag = tip - res.indexedTo;
  log(
    `indexed ${from}..${res.indexedTo} ` +
      `(${res.blockCount} blocks, ${res.txCount} txs, ${res.logCount} logs) ` +
      `in ${Date.now() - started}ms  tip=${tip} lag=${lag}`,
  );

  return res.indexedTo < tip;
}

async function balanceLoop(): Promise<void> {
  while (!stopping) {
    try {
      const n = await refreshBalances();
      if (n > 0) log(`refreshed ${n} address balances`);
    } catch (e) {
      log(`balance refresh error: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, BALANCE_INTERVAL_MS));
  }
}

async function syncLoop(): Promise<void> {
  while (!stopping) {
    try {
      const more = await syncOnce();
      // Keep going immediately while backfilling; only sleep once caught up.
      if (!more) await new Promise((r) => setTimeout(r, POLL_MS));
    } catch (e) {
      log(`sync error: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
}

async function tokenLoop(): Promise<void> {
  while (!stopping) {
    try {
      const n = await refreshTokenMeta();
      if (n > 0) log(`loaded metadata for ${n} token contract(s)`);
      else await refreshTokenSupplies(10);
    } catch (e) {
      log(`token meta error: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, TOKEN_INTERVAL_MS));
  }
}

async function main(): Promise<void> {
  log(`ZCU indexer starting`);
  log(`rpc=${RPC_URL} batch=${BATCH_SIZE} poll=${POLL_MS}ms`);

  await waitForDb();
  log("database ready");

  await migrate();
  log("schema up to date");

  const state = await getIndexState();
  const tip = await getTipHeight();
  log(`checkpoint=${state.lastIndexedBlock} tip=${tip} (${tip - state.lastIndexedBlock} to go)`);

  void balanceLoop();
  void tokenLoop();
  await syncLoop();
}

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    log(`${sig} received, shutting down`);
    stopping = true;
    void pool.end().finally(() => process.exit(0));
  });
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});

