import { assessBinding } from "./health-rules.js";
import { getClient, handleInputError, InputError, json, readObject } from "./evidence-http.js";
import { readGoogle } from "./google.js";

const prepared = new WeakSet();

const ALERT_COLUMNS = {
  assignee: "TEXT", outcome: "TEXT", acknowledged_at: "TEXT", resolved_at: "TEXT",
  resolution_note: "TEXT", occurrences: "INTEGER NOT NULL DEFAULT 1",
};
export const OUTCOMES = ["actionable", "expected", "data_issue"];

export async function ensureHealth(env) {
  if (prepared.has(env.DB)) return;
  const ddl = [
    `CREATE TABLE IF NOT EXISTS signal_checks (
      owner TEXT NOT NULL, binding_id TEXT NOT NULL, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, source TEXT NOT NULL,
      state TEXT NOT NULL, detail TEXT NOT NULL, last_sync TEXT, latest_date TEXT, checked_at TEXT NOT NULL,
      PRIMARY KEY(owner, binding_id))`,
    `CREATE INDEX IF NOT EXISTS signal_checks_client ON signal_checks(owner,client_id)`,
    `CREATE TABLE IF NOT EXISTS signal_alerts (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, binding_id TEXT NOT NULL, source TEXT NOT NULL,
      rule_key TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL, action TEXT NOT NULL,
      severity TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', metrics TEXT NOT NULL,
      first_seen TEXT NOT NULL, observed_at TEXT NOT NULL, evaluated_at TEXT NOT NULL, recovered_at TEXT,
      UNIQUE(owner,binding_id,rule_key))`,
    `CREATE INDEX IF NOT EXISTS signal_alerts_client ON signal_alerts(owner,client_id,status,observed_at)`,
    // The incident timeline records detection, acknowledgement, assignment, notes,
    // resolution, automatic recovery and recurrence with their timestamps.
    `CREATE TABLE IF NOT EXISTS signal_events (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, alert_id TEXT NOT NULL REFERENCES signal_alerts(id) ON DELETE CASCADE,
      at TEXT NOT NULL, kind TEXT NOT NULL, status TEXT, note TEXT)`,
    `CREATE INDEX IF NOT EXISTS signal_events_alert ON signal_events(owner,alert_id,at)`,
  ];
  await env.DB.batch(ddl.map(sql => env.DB.prepare(sql)));
  const info = await env.DB.prepare("PRAGMA table_info(signal_alerts)").all();
  const have = new Set((info.results || []).map(row => row.name));
  const missing = Object.entries(ALERT_COLUMNS).filter(([name]) => !have.has(name));
  if (missing.length) await env.DB.batch(missing.map(([name, type]) => env.DB.prepare(`ALTER TABLE signal_alerts ADD COLUMN ${name} ${type}`)));
  prepared.add(env.DB);
}

function alertRow(row) {
  return { id: row.id, clientId: row.client_id, bindingId: row.binding_id, source: row.source,
    title: row.title, detail: row.detail, action: row.action, kind: row.kind, severity: row.severity, status: row.status,
    metrics: JSON.parse(row.metrics), firstSeen: row.first_seen, observedAt: row.observed_at, recoveredAt: row.recovered_at,
    assignee: row.assignee ?? null, outcome: row.outcome ?? null, acknowledgedAt: row.acknowledged_at ?? null,
    resolvedAt: row.resolved_at ?? null, resolutionNote: row.resolution_note ?? null, occurrences: row.occurrences ?? 1 };
}

function checkRow(row) {
  return { bindingId: row.binding_id, clientId: row.client_id, source: row.source, state: row.state,
    detail: row.detail, latestDate: row.latest_date, lastSync: row.last_sync, checkedAt: row.checked_at };
}

export async function readHealth(env, owner, clientId) {
  await ensureHealth(env);
  const filter = clientId ? " AND client_id = ?" : "";
  const params = clientId ? [owner, clientId] : [owner];
  const [alerts, checks] = await Promise.all([
    env.DB.prepare(`SELECT * FROM signal_alerts WHERE owner = ?${filter}
      ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
      CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, observed_at DESC LIMIT 500`).bind(...params).all(),
    env.DB.prepare(`SELECT * FROM signal_checks WHERE owner = ?${filter} ORDER BY checked_at DESC`).bind(...params).all(),
  ]);
  return { alerts: alerts.results.map(alertRow), checks: checks.results.map(checkRow), checkedAt: checks.results[0]?.checked_at ?? null };
}

function recoveryEvents(db, owner, bindingId, time, note) {
  return db.prepare(`INSERT INTO signal_events (id,owner,alert_id,at,kind,status,note)
    SELECT lower(hex(randomblob(16))),owner,id,?,'recovered','resolved',? FROM signal_alerts
    WHERE owner=? AND binding_id=? AND recovered_at=?`).bind(time,note,owner,bindingId,time);
}

function eventRow(row) {
  return { id: row.id, alertId: row.alert_id, at: row.at, kind: row.kind, status: row.status, note: row.note };
}

