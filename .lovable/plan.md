# ZCU Explorer Indexer Plan

## What we found

The ZCU chain is extremely small:
- 26,355 blocks total
- **4 transactions** in the entire chain history
- 5 unique addresses
- 0 contract deployments, 0 event logs
- `eth_getLogs` works (for future token transfers)
- `trace_*` methods are NOT available (no native "txs by address" lookup)

Because there is no trace API and geth can't list transactions by address, address
history and richlist **require an indexer**. But the chain is so small that a full
sync is near-instant.

## Architecture: in-app indexer backed by Lovable Cloud

No separate indexer box. The app itself owns the index:

```
ZCU geth node (RPC)
      │
      ▼
Indexer server fn (batch: fetch N blocks → store txs + logs + addresses)
      │  triggered by cron endpoint /api/public/index
      ▼
Lovable Cloud Postgres
  - transactions table (from, to, value, block, status, fee, …)
  - logs table (address, topics, data — for token transfers)
  - tracked_addresses table (every address that ever sent/received/mined)
      │
      ▼
API routes read from DB for history/richlist, RPC for live balance/nonce
```

## Why this works here

- Full chain sync = 26k blocks × near-zero txs = finishes in one batch run
- Ongoing: ~1 new block every 4 min, near-zero txs → indexer stays current with a
  cron tick every few minutes
- Lovable Cloud Postgres is included, zero external setup
- The Worker runtime can't run a long-lived process, but a batch server fn that
  indexes 200 blocks per invocation finishes well within limits

## Step 1 — Enable Lovable Cloud

Enables Postgres + server functions. One action, no external accounts.

## Step 2 — Database migration

Tables (all in `public` schema, with RLS disabled for public reads via service-role
writes):

- `indexed_txs` — one row per transaction: hash, block_number, block_hash, from, to,
  value, gas, gas_price, fee_wei, status, nonce, input, method_id, contract_address,
  timestamp, tx_index
- `indexed_logs` — one row per log: tx_hash, block_number, address, topic0..3, data,
  log_index, timestamp
- `tracked_addresses` — address, first_seen_block, last_seen_block, is_contract,
  cached_balance_wei, balance_updated_at
- `index_state` — single row tracking `last_indexed_block`

## Step 3 — Indexer server function

`src/lib/zcu/indexer.functions.ts`:

1. Read `index_state.last_indexed_block`
2. Fetch next batch (e.g. 250 blocks) via `eth_getBlockByNumber` with full txs
3. For each block: insert txs, fetch + insert receipts/logs, track addresses
4. Update `index_state`
5. Return `{ indexed_to: N, new_txs: M }`

Called from a cron endpoint `src/routes/api/public/index.ts` (public, secured by a
bearer secret) so it can be triggered by a scheduler.

## Step 4 — Richlist balance refresh

A companion server fn that iterates `tracked_addresses`, calls `eth_getBalance` for
each, and updates `cached_balance_wei`. With ~5–50 addresses this is one batch RPC
call. Richlist = `ORDER BY cached_balance_wei DESC`.

## Step 5 — Enhanced API routes

- `/api/v1/address/$addr` — add `transactions[]` from `indexed_txs` (paginated)
- `/api/v1/address/$addr/tokens` — token transfers from `indexed_logs`
- `/api/v1/richlist` — top N by cached balance
- Keep live balance/nonce from RPC for the "current state" card

## Step 6 — Frontend

- Address page: show transaction history table (was a "needs indexer" placeholder)
- Restore `/richlist` route with a top-holders table
- Mining page already works from RPC; no change

## What this does NOT do

- No separate server/box to provision or maintain
- No long-running process — cron triggers short batch runs
- Token transfers page stays minimal until contracts exist on chain (none today)

## Cron

After publish, set a cron to hit `https://<project>.lovable.app/api/public/index`
every 5 minutes with the bearer secret. Exact `curl` command provided when ready.
