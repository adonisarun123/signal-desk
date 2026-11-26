// Shared by the database scripts: a D1-style handle on DATABASE_URL (Neon).
import { createD1, poolExecutor } from "../server/pg-d1.js";
import { createPool, databaseUrl } from "../server/env.js";

export function openDatabase() {
  const url = databaseUrl();
  if (!url) {
    console.error("Set DATABASE_URL to the Neon connection string (see .env.example).");
    process.exit(1);
  }
  const pool = createPool(url);
  return { pool, DB: createD1(poolExecutor(pool)) };
}
