// Pilot-scope completion: onboarding register, offboarding, weekly reviews, incident
// workflow, prompt panels, failed-run evidence, date-matched breakdowns and batch size.
import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../server/router.js';
import { runHealthChecks } from '../server/health.js';
import { composeOverview } from '../public/overview.js';
import { memoryD1 } from './d1.mjs';

const CRON = 'test-cron-secret-0123456789';

const site = 'https://desk.example';
const DAY = 86_400_000;

function workspace(t, extra = {}) {
  const env = { DB: memoryD1({ migrations: true }), ...extra };
  t.after(() => env.DB.close());
  async function request(path, { method = 'GET', owner = 'alice', body, headers = {} } = {}) {
    const h = new Headers(headers);
    if (path.startsWith('/api/jobs/') && env.CRON_SECRET && !h.has('Authorization')) h.set('Authorization', 'Bearer ' + env.CRON_SECRET);
    if (method !== 'GET') h.set('Origin', site);
    if (body !== undefined) h.set('Content-Type', 'application/json');
    const r = await handleApi(new Request(site + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, owner || null);
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, ok: r.ok, data };
  }
  return { env, request };
}

const googleEnv = () => ({
  GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'fixture-secret',
  GOOGLE_REDIRECT_URI: site + '/api/google/callback', GOOGLE_TOKEN_KEY: Buffer.alloc(32, 9).toString('base64url'),
});

test('the onboarding register is created, edited and validated per owner', async t => {
  const { request } = workspace(t);
  const created = await request('/api/clients', { method: 'POST', body: {
    name: 'Spine Clinic', domain: 'https://www.spine.example/', contact: 'Dr Rao, front desk', operator: 'Priya',
    keyEvents: 'form_submit, phone_tap, whatsapp_click', timeZone: 'Asia/Kolkata' } });
  assert.equal(created.status, 201, JSON.stringify(created));
  const c = created.data.client;
  assert.deepEqual([c.domain, c.operator, c.timeZone], ['spine.example', 'Priya', 'Asia/Kolkata']);
  assert.equal((await request('/api/clients/' + c.id, { method: 'PATCH', body: { timeZone: 'Mars/Olympus' } })).status, 400);
  assert.equal((await request('/api/clients/' + c.id, { method: 'PATCH', owner: 'bob', body: { operator: 'Mallory' } })).status, 404);
  const edited = await request('/api/clients/' + c.id, { method: 'PATCH', body: { name: 'Spine & Joint Clinic', operator: 'Arun', notes: 'Shared GA4 with corporate site' } });
  assert.equal(edited.status, 200, JSON.stringify(edited));
  assert.equal(edited.data.client.name, 'Spine & Joint Clinic');
  assert.equal(edited.data.client.keyEvents, 'form_submit, phone_tap, whatsapp_click');
  await request('/api/clients', { method: 'POST', body: { name: 'Other', domain: 'other.example' } });
  assert.equal((await request('/api/clients/' + c.id, { method: 'PATCH', body: { domain: 'other.example' } })).status, 409);
  const listed = await request('/api/clients');
  assert.equal(listed.data.clients.find(x => x.id === c.id).operator, 'Arun');
  assert.deepEqual((await request('/api/clients', { owner: 'bob' })).data.clients, []);
});

test('weekly reviews record risk, gain, next action, owner, due date and recovery metric', async t => {
  const { request } = workspace(t);
  const { data: { client } } = await request('/api/clients', { method: 'POST', body: { name: 'Atlas Clinic', domain: 'atlas.example' } });
  const path = '/api/clients/' + client.id + '/reviews';
  assert.equal((await request(path, { method: 'POST', body: { weekOf: '2026-11-23', nextAction: 'Fix form' } })).status, 400);
  const saved = await request(path, { method: 'POST', body: { weekOf: '2026-11-23', risk: 'Booking form key events fell 60%',
    gain: 'Knee replacement page gained 40 clicks', nextAction: 'Retest form with test identity', actionOwner: 'Priya',
    dueDate: '2026-11-27', recoveryMetric: 'form_submit key events back above 5/day' } });
  assert.equal(saved.status, 201, JSON.stringify(saved));
  assert.equal((await request(path, { owner: 'bob' })).status, 404);
  const done = await request(path + '/' + saved.data.review.id, { method: 'PATCH', body: { status: 'done' } });
  assert.equal(done.data.review.status, 'done');
  const list = await request(path);
  assert.equal(list.data.reviews.length, 1);
  assert.equal(list.data.reviews[0].recoveryMetric, 'form_submit key events back above 5/day');
});

