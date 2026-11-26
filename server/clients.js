// Client records, the agency onboarding register and the weekly review log.
// Every query is scoped to the authenticated owner. Offboarding removes the
// client's Google bindings (and cached Business Profile content) before the
// client row, whose foreign keys cascade to signals, AI evidence and reviews.
import { removeGoogleClient } from "./google.js";
import { InputError, json, readObject } from "./evidence-http.js";

const prepared = new WeakSet();
const CLIENT_COLUMNS = {
  contact: "TEXT", operator: "TEXT", key_events: "TEXT", time_zone: "TEXT", notes: "TEXT", updated_at: "TEXT",
};

async function columns(db, table) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all();
  return new Set((info.results || []).map(row => row.name));
}

// `npm run db:migrate` creates these up front. This keeps older or locally created
// databases compatible without a manual migration.
export async function ensureClients(env) {
  if (prepared.has(env.DB)) return;
  const existing = await columns(env.DB, "clients");
  const statements = Object.entries(CLIENT_COLUMNS).filter(([name]) => !existing.has(name))
    .map(([name, type]) => env.DB.prepare(`ALTER TABLE clients ADD COLUMN ${name} ${type}`));
  statements.push(env.DB.prepare(`CREATE TABLE IF NOT EXISTS client_reviews (
    id TEXT PRIMARY KEY NOT NULL, owner TEXT NOT NULL,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    week_of TEXT NOT NULL, risk TEXT, gain TEXT, next_action TEXT NOT NULL, action_owner TEXT NOT NULL,
    due_date TEXT, recovery_metric TEXT, status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`));
  statements.push(env.DB.prepare("CREATE INDEX IF NOT EXISTS client_reviews_owner_client ON client_reviews(owner,client_id,week_of)"));
  await env.DB.batch(statements);
  prepared.add(env.DB);
}

export function hostname(input) {
  if (typeof input !== "string" || input.length > 500) return null;
  try {
    const url = new URL(input.includes("://") ? input.trim() : "https://" + input.trim());
    const domain = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) return null;
    return domain;
  } catch { return null; }
}

function optionalText(value, label, limit) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.trim().length > limit) throw new InputError(`${label} must be text of up to ${limit} characters.`);
  return value.trim() || null;
}

function requiredText(value, label, limit) {
  const text = optionalText(value, label, limit);
  if (!text) throw new InputError(`${label} is required.`);
  return text;
}

function timeZone(value) {
  const zone = optionalText(value, "Reporting time zone", 64);
  if (!zone) return null;
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); } catch { throw new InputError("Enter an IANA time zone such as Asia/Kolkata."); }
  return zone;
}

function isoDate(value, label, required = false) {
  if ((value === undefined || value === null || value === "") && !required) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !new Date(value + "T00:00:00Z").toISOString().startsWith(value)) {
    throw new InputError(`${label} must be a date in YYYY-MM-DD format.`);
  }
  return value;
}

function clientView(row) {
  return {
    id: row.id, name: row.name, domain: row.domain, createdAt: row.created_at, updatedAt: row.updated_at ?? null,
    contact: row.contact ?? null, operator: row.operator ?? null, keyEvents: row.key_events ?? null,
    timeZone: row.time_zone ?? null, notes: row.notes ?? null,
  };
}

function reviewView(row) {
  return {
    id: row.id, clientId: row.client_id, weekOf: row.week_of, risk: row.risk, gain: row.gain, nextAction: row.next_action,
    actionOwner: row.action_owner, dueDate: row.due_date, recoveryMetric: row.recovery_metric, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function ownedClient(env, owner, id) {
  if (typeof id !== "string" || !id || id.length > 180) throw new InputError("Select a client.");
  const row = await env.DB.prepare("SELECT * FROM clients WHERE owner=? AND id=?").bind(owner, id).first();
  if (!row) throw new InputError("Client not found.", 404);
  return row;
}

function profileFields(body) {
  const fields = {};
  if ("contact" in body) fields.contact = optionalText(body.contact, "Client contact", 200);
  if ("operator" in body) fields.operator = optionalText(body.operator, "Accountable operator", 120);
  if ("keyEvents" in body) fields.key_events = optionalText(body.keyEvents, "Key events", 500);
  if ("timeZone" in body) fields.time_zone = timeZone(body.timeZone);
  if ("notes" in body) fields.notes = optionalText(body.notes, "Onboarding notes", 2000);
  return fields;
}

async function createClient(env, owner, body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const domain = hostname(body.domain);
  if (!name || name.length > 100 || !domain) throw new InputError("Enter a client name of up to 100 characters and a valid website domain.");
  const extra = profileFields(body);
  const now = new Date().toISOString();
  const client = { id: crypto.randomUUID(), name, domain, created_at: now, updated_at: now, ...extra };
  const keys = Object.keys(client);
  const added = await env.DB.batch([
    env.DB.prepare(`INSERT INTO clients (owner,${keys.join(",")}) VALUES (?,${keys.map(() => "?").join(",")}) ON CONFLICT(owner,domain) DO NOTHING`)
      .bind(owner, ...keys.map(k => client[k])),
    env.DB.prepare("INSERT INTO desk_settings(owner) VALUES(?) ON CONFLICT(owner) DO NOTHING").bind(owner),
  ]);
  if (added[0].meta.changes === 0) throw new InputError("This domain already belongs to a client in your workspace.", 409);
  return clientView(client);
}

async function updateClient(env, owner, id, body) {
  await ownedClient(env, owner, id);
  const fields = profileFields(body);
  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) throw new InputError("Enter a client name of up to 100 characters.");
    fields.name = name;
  }
  if ("domain" in body) {
    const domain = hostname(body.domain);
    if (!domain) throw new InputError("Enter a valid website domain.");
    const clash = await env.DB.prepare("SELECT id FROM clients WHERE owner=? AND domain=? AND id<>?").bind(owner, domain, id).first();
    if (clash) throw new InputError("This domain already belongs to another client in your workspace.", 409);
    fields.domain = domain;
  }
  if (!Object.keys(fields).length) throw new InputError("Supply at least one client field to update.");
  fields.updated_at = new Date().toISOString();
  const keys = Object.keys(fields);
  const row = await env.DB.prepare(`UPDATE clients SET ${keys.map(k => k + "=?").join(",")} WHERE owner=? AND id=? RETURNING *`)
    .bind(...keys.map(k => fields[k]), owner, id).first();
  return clientView(row);
}

