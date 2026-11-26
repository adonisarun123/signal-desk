import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAuth, readSession, seal, ownerFor } from '../server/auth.js';
import { handleApi } from '../server/router.js';
import { memoryD1 } from './d1.mjs';

const site = 'https://desk.example';
const baseEnv = () => ({
  AUTH_SECRET: 'x'.repeat(40), ALLOWED_EMAILS: 'Arun@Example.com, ops@example.com',
  AUTH_GOOGLE_ID: 'client-123.apps.googleusercontent.com', AUTH_GOOGLE_SECRET: 'shh',
  OWNER_ID_OVERRIDES: 'arun@example.com=user-legacy-1',
});
const jwt = claims => 'h.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.s';
const cookieFrom = (res, name) => res.headers.getSetCookie().find(c => c.startsWith(name + '='))?.split(';')[0];

async function signInWith(t, env, claims) {
  const start = await handleAuth(new Request(site + '/api/auth/signin?return_to=%2F%3Fworkspace%3Dlive'), env);
  assert.equal(start.status, 302);
  const google = new URL(start.headers.get('Location'));
  assert.equal(google.origin, 'https://accounts.google.com');
  assert.equal(google.searchParams.get('redirect_uri'), site + '/api/auth/callback');
  assert.equal(google.searchParams.get('code_challenge_method'), 'S256');
  const flow = cookieFrom(start, 'sd_signin');
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert.ok(new URLSearchParams(init.body).get('code_verifier'));
    return Response.json({ id_token: jwt(claims) });
  };
  return handleAuth(new Request(site + '/api/auth/callback?code=abc&state=' + google.searchParams.get('state'), { headers: { Cookie: flow } }), env);
}
const valid = (over = {}) => ({ iss: 'https://accounts.google.com', aud: 'client-123.apps.googleusercontent.com',
  exp: Math.floor(Date.now() / 1000) + 300, email: 'ARUN@example.com', email_verified: true, sub: '42', ...over });

test('an allowlisted Google account gets a signed session bound to its workspace id', async t => {
  const env = baseEnv();
  const done = await signInWith(t, env, valid());
  assert.equal(done.status, 302);
  assert.equal(done.headers.get('Location'), '/?workspace=live');
  const session = cookieFrom(done, 'sd_session');
  const attributes = done.headers.getSetCookie().find(c => c.startsWith('sd_session='));
  assert.match(attributes, /HttpOnly/);
  assert.match(attributes, /Secure/);
  const who = await readSession(new Request(site + '/api/clients', { headers: { Cookie: session } }), env);
  assert.deepEqual(who, { email: 'arun@example.com', owner: 'user-legacy-1' });
  // Removing the email from the allowlist revokes existing sessions.
  assert.equal(await readSession(new Request(site, { headers: { Cookie: session } }), { ...env, ALLOWED_EMAILS: 'ops@example.com' }), null);
});

test('unlisted, unverified or foreign-audience identities are refused', async t => {
  assert.equal((await signInWith(t, baseEnv(), valid({ email: 'stranger@example.com' }))).status, 403);
  assert.equal((await signInWith(t, baseEnv(), valid({ email_verified: false }))).status, 403);
  assert.equal((await signInWith(t, baseEnv(), valid({ aud: 'someone-else' }))).status, 502);
  assert.equal((await signInWith(t, { ...baseEnv(), ALLOWED_EMAILS: '' }, valid())).status, 403);
});

test('a callback without the matching sign-in cookie is rejected', async () => {
  const res = await handleAuth(new Request(site + '/api/auth/callback?code=abc&state=forged'), baseEnv());
  assert.equal(res.status, 400);
});

test('tampered or expired session cookies are ignored', async () => {
  const env = baseEnv();
  const good = await seal(env, { kind: 'session', email: 'ops@example.com', exp: Math.floor(Date.now() / 1000) + 60 });
  const read = c => readSession(new Request(site, { headers: { Cookie: 'sd_session=' + c } }), env);
  assert.deepEqual(await read(good), { email: 'ops@example.com', owner: 'ops@example.com' });
  const [body, sig] = good.split('.');
  const forged = Buffer.from(JSON.stringify({ kind: 'session', email: 'arun@example.com', exp: 9e9 })).toString('base64url');
  assert.equal(await read(forged + '.' + sig), null);
  assert.equal(await read(body + '.' + sig.slice(0, -2) + 'AA'), null);
  assert.equal(await read(await seal(env, { kind: 'session', email: 'ops@example.com', exp: 1 })), null);
  assert.equal(await read(await seal({ AUTH_SECRET: 'y'.repeat(40) }, { kind: 'session', email: 'ops@example.com', exp: 9e9 })), null);
  assert.equal(ownerFor(env, 'nobody@example.com'), 'nobody@example.com');
});

test('identity headers from the old host are not trusted', async t => {
  const env = { DB: memoryD1({ migrations: true }) };
  t.after(() => env.DB.close());
  const res = await handleApi(new Request(site + '/api/clients', { headers: { 'oai-authenticated-user-id': 'alice' } }), env);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).signIn, '/api/auth/signin?return_to=%2F');
});

test('the scheduler needs its bearer secret; a signed-in owner may only read status', async t => {
  const env = { DB: memoryD1({ migrations: true }), CRON_SECRET: 'c'.repeat(32) };
  t.after(() => env.DB.close());
  const call = (path, init = {}, owner = null) => handleApi(new Request(site + path, init), env, owner);
  assert.equal((await call('/api/jobs/tick')).status, 401);
  assert.equal((await call('/api/jobs/tick', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await call('/api/jobs/tick', {}, 'alice')).status, 401);
  const tick = await call('/api/jobs/tick', { headers: { Authorization: 'Bearer ' + 'c'.repeat(32) } });
  assert.equal(tick.status, 200, await tick.clone().text());
  assert.equal((await call('/api/jobs/status', {}, 'alice')).status, 200);
  assert.equal((await handleApi(new Request(site + '/api/jobs/tick', { headers: { Authorization: 'Bearer short' } }), { ...env, CRON_SECRET: 'short' })).status, 401);
});
