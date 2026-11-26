// Runtime environment for the Next.js route handlers: process.env plus a D1-style
// `DB` backed by Neon Postgres. One pool and one DB object per server instance, so the
// per-database schema bootstrap caches in the server modules (keyed by env.DB) hold.
import pg from "pg";
import { createD1, poolExecutor } from "./pg-d1.js";

// COUNT(*) / SUM() return int8 and numeric; D1 returned JavaScript numbers.
pg.types.setTypeParser(20, v => (v === null ? null : Number(v)));
pg.types.setTypeParser(1700, v => (v === null ? null : Number(v)));

let cached = null;

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export function createPool(url = databaseUrl()) {
  return new pg.Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function serverEnv() {
  if (!cached) {
    const url = databaseUrl();
    cached = { ...process.env, DB: url ? createD1(poolExecutor(createPool(url))) : undefined };
  }
  return cached;
}