function gaBinding(clientId, latestSessions, now) {
  const points = [];
  for (let i = 2; i <= 30; i++) {
    const date = new Date(now.getTime() - i * DAY).toISOString().slice(0, 10);
    points.push({ date, sessions: i === 2 ? latestSessions : 100, users: 80, keyEvents: 6 });
  }
  return { id: 'b-' + clientId, clientId, source: 'ga4', profile: { timeZone: 'UTC' }, points,
    lastSync: now.toISOString(), lastAttempt: now.toISOString(), lastError: null };
}

test('signals carry an assignee, review outcome, evidence note and a complete timeline through recurrence', async t => {
  const { env, request } = workspace(t);
  const { data: { client } } = await request('/api/clients', { method: 'POST', body: { name: 'Atlas Clinic', domain: 'atlas.example' } });
  let sessions = 40, clock = Date.now() - 600_000;
  const run = () => runHealthChecks(env, 'alice', null, { now: new Date(clock += 1000),
    read: async () => ({ bindings: [gaBinding(client.id, sessions, new Date(clock))] }) });
  const first = await run();
  const alert = first.alerts.find(a => a.kind === 'drop');
  assert.equal(alert.severity, 'critical');
  assert.equal(alert.occurrences, 1);
  const path = '/api/alerts/' + alert.id;
  const assigned = await request(path, { method: 'PATCH', body: { status: 'acknowledged', assignee: 'Priya', outcome: 'actionable' } });
  assert.equal(assigned.status, 200, JSON.stringify(assigned));
  assert.ok(assigned.data.alert.acknowledgedAt);
  assert.equal(assigned.data.alert.assignee, 'Priya');
  const refused = await request(path, { method: 'PATCH', body: { status: 'resolved' } });
  assert.equal(refused.status, 400, 'Resolving requires the fix and its evidence');
  assert.equal((await request(path, { method: 'PATCH', body: { outcome: 'false_alarm' } })).status, 400);
  assert.equal((await request(path, { owner: 'bob' })).status, 404);
  const resolved = await request(path, { method: 'PATCH', body: { status: 'resolved',
    note: 'GTM trigger restored 26 Nov; consented test visit recorded generate_lead in DebugView.' } });
  assert.equal(resolved.status, 200, JSON.stringify(resolved));
  assert.ok(resolved.data.alert.resolvedAt);
  assert.match(resolved.data.alert.resolutionNote, /DebugView/);
  // Condition recovers, then returns: one item, recurrence counted and timeline kept.
  clock = Date.now(); sessions = 100; await run();
  sessions = 40; const again = await run();
  const recurred = again.alerts.find(a => a.id === alert.id);
  assert.equal(recurred.status, 'open');
  assert.equal(recurred.occurrences, 2);
  assert.equal(recurred.acknowledgedAt, null);
  assert.equal(recurred.assignee, 'Priya');
  const timeline = await request(path);
  assert.deepEqual(timeline.data.events.map(e => e.kind),
    ['detected', 'acknowledged', 'assigned', 'outcome', 'resolved', 'recovered', 'recurred']);
  assert.equal(again.alerts.filter(a => a.kind === 'drop').length, 1, 'continuing conditions stay deduplicated');
});

test('AI rates are filtered by prompt type and period, and failed runs stay outside the sample', async t => {
  const { request } = workspace(t);
  const { data: { client } } = await request('/api/clients', { method: 'POST', body: { name: 'Atlas Clinic', domain: 'atlas.example' } });
  const base = { clientId: client.id, engine: 'ChatGPT', language: 'English', city: 'Bengaluru' };
  const old = new Date(Date.now() - 40 * DAY).toISOString();
  // Mention without a first-party link, and a citation without a mention: the measures diverge.
  await request('/api/ai/observations', { method: 'POST', body: { ...base, promptType: 'branded', prompt: 'Where does Dr Rao consult?',
    answer: 'Dr Rao consults at Atlas Clinic in HSR Layout.', citations: [{ url: 'https://directory.example/dr-rao' }] } });
  await request('/api/ai/observations', { method: 'POST', body: { ...base, promptType: 'discovery', prompt: 'Which clinics in HSR Layout offer spine consultations?',
    answer: 'Several clinics offer this service.', citations: [{ url: 'https://atlas.example/spine' }] } });
  await request('/api/ai/observations', { method: 'POST', body: { ...base, promptType: 'discovery', prompt: 'Spine clinics near me', observedAt: old,
    answer: 'Atlas Clinic is one option.', citations: [] } });
  assert.equal((await request('/api/ai/observations', { method: 'POST', body: { ...base, promptType: 'generic', prompt: 'x', answer: 'y' } })).status, 400);
  const failure = await request('/api/ai/failures', { method: 'POST', body: { clientId: client.id, engine: 'Perplexity',
    promptType: 'discovery', prompt: 'Spine clinics in HSR Layout', error: 'Engine returned an error page' } });
  assert.equal(failure.status, 201, JSON.stringify(failure));
  const all = await request('/api/ai?clientId=' + client.id);
  assert.deepEqual([all.data.summary.samples, all.data.summary.mentions, all.data.summary.citations], [3, 2, 1]);
  assert.equal(all.data.failedCount, 1);
  const discovery28 = await request('/api/ai?clientId=' + client.id + '&promptType=discovery&days=28');
  assert.deepEqual([discovery28.data.summary.samples, discovery28.data.summary.mentions, discovery28.data.summary.citations], [1, 0, 1]);
  assert.equal(discovery28.data.summary.citationRate, 100);
  const branded = await request('/api/ai?promptType=branded');
  assert.equal(branded.data.summary.mentionRate, 100);
  assert.equal(branded.data.observations[0].city, 'Bengaluru');
  assert.equal(branded.data.failedCount, 0);
  assert.equal((await request('/api/ai?days=12')).status, 400);
});

