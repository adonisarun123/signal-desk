// Exercise the same authenticated request/response boundary as the deployed Worker.
// Run on Node 24+ with `node --test test/integration.test.mjs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { handleApi } from '../server/router.js';
import { memoryD1 } from './d1.mjs';

const CRON = 'test-cron-secret-0123456789';

const site = 'https://desk.example';
const userA = 'owner-a';
const userB = 'owner-b';

function workspace(t) {
  const env = { DB: memoryD1({migrations:true}) };
  t.after(() => env.DB.close());
  async function request(path, { method = 'GET', owner = userA, body, origin = site, headers = {} } = {}) {
    const h = new Headers(headers);
    if (path.startsWith('/api/jobs/') && env.CRON_SECRET && !h.has('Authorization')) h.set('Authorization', 'Bearer ' + env.CRON_SECRET);
    if (origin && method !== 'GET') h.set('Origin', origin);
    if (body !== undefined) h.set('Content-Type', 'application/json');
    const r = await handleApi(new Request(site + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env, owner || null);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, ok: r.ok, data, headers: r.headers };
  }
  async function addClient(owner = userA) {
    const response = await request('/api/clients', { method: 'POST', owner, body: {
      name: 'Atlas Clinic', domain: 'atlas.example',
    } });
    assert.equal(response.ok, true, JSON.stringify(response));
    const result = await request('/api/clients', { owner });
    assert.equal(result.status, 200);
    const [client] = result.data.clients;
    assert.ok(client.id);
    return client;
  }
  return { request, addClient, env };
}

test('a new live workspace has empty health, evidence and source data', async t => {
  const { request } = workspace(t);
  const clients = await request('/api/clients');
  assert.equal(clients.status, 200);
  assert.deepEqual(clients.data.clients, []);
  const google = await request('/api/google/accounts');
  assert.equal(google.status, 200);
  assert.deepEqual(google.data.accounts, []);
  assert.equal(google.data.setup.ready, false);
  const alerts = await request('/api/alerts');
  assert.equal(alerts.status, 200);
  assert.deepEqual(alerts.data.alerts, []);
  assert.deepEqual(alerts.data.checks, []);
  const ai = await request('/api/ai');
  assert.equal(ai.status, 200);
  assert.deepEqual(ai.data.observations, []);
  assert.equal(ai.data.summary.samples, 0);
  assert.equal(ai.data.samplingAvailable, false);
});

test('anonymous reads and cross-origin writes are rejected', async t => {
  const { request } = workspace(t);
  for (const path of ['/api/clients', '/api/alerts', '/api/ai', '/api/google/accounts', '/api/settings']) {
    const response = await request(path, { owner: null });
    assert.equal(response.status, 401, path);
  }
  const response = await request('/api/clients', { method: 'POST', origin: 'https://other.example',
    body: { name: 'Example', domain: 'example.com' } });
  assert.equal(response.status, 403);
  const clients = await request('/api/clients');
  assert.deepEqual(clients.data.clients, []);
});

test('two owners can independently manage the same domain and a repeated add does not duplicate it', async t => {
  const { request, addClient } = workspace(t);
  const a = await addClient();
  const beforeB = await request('/api/clients', { owner: userB });
  assert.deepEqual(beforeB.data.clients, []);
  const repeat = await request('/api/clients', { method: 'POST', body: { name: 'Atlas Clinic', domain: 'atlas.example' } });
  assert.ok(repeat.status === 409 || repeat.ok);
  const b = await addClient(userB);
  assert.notEqual(a.id, b.id);
  const afterA = await request('/api/clients');
  assert.deepEqual(afterA.data.clients.map(row => row.id), [a.id]);
  const afterB = await request('/api/clients', { owner: userB });
  assert.deepEqual(afterB.data.clients.map(row => row.id), [b.id]);
});