async function writeBinding(env, owner, binding, now) {
  const { check, alerts, assessedKeys } = assessBinding(binding, now);
  const time = check.checkedAt;
  const db = env.DB;
  const statements = [
    db.prepare(`INSERT INTO signal_checks (owner,binding_id,client_id,source,state,detail,last_sync,latest_date,checked_at)
      VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,binding_id) DO UPDATE SET state=excluded.state,
      detail=excluded.detail,last_sync=excluded.last_sync,latest_date=excluded.latest_date,checked_at=excluded.checked_at
      WHERE signal_checks.checked_at <= excluded.checked_at`)
      .bind(owner,binding.id,binding.clientId,binding.source,check.state,check.detail,check.lastSync,check.latestDate,time),
  ];
  for (const a of alerts) {
    statements.push(db.prepare(`INSERT INTO signal_alerts
      (id,owner,client_id,binding_id,source,rule_key,kind,title,detail,action,severity,metrics,first_seen,observed_at,evaluated_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM signal_checks WHERE owner=? AND binding_id=? AND checked_at=?)
      ON CONFLICT(owner,binding_id,rule_key) DO UPDATE SET
      title=excluded.title,detail=excluded.detail,action=excluded.action,severity=excluded.severity,metrics=excluded.metrics,
      observed_at=excluded.observed_at,evaluated_at=excluded.evaluated_at,
      status=CASE WHEN signal_alerts.recovered_at IS NOT NULL THEN 'open' ELSE signal_alerts.status END,
      first_seen=CASE WHEN signal_alerts.recovered_at IS NOT NULL THEN excluded.first_seen ELSE signal_alerts.first_seen END,
      occurrences=signal_alerts.occurrences + CASE WHEN signal_alerts.recovered_at IS NOT NULL THEN 1 ELSE 0 END,
      acknowledged_at=CASE WHEN signal_alerts.recovered_at IS NOT NULL THEN NULL ELSE signal_alerts.acknowledged_at END,
      resolved_at=CASE WHEN signal_alerts.recovered_at IS NOT NULL THEN NULL ELSE signal_alerts.resolved_at END,
      recovered_at=NULL WHERE signal_alerts.evaluated_at <= excluded.evaluated_at`)
      .bind(crypto.randomUUID(),owner,binding.clientId,binding.id,binding.source,a.key,a.kind,a.title,a.detail,a.action,
        a.severity,JSON.stringify(a.metrics),time,a.observedAt,time,owner,binding.id,time));
    // first_seen equals this evaluation only for a new alert or a recurrence.
    statements.push(db.prepare(`INSERT INTO signal_events (id,owner,alert_id,at,kind,status,note)
      SELECT lower(hex(randomblob(16))),owner,id,?,CASE WHEN occurrences>1 THEN 'recurred' ELSE 'detected' END,status,detail
      FROM signal_alerts WHERE owner=? AND binding_id=? AND rule_key=? AND first_seen=? AND evaluated_at=?`)
      .bind(time,owner,binding.id,a.key,time,time));
  }
  const recovered = assessedKeys.filter(key => !alerts.some(a => a.key === key));
  if (recovered.length) {
    const marks = recovered.map(() => "?").join(",");
    statements.push(db.prepare(`UPDATE signal_alerts SET status='resolved', recovered_at=?, evaluated_at=?
      WHERE owner=? AND binding_id=? AND recovered_at IS NULL AND evaluated_at<=? AND rule_key IN (${marks})`)
      .bind(time,time,owner,binding.id,time,...recovered));
    statements.push(recoveryEvents(db,owner,binding.id,time,"The underlying condition no longer meets the alert rule."));
  }
  await db.batch(statements);
}

