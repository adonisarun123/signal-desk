// Applies db/migrations/*.sql once each, then runs the idempotent table bootstraps that
// the server modules otherwise perform on first use. Safe to re-run.
//   DATABASE_URL=... npm run db:migrate
import { readdirSync, readFileSync } from "node:fs";
import { openDatabase } from "./db.mjs";
import { ensureClients } from "../server/clients.js";
import { initGoogle } from "../server/google-storage.js";
import { ensureHealth } from "../server/health.js";
import { ensureAi } from "../server/ai.js";

const { pool, DB } = openDatabase();
const dir = new URL("../db/migrations/", import.meta.url);
try {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const done = new Set((await pool.query("SELECT name FROM schema_migrations")).rows.map(r => r.name));
  for (const name of readdirSync(dir).filter(n => n.endsWith(".sql")).sort()) {
    if (done.has(name)) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(readFileSync(new URL(name, dir), "utf8"));
      await client.query("INSERT INTO schema_migrations(name, applied_at) VALUES($1, $2)", [name, new Date().toISOString()]);
      await client.query("COMMIT");
      console.log("applied", name);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  const env = { DB };
  await ensureClients(env);
  await initGoogle(env);
  await ensureHealth(env);
  await ensureAi(env);
  const tables = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() ORDER BY 1")).rows.map(r => r.table_name);
  console.log("schema ready:", tables.join(", "));
} finally {
  await pool.end();
}
