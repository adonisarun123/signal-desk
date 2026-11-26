import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  createdAt: text("created_at").notNull()
}, table => [uniqueIndex("clients_owner_domain").on(table.owner,table.domain)]);
export const settings = sqliteTable("desk_settings", {
  owner: text("owner").primaryKey(),
  scheduleEnabled: integer("schedule_enabled").notNull().default(1),
  lastCheck: text("last_check"),
});
export const jobRuns = sqliteTable("desk_job_runs", {
  bucket: text("bucket").primaryKey(),
  startedAt: text("started_at").notNull(),
  lease: text("lease").notNull(),
  finishedAt: text("finished_at"),
  result: text("result"),
});

// The clients table is extended at runtime by server/clients.js (ensureClients):
// contact, operator, key_events, time_zone, notes and updated_at, plus the
// client_reviews table. Like the Google, health and AI tables, these are
// bootstrapped idempotently so that existing databases need no manual migration.