async function deleteClient(env, owner, id) {
  const client = await ownedClient(env, owner, id);
  // Bindings have no foreign key to clients and the GBP cache lives outside D1.
  await removeGoogleClient(env, owner, id);
  await env.DB.prepare("DELETE FROM clients WHERE owner=? AND id=?").bind(owner, id).run();
  return { removed: { id: client.id, name: client.name, domain: client.domain } };
}

async function listReviews(env, owner, clientId) {
  const rows = await env.DB.prepare(`SELECT * FROM client_reviews WHERE owner=? AND client_id=?
    ORDER BY week_of DESC, created_at DESC LIMIT 104`).bind(owner, clientId).all();
  return rows.results.map(reviewView);
}

function reviewFields(body, partial) {
  const fields = {};
  const take = (key, column, fn) => { if (!partial || key in body) fields[column] = fn(body[key]); };
  take("weekOf", "week_of", v => isoDate(v, "Week of", true));
  take("risk", "risk", v => optionalText(v, "Material risk", 1000));
  take("gain", "gain", v => optionalText(v, "Verified gain", 1000));
  take("nextAction", "next_action", v => requiredText(v, "Next action", 1000));
  take("actionOwner", "action_owner", v => requiredText(v, "Action owner", 120));
  take("dueDate", "due_date", v => isoDate(v, "Due date"));
  take("recoveryMetric", "recovery_metric", v => optionalText(v, "Recovery metric", 300));
  if ("status" in body) {
    if (!["open", "done"].includes(body.status)) throw new InputError("Review status must be open or done.");
    fields.status = body.status;
  }
  return fields;
}

async function addReview(env, owner, clientId, body) {
  await ownedClient(env, owner, clientId);
  const fields = reviewFields(body, false);
  const now = new Date().toISOString();
  const row = { id: crypto.randomUUID(), owner, client_id: clientId, status: "open", ...fields, created_at: now, updated_at: now };
  const keys = Object.keys(row);
  const saved = await env.DB.prepare(`INSERT INTO client_reviews (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")}) RETURNING *`)
    .bind(...keys.map(k => row[k])).first();
  return reviewView(saved);
}

async function updateReview(env, owner, clientId, reviewId, body) {
  const fields = reviewFields(body, true);
  if (!Object.keys(fields).length) throw new InputError("Supply at least one review field to update.");
  fields.updated_at = new Date().toISOString();
  const keys = Object.keys(fields);
  const row = await env.DB.prepare(`UPDATE client_reviews SET ${keys.map(k => k + "=?").join(",")}
    WHERE owner=? AND client_id=? AND id=? RETURNING *`).bind(...keys.map(k => fields[k]), owner, clientId, reviewId).first();
  if (!row) throw new InputError("Review not found.", 404);
  return reviewView(row);
}

export async function clientsApi(request, env, owner) {
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/clients\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const method = request.method;
  try {
    await ensureClients(env);
    if (!parts.length) {
      if (method === "GET") {
        const rows = await env.DB.prepare("SELECT * FROM clients WHERE owner=? ORDER BY name COLLATE NOCASE").bind(owner).all();
        return json({ clients: rows.results.map(clientView) });
      }
      if (method === "POST") return json({ client: await createClient(env, owner, await readObject(request)) }, 201);
      return json({ error: "Method unavailable." }, 405);
    }
    const [id, sub, reviewId] = parts;
    if (parts.length === 1) {
      if (method === "GET") return json({ client: clientView(await ownedClient(env, owner, id)) });
      if (method === "PATCH") return json({ client: await updateClient(env, owner, id, await readObject(request)) });
      if (method === "DELETE") return json(await deleteClient(env, owner, id));
      return json({ error: "Method unavailable." }, 405);
    }
    if (sub === "reviews" && parts.length === 2) {
      await ownedClient(env, owner, id);
      if (method === "GET") return json({ reviews: await listReviews(env, owner, id) });
      if (method === "POST") return json({ review: await addReview(env, owner, id, await readObject(request)) }, 201);
      return json({ error: "Method unavailable." }, 405);
    }
    if (sub === "reviews" && parts.length === 3) {
      if (method === "PATCH") return json({ review: await updateReview(env, owner, id, reviewId, await readObject(request)) });
      if (method === "DELETE") {
        const row = await env.DB.prepare("DELETE FROM client_reviews WHERE owner=? AND client_id=? AND id=? RETURNING id")
          .bind(owner, id, reviewId).first();
        if (!row) throw new InputError("Review not found.", 404);
        return json({ ok: true });
      }
      return json({ error: "Method unavailable." }, 405);
    }
    return json({ error: "Route not found." }, 404);
  } catch (error) {
    if (error instanceof InputError) return json({ error: error.message }, error.status);
    throw error;
  }
}
