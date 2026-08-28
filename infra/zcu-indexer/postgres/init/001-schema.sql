-- ZCU indexer schema.
-- Applied automatically by postgres on first boot (docker-entrypoint-initdb.d).

CREATE TABLE IF NOT EXISTS blocks (
  number          BIGINT PRIMARY KEY,
  hash            TEXT NOT NULL UNIQUE,
  parent_hash     TEXT NOT NULL,
  timestamp       BIGINT NOT NULL,
  miner           TEXT NOT NULL,
  difficulty      NUMERIC(78,0) NOT NULL,
  total_difficulty NUMERIC(78,0),
  gas_used        BIGINT NOT NULL,
  gas_limit       BIGINT NOT NULL,
  base_fee_per_gas NUMERIC(78,0),
  size            BIGINT NOT NULL,
  tx_count        INT NOT NULL DEFAULT 0,
  fees_wei        NUMERIC(78,0) NOT NULL DEFAULT 0,
  extra_data      TEXT,
  nonce           TEXT,
  state_root      TEXT
);

CREATE INDEX IF NOT EXISTS blocks_timestamp_idx ON blocks (timestamp DESC);
CREATE INDEX IF NOT EXISTS blocks_miner_idx     ON blocks (miner);

CREATE TABLE IF NOT EXISTS transactions (
  hash             TEXT PRIMARY KEY,
  block_number     BIGINT NOT NULL REFERENCES blocks(number) ON DELETE CASCADE,
  block_hash       TEXT NOT NULL,
  tx_index         INT NOT NULL,
  from_addr        TEXT NOT NULL,
  to_addr          TEXT,
  value            NUMERIC(78,0) NOT NULL,
  gas              BIGINT NOT NULL,
  gas_used         BIGINT,
  gas_price        NUMERIC(78,0) NOT NULL,
  max_fee_per_gas  NUMERIC(78,0),
  max_priority_fee_per_gas NUMERIC(78,0),
  fee_wei          NUMERIC(78,0),
  status           SMALLINT,
  nonce            BIGINT NOT NULL,
  input            TEXT,
  method_id        TEXT,
  contract_address TEXT,
  timestamp        BIGINT NOT NULL
);

-- The two hot paths for address history. Partial-free composite indexes so
-- "txs for this address, newest first" is a single index scan either way.
CREATE INDEX IF NOT EXISTS tx_from_time_idx  ON transactions (from_addr, block_number DESC, tx_index DESC);
CREATE INDEX IF NOT EXISTS tx_to_time_idx    ON transactions (to_addr,   block_number DESC, tx_index DESC);
CREATE INDEX IF NOT EXISTS tx_block_idx      ON transactions (block_number DESC, tx_index ASC);
CREATE INDEX IF NOT EXISTS tx_timestamp_idx  ON transactions (timestamp DESC);

CREATE TABLE IF NOT EXISTS logs (
  id           BIGSERIAL PRIMARY KEY,
  tx_hash      TEXT NOT NULL,
  block_number BIGINT NOT NULL REFERENCES blocks(number) ON DELETE CASCADE,
  log_index    INT NOT NULL,
  address      TEXT NOT NULL,
  topic0       TEXT,
  topic1       TEXT,
  topic2       TEXT,
  topic3       TEXT,
  data         TEXT,
  timestamp    BIGINT NOT NULL,
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS logs_address_idx ON logs (address, block_number DESC);
CREATE INDEX IF NOT EXISTS logs_topic0_idx  ON logs (topic0, block_number DESC);
-- ERC-20/721 Transfer: topic1 = from, topic2 = to (32-byte padded addresses).
CREATE INDEX IF NOT EXISTS logs_topic1_idx  ON logs (topic1, block_number DESC);
CREATE INDEX IF NOT EXISTS logs_topic2_idx  ON logs (topic2, block_number DESC);

CREATE TABLE IF NOT EXISTS addresses (
  address           TEXT PRIMARY KEY,
  first_seen_block  BIGINT NOT NULL,
  last_seen_block   BIGINT NOT NULL,
  tx_count          BIGINT NOT NULL DEFAULT 0,
  is_contract       BOOLEAN NOT NULL DEFAULT FALSE,
  balance_wei       NUMERIC(78,0) NOT NULL DEFAULT 0,
  balance_updated_at TIMESTAMPTZ
);

-- Richlist ordering.
CREATE INDEX IF NOT EXISTS addresses_balance_idx ON addresses (balance_wei DESC);
CREATE INDEX IF NOT EXISTS addresses_stale_idx   ON addresses (balance_updated_at NULLS FIRST);

-- Single-row checkpoint table.
CREATE TABLE IF NOT EXISTS index_state (
  id                 INT PRIMARY KEY DEFAULT 1,
  last_indexed_block BIGINT NOT NULL DEFAULT -1,
  last_indexed_hash  TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT index_state_singleton CHECK (id = 1)
);

INSERT INTO index_state (id, last_indexed_block)
VALUES (1, -1)
ON CONFLICT (id) DO NOTHING;