test('inbox and AI evidence stay inside the owning workspace', async t => {
  const { request, addClient } = workspace(t);
  const client = await addClient();
  const body = {
    clientId: client.id, engine: 'ChatGPT', prompt: 'Which clinic is mentioned?',
    answer: 'Atlas Clinic is listed.', citations: [{ title: 'Clinic', url: 'https://atlas.example/contact' }],
  };
  const forbidden = await request('/api/ai/observations', { method: 'POST', owner: userB, body });
  assert.equal(forbidden.status, 404);
  const result = await request('/api/ai/observations', { method: 'POST', body });
  assert.equal(result.ok, true, JSON.stringify(result));
  const ai = await request('/api/ai?clientId=' + client.id);
  assert.equal(ai.status, 200);
  assert.equal(ai.data.summary.samples, 1);
  assert.equal(ai.data.summary.mentions, 1);
  assert.equal(ai.data.summary.citations, 1);
  assert.equal(ai.data.observations[0].method, 'manual');
  const other = await request('/api/ai', { owner: userB });
  assert.deepEqual(other.data.observations, []);
  const health = await request('/api/alerts/check', { method: 'POST', body: {clientId: client.id} });
  assert.equal(health.ok, true, JSON.stringify(health));
  const healthB = await request('/api/alerts/check', { method: 'POST', owner: userB, body: {clientId: client.id} });
  assert.equal(healthB.status, 404);
});

test('scheduler preferences persist per owner and a missing OAuth setup fails cleanly', async t => {
  const { request } = workspace(t);
  const settingsOf = async (owner) => {
    const r = await request('/api/settings', {owner});
    assert.equal(r.status, 200);
    return r.data.settings ?? r.data;
  };
  const beforeB = await settingsOf(userB);
  const patch = await request('/api/settings', {method: 'PATCH', body: {scheduleEnabled: !beforeB.scheduleEnabled}});
  assert.equal(patch.ok, true, JSON.stringify(patch));
  assert.equal((await settingsOf(userA)).scheduleEnabled, !beforeB.scheduleEnabled);
  assert.equal((await settingsOf(userB)).scheduleEnabled, beforeB.scheduleEnabled);
  const start = await request('/api/google/start', {method: 'POST', body: {includeBusiness:false}});
  assert.ok(start.status >= 400);
  assert.equal(typeof start.data.error, 'string');
  const listed = await request('/api/google/accounts');
  assert.deepEqual(listed.data.accounts, []);
});

test('unattended checks need private service access and tolerate duplicate delivery', async t => {
  const { request, env, addClient } = workspace(t);
  const denied = await request('/api/jobs/tick', { method: 'POST', owner: null });
  assert.ok([401, 403].includes(denied.status));
  await addClient();
  env.CRON_SECRET = CRON;
  const first = await request('/api/jobs/tick', { method: 'POST', owner: null, origin: null });
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.data.alreadyRun, false);
  const repeat = await request('/api/jobs/tick', { method: 'POST', owner: null, origin: null });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.data.alreadyRun, true);
  const last = await request('/api/jobs/status', { owner: null });
  assert.equal(last.status, 200);
  assert.ok(last.data.lastRun);
});

