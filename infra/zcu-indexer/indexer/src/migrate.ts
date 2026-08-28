// Idempotent schema migrations.
//
// postgres/init/*.sql only runs on a *fresh* data directory, so an existing
// deployment would never see new tables. The indexer therefore applies the
// same statements itself on every boot; all of them are CREATE ... IF NOT
// EXISTS, so running them repeatedly is a no-op.

import { pool } from "./db.js";

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS token_meta (
     address          TEXT PRIMARY KEY,
     type             TEXT NOT NULL DEFAULT 'unknown',
     name             TEXT,
     symbol           TEXT,
     decimals         INT,
     total_supply     NUMERIC(78,0),
     first_seen_block BIGINT,
     checked_at       TIMESTAMPTZ,
     attempts         INT NOT NULL DEFAULT 0
   )`,
  `CREATE INDEX IF NOT EXISTS token_meta_checked_idx ON token_meta (checked_at NULLS FIRST)`,
  `CREATE TABLE IF NOT EXISTS contracts (
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
   )`,
  `CREATE INDEX IF NOT EXISTS contracts_verified_idx ON contracts (verified_at DESC)`,
];

export async function migrate(): Promise<void> {
  for (const sql of STATEMENTS) {
    await pool.query(sql);
  }
}
