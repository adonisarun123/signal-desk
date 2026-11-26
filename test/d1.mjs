// SQLite-backed subset of Cloudflare D1 used by the integration suite.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

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

export function memoryD1({migrations = false} = {}) {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys=ON');
  if (migrations) {
    const directory = new URL('../drizzle/', import.meta.url);
    for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
      database.exec(readFileSync(new URL(name, directory), 'utf8'));
    }
  }
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
