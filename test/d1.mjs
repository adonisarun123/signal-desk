// Test database for the integration suites.
// Default: an in-memory SQLite subset of Cloudflare D1 (fast, no dependencies).
// SIGNAL_DESK_TEST_DB=pglite: in-process PostgreSQL through the production D1 adapter
// (server/pg-d1.js), so the same suites exercise the Neon code path.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createD1 } from '../server/pg-d1.js';

const migrationDir = new URL('../db/migrations/', import.meta.url);
const migrationSql = () => readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort()
  .map(name => readFileSync(new URL(name, migrationDir), 'utf8')).join('\n');

function wrap(database, query, values = []) {
  function execute() {
    const statement = database.prepare(query);
    if (statement.columns().length) {
      return { success: true, results: statement.all(...values).map(row => ({ ...row })), meta: {} };
    }
    const { changes, lastInsertRowid } = statement.run(...values);
    return { success: true, results: [], meta: { changes: Number(changes), last_row_id: Number(lastInsertRowid) } };
  }
  return {
    bind(...params) { return wrap(database, query, params); },
    async run() { return execute(); },
    async all() { return execute(); },
    async first(column) {
      const row = database.prepare(query).get(...values);
      if (!row) return null;
      if (column === undefined) return { ...row };
      if (!Object.hasOwn(row, column)) throw new Error('Unknown result column ' + column);
      return row[column];
    },
    async raw() {
      return execute().results.map(row => Object.values(row));
    },
    execute,
  };
}

function sqliteD1(migrations) {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys=ON');
  if (migrations) database.exec(migrationSql());
  return {
    prepare(query) { return wrap(database, query); },
    async exec(query) { database.exec(query); return { count: 1, duration: 0 }; },
    async batch(statements) {
      database.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.execute());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    close() { database.close(); },
  };
}

let PGlite;
if (process.env.SIGNAL_DESK_TEST_DB === 'pglite') ({ PGlite } = await import('@electric-sql/pglite'));

function pgliteD1(migrations) {
  const db = new PGlite({ parsers: { 20: v => Number(v), 1700: v => Number(v) } });
  const ready = migrations ? db.exec(migrationSql()) : db.waitReady;
  const wrap = result => ({ rows: result.rows, rowCount: result.affectedRows ?? result.rows.length });
  const d1 = createD1({
    async query(text, params) { await ready; return wrap(await db.query(text, params)); },
    async transaction(fn) {
      await ready;
      return db.transaction(tx => fn(async (text, params) => wrap(await tx.query(text, params))));
    },
  });
  d1.close = () => db.close();
  return d1;
}

export function memoryD1({migrations = false} = {}) {
  return PGlite ? pgliteD1(migrations) : sqliteD1(migrations);
}