test('a client can be offboarded with its mappings, signals, evidence and reviews removed', async t => {
  const { env, request } = workspace(t, googleEnv());
  const keep = (await request('/api/clients', { method: 'POST', body: { name: 'Keep', domain: 'keep.example' } })).data.client;
  const gone = (await request('/api/clients', { method: 'POST', body: { name: 'Gone', domain: 'gone.example' } })).data.client;
  await request('/api/google/accounts'); // bootstrap Google tables
  await env.DB.prepare(`INSERT INTO google_accounts(id,owner,subject,email,encrypted,scopes,connectedAt) VALUES('acc','alice','s','a@example.test','x','',?)`).bind(new Date().toISOString()).run();
  for (const c of [keep, gone]) {
    await env.DB.prepare(`INSERT INTO google_bindings(id,owner,clientId,accountId,source,resourceId,label) VALUES(?,?,?,?,?,?,?)`)
      .bind('bind-' + c.id, 'alice', c.id, 'acc', 'gsc', 'sc-domain:' + c.domain, c.domain).run();
    await request('/api/ai/observations', { method: 'POST', body: { clientId: c.id, engine: 'ChatGPT', prompt: 'p', answer: c.name } });
    await request('/api/clients/' + c.id + '/reviews', { method: 'POST', body: { weekOf: '2026-11-23', nextAction: 'n', actionOwner: 'o' } });
  }
  await runHealthChecks(env, 'alice', null, { now: new Date(), read: async () => ({ bindings: [keep, gone].map(c => ({
    id: 'bind-' + c.id, clientId: c.id, source: 'gsc', points: [], lastError: 'Google denied access.', lastAttempt: new Date().toISOString() })) }) });
  assert.equal((await request('/api/clients/' + gone.id, { method: 'DELETE', owner: 'bob' })).status, 404);
  const removed = await request('/api/clients/' + gone.id, { method: 'DELETE' });
  assert.equal(removed.status, 200, JSON.stringify(removed));
  const count = async (sql) => (await env.DB.prepare(sql).bind(gone.id).first()).n;
  assert.equal(await count('SELECT COUNT(*) n FROM google_bindings WHERE clientId=?'), 0);
  assert.equal(await count('SELECT COUNT(*) n FROM signal_alerts WHERE client_id=?'), 0);
  assert.equal(await count('SELECT COUNT(*) n FROM ai_observations WHERE client_id=?'), 0);
  assert.equal(await count('SELECT COUNT(*) n FROM client_reviews WHERE client_id=?'), 0);
  const left = await request('/api/google/data');
  assert.deepEqual(left.data.bindings.map(b => b.clientId), [keep.id]);
  assert.equal((await request('/api/alerts')).data.alerts.every(a => a.clientId === keep.id), true);
});

