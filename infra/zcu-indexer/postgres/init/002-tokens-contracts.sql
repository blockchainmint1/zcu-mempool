-- Token metadata cache and verified-contract store.
--
-- Deliberately *not* a balance table: token balances and holder lists are
-- derived from the `logs` table at query time. That keeps them reorg-safe for
-- free — rolling back blocks cascades the logs away and the aggregates
-- correct themselves — which a materialised balance table would not.

CREATE TABLE IF NOT EXISTS token_meta (
  address          TEXT PRIMARY KEY,
  type             TEXT NOT NULL DEFAULT 'unknown', -- erc20 | erc721 | unknown
  name             TEXT,
  symbol           TEXT,
  decimals         INT,
  total_supply     NUMERIC(78,0),
  first_seen_block BIGINT,
  checked_at       TIMESTAMPTZ,
  attempts         INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS token_meta_checked_idx ON token_meta (checked_at NULLS FIRST);

CREATE TABLE IF NOT EXISTS contracts (
  address               TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  compiler_version      TEXT NOT NULL,
  evm_version           TEXT,
  optimization          BOOLEAN NOT NULL DEFAULT FALSE,
  optimization_runs     INT,
  license               TEXT,
  source_code           TEXT NOT NULL,
  abi                   JSONB NOT NULL,
  constructor_arguments TEXT,
  compiler_settings     JSONB,
  verified_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contracts_verified_idx ON contracts (verified_at DESC);
