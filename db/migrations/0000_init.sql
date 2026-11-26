-- Core Signal Desk tables. Portable SQL: runs unchanged on PostgreSQL (Neon) and on the
-- SQLite test adapter. The Google, health, AI evidence and client-review tables are
-- bootstrapped idempotently by the server modules (and by `npm run db:migrate`).
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS clients_owner_domain ON clients (owner, domain);
CREATE TABLE IF NOT EXISTS desk_job_runs (
  bucket TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  lease TEXT NOT NULL,
  finished_at TEXT,
  result TEXT
);
CREATE TABLE IF NOT EXISTS desk_settings (
  owner TEXT PRIMARY KEY NOT NULL,
  schedule_enabled BIGINT DEFAULT 1 NOT NULL,
  last_check TEXT
);
