# ZCU Explorer — Dedicated Indexer Box

## Why a box

The chain is tiny today (26,355 blocks, 4 transactions, 5 addresses, no contracts),
but it's brand new and will get real usage. A dedicated indexer box means the
explorer never has to be re-architected when volume arrives — it scales from 4 txs
to millions on the same design.

`trace_*` RPC methods are not available on the node, and geth cannot list
transactions by address, so an indexer is the only way to serve address history,
token transfers and a richlist.

## Architecture

```
ZCU geth node (node-zcu.honest.money)
        │  JSON-RPC
        ▼
┌─────────────────────────────────────────┐
│  INDEXER BOX  (new EC2, t3.small)       │
│                                         │
│  postgres        ← indexed chain data   │
│  zcu-indexer     ← follows chain tip    │
│  zcu-api         ← read-only JSON API   │
│  nginx + certbot ← TLS termination      │
└─────────────────────────────────────────┘
        │  https://indexer-zcu.honest.money
        ▼
Lovable explorer /api/v1/* routes
        │
        ▼
Address history · Token transfers · Richlist
```

The explorer keeps reading the geth node directly for live data (tip, gas price,
txpool, block details). It only calls the indexer for the things that require
history.

## The box

- New EC2 instance, **t3.small** (2 vCPU / 2 GB) — plenty for this chain, roughly
  $15/mo. Can resize later without redesign.
- 30 GB gp3 disk
- Ubuntu 24.04
- Security group: SSH (22) from your IP, HTTPS (443) open
- DNS: `indexer-zcu.honest.money` → the box's elastic IP

Everything runs in Docker Compose, same pattern as the TXC stack, so it's familiar
and restarts on boot automatically.

## Services on the box

**postgres** — stores the index. Tables:
- `blocks` — height, hash, miner, timestamp, difficulty, gas, tx_count, size
- `transactions` — hash, block, from, to, value, gas, gas_price, fee, status, nonce,
  input, method_id, contract_address, timestamp
- `logs` — tx_hash, block, address, topic0..3, data, log_index (token transfers)
- `addresses` — address, first_seen, last_seen, tx_count, is_contract, balance_wei
- `index_state` — last_indexed_block, reorg-safe checkpoint

**zcu-indexer** — a small Node service that:
1. Reads `last_indexed_block`
2. Batch-fetches the next blocks over JSON-RPC (full txs + receipts)
3. Writes blocks, txs, logs, and address rows in one transaction
4. Handles reorgs by comparing parent hashes and rolling back if needed
5. Refreshes address balances for the richlist
6. Sleeps briefly and repeats — always following the tip

Initial backfill of 26k blocks finishes in well under a minute.

**zcu-api** — read-only HTTP API the explorer calls:
- `GET /address/:addr/txs?page=` — address transaction history
- `GET /address/:addr/tokens` — token transfers for an address
- `GET /richlist?limit=` — top holders by balance
- `GET /stats` — total txs, total addresses, indexer lag
- Protected by a bearer token so only the explorer can call it

**nginx + certbot** — TLS on `indexer-zcu.honest.money`.

## Explorer changes (this repo)

- New `src/lib/zcu/indexer.ts` — server-side client for the indexer API, reading the
  base URL and bearer token from secrets
- `/api/v1/address/$addr` — add paginated `transactions[]`
- New `/api/v1/address/$addr/tokens` route
- New `/api/v1/richlist` route
- Address page: real transaction history table replacing the "needs indexer" notice
- Restore `/richlist` route with a top-holders table
- Graceful degradation: if the indexer is unreachable, pages still render live RPC
  data and show a small "history temporarily unavailable" note

Two secrets to add: `ZCU_INDEXER_URL` and `ZCU_INDEXER_TOKEN`.

## What I'll hand you

Since you'll be doing the server side, you get **exact copy/paste commands** for
every step, in order, with prerequisites spelled out:

1. Launching the EC2 instance and security group (console clicks, described)
2. The DNS record to add
3. One block to paste that installs Docker
4. One block to paste that creates the whole stack (compose file, indexer, API,
   nginx config, schema) — written into a git repo so updates are a `git pull`
5. One block to issue the TLS certificate
6. One block to start it and watch the backfill
7. A verification command that proves the API is answering

Nothing will require you to hand-edit a config file in a terminal editor.

## Order of work

1. You launch the box + add DNS (I give you the exact settings)
2. I write the indexer stack into this repo under `infra/zcu-indexer/`
3. You paste the install commands
4. I wire the explorer up to the indexer and add the secrets
5. We verify address history and richlist end to end
6. Retire `scan.zerochill.com`
