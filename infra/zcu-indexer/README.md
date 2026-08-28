# ZCU Indexer

Dedicated indexing box for the Zero Chill Units explorer.

The explorer reads live state (chain tip, balances, gas price, txpool) straight
from the ZCU node. But geth cannot answer "what has this address done", and the
node exposes no `trace_*` API — so address history, token transfers and the
richlist need an index. That is what this box builds.

## What runs here

| Service    | Purpose                                                   |
|------------|-----------------------------------------------------------|
| `postgres` | Stores blocks, transactions, logs and address rows        |
| `indexer`  | Follows the chain tip, writes rows, handles reorgs        |
| `api`      | Read-only JSON API the explorer calls (bearer-token auth) |
| `nginx`    | TLS termination on `indexer-zcu.honest.money`             |

Everything is Docker Compose with `restart: unless-stopped`, and Docker itself
is enabled as a systemd service — so the whole stack comes back on its own
after a reboot.

---

## Setting up a new box

### Step 1 — Launch the EC2 instance

In the AWS console, **EC2 → Instances → Launch instances**:

| Setting        | Value                          |
|----------------|--------------------------------|
| Name           | `zcu_indexer`                  |
| AMI            | Ubuntu Server 24.04 LTS        |
| Instance type  | `t3.small`                     |
| Key pair       | your existing key              |
| Storage        | 30 GiB, gp3                    |

Under **Network settings → Create security group**, add these inbound rules:

| Type       | Port | Source                    |
|------------|------|---------------------------|
| SSH        | 22   | My IP                     |
| HTTP       | 80   | Anywhere (0.0.0.0/0)      |
| HTTPS      | 443  | Anywhere (0.0.0.0/0)      |

Port 80 is needed for the TLS certificate challenge. Postgres is **not**
exposed — it only listens inside the Docker network.

Then **Elastic IPs → Allocate** and associate the new address with this
instance, so the IP survives a stop/start.

### Step 2 — Point DNS at it

Add an **A record**:

```
indexer-zcu.honest.money  →  <the elastic IP>
```

Wait a couple of minutes before continuing.

### Step 3 — Connect and install

SSH into the box, then become root:

```bash
sudo -i
```

Clone the repo and run the installer:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/OWNER/REPO.git /opt/zcu-mempool
bash /opt/zcu-mempool/infra/zcu-indexer/install.sh
```

Replace `OWNER/REPO` with the actual repository. The installer prints an **API
token** at the end — copy it, you need it in step 6.

### Step 4 — Get the TLS certificate

```bash
bash /opt/zcu-indexer/certbot.sh
```

This checks DNS first and refuses to continue if the record is not live yet,
so it cannot burn a Let's Encrypt rate limit on a typo.

### Step 5 — Start everything

```bash
bash /opt/zcu-indexer/deploy.sh
```

It builds the images, starts the stack, waits for the API to answer, then tails
the indexer log. You should see the backfill run through the chain in seconds:

```
indexed 0..49 (50 blocks, 0 txs, 0 logs) in 340ms  tip=26400 lag=26350
indexed 50..99 ...
```

Press `Ctrl-C` once `lag=0` — the indexer keeps running in the background.

### Step 6 — Connect the explorer

In the Lovable project, add two secrets:

| Secret               | Value                                      |
|----------------------|--------------------------------------------|
| `ZCU_INDEXER_URL`    | `https://indexer-zcu.honest.money`         |
| `ZCU_INDEXER_TOKEN`  | the token the installer printed            |

Then publish the app. Address history and the richlist go live immediately.

---

## Day-to-day

**Deploy a code change** (after it's merged):

```bash
sudo bash /opt/zcu-indexer/deploy.sh
```

**Check status:**

```bash
cd /opt/zcu-indexer && docker compose ps
```

**Watch the indexer:**

```bash
cd /opt/zcu-indexer && docker compose logs -f --tail=50 indexer
```

**Check how far along it is** (run this from anywhere, with your token):

```bash
curl -s -H "Authorization: Bearer YOUR_TOKEN" \
  https://indexer-zcu.honest.money/stats
```

**Restart just one service:**

```bash
cd /opt/zcu-indexer && docker compose restart indexer
```

**Re-index from scratch** (only if the index is corrupt — it rebuilds in
seconds at current chain size):

```bash
cd /opt/zcu-indexer
docker compose stop indexer
docker compose exec -T postgres psql -U zcu -d zcu_index -c \
  "TRUNCATE blocks, logs, transactions, addresses; UPDATE index_state SET last_indexed_block = -1, last_indexed_hash = NULL;"
docker compose start indexer
```

---

## API reference

All endpoints require `Authorization: Bearer <API_TOKEN>` except `/health`.

| Endpoint                        | Returns                                     |
|---------------------------------|---------------------------------------------|
| `GET /health`                   | Liveness probe                              |
| `GET /stats`                    | Index progress and row counts               |
| `GET /address/:addr`            | Summary: tx count, contract flag, balance   |
| `GET /address/:addr/txs`        | Paginated transaction history               |
| `GET /address/:addr/tokens`     | Paginated ERC-20/721 transfers              |
| `GET /richlist`                 | Top holders by balance                      |

Pagination: `?page=1&pageSize=25` (max 100). Richlist uses
`?limit=100&offset=0` (max 500).

---

## Design notes

**Reorg safety.** Every pass re-checks the last `REORG_DEPTH` (default 12)
blocks against the chain before extending. If a stored hash no longer matches,
the indexer rolls back to the last agreeing height and re-indexes forward.
`blocks` cascades to `transactions` and `logs`, so a rollback is a single
`DELETE`.

**Atomic checkpoints.** A batch's blocks, transactions, logs, address rows and
the `index_state` checkpoint all land in one Postgres transaction. The
checkpoint can never be ahead of the data it claims to describe, so a crash at
any moment resumes cleanly.

**Balances are read, not derived.** Mining rewards move value without a
top-level transaction, so balances cannot be summed from indexed transfers. The
indexer re-reads them from the node on a rolling basis, oldest first.

**Wei never touches a float.** Values are `NUMERIC(78,0)` in Postgres and
strings in JS, parsed with `BigInt`. `pg` is configured to hand back numerics
as strings specifically to prevent silent precision loss.

**The API cannot write.** It is a separate service with only `SELECT` queries.
Even a leaked token cannot alter the index — worst case is rate-limited reads.