export async function runHealthChecks(env, owner, clientId, options = {}) {
  await ensureHealth(env);
  const now = options.now || new Date();
  const time = now.toISOString();
  const { bindings } = await (options.read || readGoogle)(env, owner, clientId || undefined);
  const selected = bindings.filter(b => !clientId || b.clientId === clientId);
  const filter = clientId ? " AND client_id = ?" : "";
  const params = clientId ? [owner,clientId] : [owner];
  const old = await env.DB.prepare(`SELECT binding_id FROM signal_checks WHERE owner = ?${filter} AND checked_at<=?`).bind(...params,time).all();
  const ids = new Set(selected.map(b => b.id));
  for (const row of old.results) {
    if (ids.has(row.binding_id)) continue;
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM signal_checks WHERE owner=? AND binding_id=? AND checked_at<=?`).bind(owner,row.binding_id,time),
      env.DB.prepare(`UPDATE signal_alerts SET status='resolved', recovered_at=?, evaluated_at=? WHERE owner=? AND binding_id=? AND recovered_at IS NULL AND evaluated_at<=?`)
        .bind(time,time,owner,row.binding_id,time),
      recoveryEvents(env.DB,owner,row.binding_id,time,"The source mapping was removed."),
    ]);
  }
  for (const binding of selected) await writeBinding(env, owner, binding, now);
  return readHealth(env, owner, clientId);
}

function optionalText(value, label, limit) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.trim().length > limit) throw new InputError(`${label} must be text of up to ${limit} characters.`);
  return value.trim() || null;
}

/** Status changes, ownership, review outcome and notes form the incident record. */
async function updateAlert(env, owner, id, body) {
  await ensureHealth(env);
  const current = await env.DB.prepare("SELECT * FROM signal_alerts WHERE owner=? AND id=?").bind(owner,id).first();
  if (!current) throw new InputError("Alert not found.", 404);
  const { status } = body;
  const assignee = optionalText(body.assignee, "Assignee", 120);
  const note = optionalText(body.note, "Note", 2000);
  let outcome;
  if (body.outcome !== undefined) {
    if (body.outcome !== null && !OUTCOMES.includes(body.outcome)) throw new InputError("Choose actionable, expected change or data issue.");
    outcome = body.outcome;
  }
  if (status !== undefined && !["open","acknowledged","resolved"].includes(status)) throw new InputError("Choose a supported alert status.");
  if (status === undefined && assignee === undefined && outcome === undefined && !note) throw new InputError("Supply a status, assignee, outcome or note.");
  if (status && status !== "resolved" && current.recovered_at) throw new InputError("This signal has already recovered.", 409);
  if (status === "resolved" && current.status !== "resolved" && !note) {
    throw new InputError("Record the fix, its date and the evidence you verified before resolving this signal.");
  }
  const time = new Date().toISOString();
  const sets = [], params = [], events = [];
  const event = (kind, eventStatus, text) => events.push(env.DB.prepare(`INSERT INTO signal_events (id,owner,alert_id,at,kind,status,note)
    VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),owner,id,time,kind,eventStatus,text));
  if (status && status !== current.status) {
    sets.push("status=?"); params.push(status);
    if (status === "acknowledged") { sets.push("acknowledged_at=COALESCE(acknowledged_at,?)"); params.push(time); }
    if (status === "resolved") { sets.push("resolved_at=?","resolution_note=?","acknowledged_at=COALESCE(acknowledged_at,?)"); params.push(time,note,time); }
    if (status === "open") { sets.push("resolved_at=NULL"); }
    event(status === "open" ? "reopened" : status, status, status === "resolved" ? note : note || null);
  } else if (note) event("note", current.status, note);
  if (assignee !== undefined && assignee !== current.assignee) {
    sets.push("assignee=?"); params.push(assignee);
    event("assigned", status || current.status, assignee ? "Assigned to " + assignee : "Assignment cleared");
  }
  if (outcome !== undefined && outcome !== current.outcome) {
    sets.push("outcome=?"); params.push(outcome);
    event("outcome", status || current.status, outcome ? "Review outcome: " + outcome.replace("_"," ") : "Review outcome cleared");
  }
  const statements = [];
  if (sets.length) statements.push(env.DB.prepare(`UPDATE signal_alerts SET ${sets.join(",")} WHERE owner=? AND id=?`).bind(...params,owner,id));
  statements.push(...events);
  if (statements.length) await env.DB.batch(statements);
  const row = await env.DB.prepare("SELECT * FROM signal_alerts WHERE owner=? AND id=?").bind(owner,id).first();
  const timeline = await env.DB.prepare("SELECT * FROM signal_events WHERE owner=? AND alert_id=? ORDER BY at, rowid").bind(owner,id).all();
  return { alert: alertRow(row), events: timeline.results.map(eventRow) };
}

export async function healthApi(request, env, owner) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/alerts")) return null;
  if (!owner) return json({error: "Sign in to your workspace."}, 401);
  try {
    if (url.pathname === "/api/alerts" && request.method === "GET") {
      const id = url.searchParams.get("clientId");
      if (id) await getClient(env,owner,id);
      return json(await readHealth(env,owner,id));
    }
    if (url.pathname === "/api/alerts/check" && request.method === "POST") {
      const { clientId } = await readObject(request);
      if (clientId !== undefined) await getClient(env,owner,clientId);
      return json(await runHealthChecks(env,owner,clientId));
    }
    const match = url.pathname.match(/^\/api\/alerts\/([\w-]+)$/);
    if (match && request.method === "GET") {
      await ensureHealth(env);
      const row = await env.DB.prepare("SELECT * FROM signal_alerts WHERE owner=? AND id=?").bind(owner,match[1]).first();
      if (!row) throw new InputError("Alert not found.",404);
      const events = await env.DB.prepare("SELECT * FROM signal_events WHERE owner=? AND alert_id=? ORDER BY at, rowid").bind(owner,match[1]).all();
      return json({ alert: alertRow(row), events: events.results.map(eventRow) });
    }
    if (match && request.method === "PATCH") return json(await updateAlert(env,owner,match[1],await readObject(request)));
    return json({error:"Alert route not found."},404);
  } catch (error) { return handleInputError(error); }
}
