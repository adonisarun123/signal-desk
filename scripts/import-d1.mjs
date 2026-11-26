// One-time copy of the old Cloudflare D1 data into Neon.
//
//   1. Export the old database to SQL (e.g. `wrangler d1 export <db> --remote --output d1.sql`,
//      or whatever export the old host provides). A raw SQLite file (.sqlite/.db) also works.
//   2. DATABASE_URL=... npm run db:migrate
//   3. DATABASE_URL=... npm run db:import-d1 -- d1.sql            (dry run: counts only)
//      DATABASE_URL=... npm run db:import-d1 -- d1.sql --commit   (writes, in one transaction)
//
// Workspace ids (the `owner` column) are copied unchanged: stored Google tokens are encrypted
// against them, so map your Google email to the old id with OWNER_ID_OVERRIDES, and keep the
// same GOOGLE_TOKEN_KEY. Re-running skips rows that already exist.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./db.mjs";

// Parents before children (foreign keys). google_states holds 10-minute OAuth handshakes: skipped.
const ORDER = [
  "clients", "client_reviews", "desk_settings", "desk_job_runs",
  "google_configs", "google_accounts", "google_bindings",
  "signal_checks", "signal_alerts", "signal_events",
  "ai_observations", "ai_sample_attempts", "ai_failed_runs",
];

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("Usage: npm run db:import-d1 -- <export.sql | database.sqlite> [--commit]");
  process.exit(1);
}
const commit = flags.includes("--commit");

let source;
if (/\.(sqlite3?|db)$/i.test(file)) {
  source = new DatabaseSync(file, { readOnly: true });
} else {
  source = new DatabaseSync(":memory:");
  source.exec(readFileSync(file, "utf8"));
}
const present = new Set(source.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
const unknown = [...present].filter(t => !ORDER.includes(t) && t !== "google_states" && !/^(sqlite_|_cf_|d1_)/.test(t));
if (unknown.length) console.warn("Not imported (unknown tables):", unknown.join(", "));

const { pool } = openDatabase();
const client = await pool.connect();
let total = 0;
try {
  await client.query("BEGIN");
  for (const table of ORDER) {
    if (!present.has(table)) continue;
    const rows = source.prepare(`SELECT * FROM "${table}"`).all();
    const target = new Set((await client.query(
      "SELECT lower(column_name) AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1", [table])).rows.map(r => r.name));
    if (!target.size) throw new Error(`Table ${table} is missing in Neon. Run npm run db:migrate first.`);
    const columns = rows.length ? Object.keys(rows[0]).filter(c => target.has(c.toLowerCase())) : [];
    const dropped = rows.length ? Object.keys(rows[0]).filter(c => !target.has(c.toLowerCase())) : [];
    if (dropped.length) console.warn(`${table}: columns not in Neon, skipped:`, dropped.join(", "));
    let inserted = 0;
    for (const row of rows) {
      const values = columns.map(c => row[c] ?? null);
      const sql = `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map((_, i) => "$" + (i + 1)).join(",")}) ON CONFLICT DO NOTHING`;
      inserted += (await client.query(sql, values)).rowCount;
    }
    total += inserted;
    console.log(`${table}: ${rows.length} in export, ${inserted} new`);
  }
  const owners = present.has("clients") ? source.prepare("SELECT owner, COUNT(*) AS n FROM clients GROUP BY owner").all() : [];
  for (const { owner, n } of owners) console.log(`workspace id ${owner}: ${n} client(s)`);
  if (commit) {
    await client.query("COMMIT");
    console.log(`Committed ${total} rows.`);
  } else {
    await client.query("ROLLBACK");
    console.log(`Dry run: ${total} rows would be written. Re-run with --commit to keep them.`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
  source.close();
}