test('authorized GA4 property travels from discovery to sync and health inbox', async t => {
  // Every provider response is a controlled fixture. Unexpected outbound calls fail this test.
  const {request, addClient, env} = workspace(t);
  Object.assign(env, {
    GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'fixture-secret',
    GOOGLE_REDIRECT_URI: site + '/api/google/callback',
    GOOGLE_TOKEN_KEY: Buffer.alloc(32, 7).toString('base64url'),
  });
  const date = new Date();
  const days = Array.from({length: 32}, (_, index) =>
    new Date(date.getTime() - (index + 2) * 86400000).toISOString().slice(0,10).replaceAll('-', ''));
  const responses = {
    token: { access_token:'fixture-access', refresh_token:'fixture-refresh', scope:'openid email https://www.googleapis.com/auth/analytics.readonly' },
    user: { sub:'fixture-subject', email:'fixture@example.test', email_verified:true },
    property: {name:'properties/123', displayName:'Test property', timeZone:'Asia/Kolkata'},
  };
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input.url || input);
    if (url.hostname === 'oauth2.googleapis.com') return Response.json(responses.token);
    if (url.hostname === 'openidconnect.googleapis.com') return Response.json(responses.user);
    if (url.hostname === 'analyticsadmin.googleapis.com') {
      return Response.json(url.pathname.endsWith('/accountSummaries') ? {
        accountSummaries:[{ account:'accounts/17', displayName:'Fixture account', propertySummaries:[{property:'properties/123',displayName:'Test property'}] }],
      } : responses.property);
    }
    if (url.hostname === 'analyticsdata.googleapis.com' && url.pathname.endsWith(':runRealtimeReport')) {
      return Response.json({rows:[{metricValues:[{value:'6'}]}]});
    }
    if (url.hostname === 'analyticsdata.googleapis.com' && url.pathname.endsWith(':runReport')) {
      const body = JSON.parse(init.body);
      if (body.dimensionFilter) return Response.json({rows:[]});
      return Response.json({rows:days.map((d,i) => ({
        dimensionValues:[{value:d}], metricValues:[{value:i === 0 ? '12':'200'}, {value:'10'}, {value:'6'}],
      }))});
    }
    throw new Error('Unconfigured provider in test: ' + url.hostname);
  });
  const client = await addClient();
  const start = await request('/api/google/start',{method:'POST', body:{includeBusiness:false}});
  assert.equal(start.ok,true,JSON.stringify(start));
  const googleUrl = new URL(start.data.url);
  assert.equal(googleUrl.hostname,'accounts.google.com');
  const state = googleUrl.searchParams.get('state');
  assert.ok(state);
  const callback = '/api/google/callback?code=fixture&state=' + encodeURIComponent(state);
  const approved = await request(callback);
  assert.ok(approved.status >= 300 && approved.status < 400,JSON.stringify(approved));
  const accounts = await request('/api/google/accounts');
  assert.equal(accounts.data.accounts.length,1);
  const userAccount = accounts.data.accounts[0];
  assert.equal(userAccount.email,responses.user.email);
  assert.equal(JSON.stringify(accounts.data).includes('fixture-refresh'),false);
  const discovery = await request('/api/google/discover?accountId=' + userAccount.id + '&source=ga4');
  assert.equal(discovery.status,200,JSON.stringify(discovery));
  const resource = discovery.data.resources[0];
  const body = { clientId:client.id, accountId:userAccount.id, source:'ga4', resourceId:resource.id };
  const binding = await request('/api/google/bindings',{method:'POST',body});
  assert.equal(binding.ok,true,JSON.stringify(binding));
  env.CRON_SECRET = CRON;
  const scheduled = await request('/api/jobs/tick',{method:'POST',owner:null,origin:null});
  assert.equal(scheduled.ok,true,JSON.stringify(scheduled));
  assert.equal(scheduled.data.run.synced,1,'Successful provider syncs must be counted by the scheduled job');
  assert.equal(scheduled.data.run.newCritical,1);
  const sync = await request('/api/google/sync',{method:'POST',body:{clientId:client.id}});
  assert.equal(sync.ok,true,JSON.stringify(sync));
  const actual = await request('/api/google/data?clientId=' + client.id);
  assert.equal(actual.status,200);
  assert.ok(actual.data.bindings[0].points.length > 30,JSON.stringify(actual));
  assert.equal(actual.data.bindings[0].points.at(-1).sessions,12);
  const evaluated = await request('/api/alerts/check',{method:'POST',body:{clientId:client.id}});
  assert.equal(evaluated.ok,true,JSON.stringify(evaluated));
  const alerts = await request('/api/alerts');
  const anomaly = alerts.data.alerts.find(a => a.kind === 'drop');
  assert.equal(anomaly?.severity,'critical',JSON.stringify(alerts));
  const ack = await request('/api/alerts/' + anomaly.id,{method:'PATCH',body:{status:'acknowledged'}});
  assert.equal(ack.ok,true);
  const again = await request('/api/alerts/check',{method:'POST',body:{clientId:client.id}});
  assert.equal(again.data.alerts.find(a => a.id === anomaly.id)?.status,'acknowledged');
  const other = await request('/api/google/accounts',{owner:userB});
  assert.deepEqual(other.data.accounts,[]);
  assert.deepEqual(other.data.bindings,[]);
});