test('a signal can be located by page and query against a matched comparison date', async t => {
  const { env, request } = workspace(t, googleEnv());
  const client = (await request('/api/clients', { method: 'POST', body: { name: 'Atlas', domain: 'atlas.example' } })).data.client;
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input.url || input);
    if (url.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'access' });
    if (url.hostname === 'www.googleapis.com' && url.pathname.endsWith('/searchAnalytics/query')) {
      const body = JSON.parse(init.body);
      assert.deepEqual(body.dimensions, ['page']);
      assert.equal(body.startDate, body.endDate);
      return Response.json({ rows: body.startDate === '2026-11-16' ? [
        { keys: ['https://atlas.example/spine'], clicks: 10, impressions: 400, position: 9.1 },
        { keys: ['https://atlas.example/'], clicks: 30, impressions: 600, position: 3 },
      ] : [
        { keys: ['https://atlas.example/spine'], clicks: 50, impressions: 420, position: 4.2 },
        { keys: ['https://atlas.example/'], clicks: 31, impressions: 610, position: 3 },
      ] });
    }
    throw new Error('Unexpected provider call ' + url);
  });
  await request('/api/google/accounts');
  const scope = 'https://www.googleapis.com/auth/webmasters.readonly';
  await connectAccount(env, scope);
  await env.DB.prepare(`INSERT INTO google_bindings(id,owner,clientId,accountId,source,resourceId,label) VALUES('gsc1','alice',?,'acc','gsc','sc-domain:atlas.example','atlas.example')`).bind(client.id).run();
  assert.equal((await request('/api/google/breakdown?bindingId=nope&dimension=page&date=2026-11-16')).status, 404);
  const located = await request('/api/google/breakdown?bindingId=gsc1&dimension=page&date=2026-11-16');
  assert.equal(located.status, 200, JSON.stringify(located));
  assert.equal(located.data.compareDate, '2026-11-09');
  assert.equal(located.data.rows[0].key, 'https://atlas.example/spine');
  assert.equal(located.data.rows[0].clicksChange, -40);
  assert.equal(located.data.rows[0].positionPrevious, 4.2);
  assert.equal(located.data.totals.clicks, 40);
  assert.equal(located.data.totals.clicksPrevious, 81);
  assert.equal((await request('/api/google/breakdown?bindingId=gsc1&dimension=browser&date=2026-11-16')).status, 400);
  assert.equal((await request('/api/google/breakdown?bindingId=gsc1&dimension=page&date=2099-01-01')).status, 400);
  assert.equal((await request('/api/google/breakdown?bindingId=gsc1&dimension=page&date=2026-11-16', { owner: 'bob' })).status, 404);
});

async function connectAccount(env, scope) {
  // Encrypt a refresh credential exactly as the OAuth callback does.
  const key = await crypto.subtle.importKey('raw', Buffer.from(env.GOOGLE_TOKEN_KEY, 'base64url'), { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(JSON.stringify(['alice', 'sub'])) },
    key, new TextEncoder().encode('refresh'));
  const b64 = bytes => Buffer.from(bytes).toString('base64url');
  await env.DB.prepare(`INSERT INTO google_accounts(id,owner,subject,email,encrypted,scopes,connectedAt) VALUES('acc','alice','sub','a@example.test',?,?,?)`)
    .bind('1.' + b64(iv) + '.' + b64(new Uint8Array(ct)), 'openid email ' + scope, new Date().toISOString()).run();
}

test('the scheduler batch size follows SYNC_BATCH_LIMIT within safe bounds', async t => {
  const { env, request } = workspace(t, { CRON_SECRET: CRON, SYNC_BATCH_LIMIT: '12' });
  await request('/api/clients', { method: 'POST', body: { name: 'Atlas', domain: 'atlas.example' } });
  const run = await request('/api/jobs/tick', { method: 'POST', owner: null, headers: {} });
  assert.equal(run.data.run.batchLimit, 12, JSON.stringify(run));
  env.SYNC_BATCH_LIMIT = '500';
  await env.DB.prepare('DELETE FROM desk_job_runs').run();
  assert.equal((await request('/api/jobs/tick', { method: 'POST', owner: null })).data.run.batchLimit, 25);
});

test('the overview reports GA4 period totals, weighted CTR and impressions-weighted position on matched days', () => {
  const now = new Date(), key = i => new Date(now.getTime() - i * DAY).toISOString().slice(0, 10);
  const gsc = [], ga = [];
  for (let i = 1; i <= 14; i++) {
    const current = i <= 7;
    gsc.push({ date: key(i), clicks: current ? 20 : 10, impressions: current ? 400 : 400, position: current ? 5 : 8 });
    ga.push({ date: key(i), sessions: current ? 110 : 100, users: 90, keyEvents: current ? 3 : 6, aiSessions: 1 });
  }
  const vm = composeOverview({ mode: 'live', range: 7, clients: [{ id: 'one', name: 'Atlas' }], bindings: [
    { clientId: 'one', source: 'gsc', points: gsc }, { clientId: 'one', source: 'ga4', points: ga }] });
  assert.equal(vm.metrics.sessions.value, 770);
  assert.equal(Math.round(vm.metrics.sessions.delta), 10);
  assert.equal(vm.metrics.keyEvents.value, 21);
  assert.equal(vm.metrics.keyEvents.delta, -50);
  assert.equal(vm.metrics.aiSessions.value, 7);
  assert.equal(vm.metrics.ctr.value, 0.05);
  assert.equal(vm.metrics.ctr.previous, 0.025);
  assert.equal(vm.metrics.position.value, 5);
  assert.equal(vm.metrics.position.previous, 8);
  const empty = composeOverview({ mode: 'live', range: 7, clients: [{ id: 'one', name: 'Atlas' }], bindings: [
    { clientId: 'one', source: 'gsc', points: [{ date: key(1), clicks: 0, impressions: 0, position: 0 }] }] });
  assert.equal(empty.metrics.ctr.value, null, 'A zero denominator yields an unavailable rate');
  assert.equal(empty.metrics.position.value, null);
});
