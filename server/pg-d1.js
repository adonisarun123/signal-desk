// A Cloudflare D1-compatible facade over PostgreSQL.
//
// The server modules were written against D1 (SQLite): prepare().bind().first/all/run,
// db.batch() and SQLite DDL. This adapter keeps that interface so the request handlers
// stay unchanged, and translates the few SQLite-specific constructs they use:
//   - `?` placeholders           -> $1, $2, ...
//   - PRAGMA table_info(t)       -> information_schema lookup (returns { name })
//   - INTEGER / REAL / BLOB DDL  -> BIGINT / DOUBLE PRECISION / BYTEA
//                                   (millisecond timestamps overflow a 32-bit INTEGER)
//   - ORDER BY ... rowid         -> ctid (insertion order for these append-only tables)
//   - lower(hex(randomblob(16))) -> a random 32-character hex id
//   - <column> COLLATE NOCASE    -> lower(<column>)
//   - unquoted camelCase columns -> result keys restored to camelCase
//                                   (PostgreSQL folds unquoted identifiers to lower case)
// Booleans are stored as 0/1 and undefined as NULL, matching D1.

// Columns declared in camelCase by server/google-storage.js.
const CAMEL_COLUMNS = [
  "clientId", "accountId", "resourceId", "connectedAt", "lastError", "lastAttempt", "lastSync",
  "rtAttempt", "rtError", "leaseUntil", "rtLease", "rtUntil",
];
const RESTORE = new Map(CAMEL_COLUMNS.map(name => [name.toLowerCase(), name]));
const DDL = /^\s*(CREATE\s+TABLE|ALTER\s+TABLE)/i;
const PRAGMA = /^\s*PRAGMA\s+table_info\s*\(\s*["'`]?(\w+)["'`]?\s*\)\s*;?\s*$/i;
// Arbitrary constant: serialises concurrent schema bootstraps from cold-started functions.
const SCHEMA_LOCK = 734_291_001;

function placeholders(sql) {
  let out = "", n = 0, quote = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch; out += ch;
    } else if (ch === "?") {
      out += "$" + (++n);
    } else out += ch;
  }
  return out;
}

export function translate(sql) {
  const pragma = sql.match(PRAGMA);
  if (pragma) {
    return {
      text: "SELECT column_name AS name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position",
      fixed: [pragma[1].toLowerCase()],
      ddl: false,
    };
  }
  let text = sql;
  const ddl = DDL.test(text);
  if (ddl) {
    text = text.replace(/\bINTEGER\b/gi, "BIGINT").replace(/\bREAL\b/gi, "DOUBLE PRECISION").replace(/\bBLOB\b/gi, "BYTEA");
  }
  if (/^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(text)) return { text: placeholders(text), ddl: true };
  text = text.replace(/(ORDER\s+BY[^;]*?)\browid\b/gi, "$1ctid")
    .replace(/lower\(\s*hex\(\s*randomblob\(\s*16\s*\)\s*\)\s*\)/gi, "replace(gen_random_uuid()::text,'-','')")
    .replace(/([\w.]+)\s+COLLATE\s+NOCASE\b/gi, "lower($1)");
  return { text: placeholders(text), ddl };
}

function value(v) {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof ArrayBuffer) return Buffer.from(v);
  if (ArrayBuffer.isView(v)) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  return v;
}

function restore(row) {
  const out = {};
  for (const [key, v] of Object.entries(row)) out[RESTORE.get(key) ?? key] = v;
  return out;
}

/**
 * @param {{ query(text: string, params: unknown[]): Promise<{rows: object[], rowCount: number}>,
 *           transaction<T>(fn: (q: (text: string, params: unknown[]) => Promise<{rows: object[], rowCount: number}>) => Promise<T>): Promise<T> }} executor
 */
export function createD1(executor) {
  function statement(sql, params = []) {
    const { text, fixed, ddl } = translate(sql);
    const args = fixed ?? params.map(value);
    async function execute(query = executor.query.bind(executor)) {
      const result = await query(text, args);
      return {
        success: true,
        results: (result.rows || []).map(restore),
        meta: { changes: result.rowCount ?? 0, rows_read: result.rows?.length ?? 0, last_row_id: null },
      };
    }
    return {
      ddl,
      bind(...values) { return statement(sql, values); },
      execute,
      async run() { return execute(); },
      async all() { return execute(); },
      async first(column) {
        const { results } = await execute();
        const row = results[0];
        if (!row) return null;
        if (column === undefined) return row;
        if (!Object.hasOwn(row, column)) throw new Error("Unknown result column " + column);
        return row[column];
      },
      async raw() { return (await execute()).results.map(row => Object.values(row)); },
    };
  }
  return {
    prepare(sql) { return statement(sql); },
    async batch(statements) {
      if (!statements.length) return [];
      return executor.transaction(async query => {
        if (statements.some(s => s.ddl)) await query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_LOCK]);
        const results = [];
        for (const s of statements) results.push(await s.execute(query));
        return results;
      });
    },
    async exec(sql) {
      await executor.transaction(async query => {
        for (const part of sql.split(";").map(s => s.trim()).filter(Boolean)) await query(translate(part).text, []);
      });
      return { count: 1, duration: 0 };
    },
  };
}

/** Executor over a node-postgres Pool. */
export function poolExecutor(pool) {
  return {
    query: (text, params) => pool.query(text, params),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn((text, params) => client.query(text, params));
        await client.query("COMMIT");
        return out;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
