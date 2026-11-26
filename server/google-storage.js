import {GoogleIssue, googleFetch, scopes, nowIso} from './google-provider.js';

const init = new WeakMap();
const utf8 = new TextEncoder();
const text = new TextDecoder();
const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const DDL = [
  `CREATE TABLE IF NOT EXISTS google_configs (
    owner TEXT PRIMARY KEY, clientId TEXT NOT NULL, encrypted TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS google_accounts (
    id TEXT PRIMARY KEY, owner TEXT NOT NULL, subject TEXT NOT NULL, email TEXT NOT NULL,
    encrypted TEXT NOT NULL, scopes TEXT NOT NULL, connectedAt TEXT NOT NULL, lastError TEXT,
    UNIQUE(owner,subject))`,
  `CREATE TABLE IF NOT EXISTS google_states (
    digest TEXT PRIMARY KEY, owner TEXT NOT NULL, verifier TEXT NOT NULL, expires INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS google_bindings (
    id TEXT PRIMARY KEY, owner TEXT NOT NULL, clientId TEXT NOT NULL, accountId TEXT NOT NULL,
    source TEXT NOT NULL, resourceId TEXT NOT NULL, label TEXT NOT NULL, profile TEXT NOT NULL DEFAULT '{}',
    points TEXT NOT NULL DEFAULT '[]', realtime TEXT, lastAttempt TEXT, lastSync TEXT, lastError TEXT,
    rtAttempt TEXT, rtError TEXT, lease TEXT, leaseUntil INTEGER DEFAULT 0, rtLease TEXT, rtUntil INTEGER DEFAULT 0,
    UNIQUE(owner,source,resourceId),
    FOREIGN KEY(accountId) REFERENCES google_accounts(id) ON DELETE CASCADE)`,
  'CREATE INDEX IF NOT EXISTS google_owner_client ON google_bindings(owner,clientId)',
  'CREATE INDEX IF NOT EXISTS google_states_expires ON google_states(expires)'
];
export async function initGoogle(env) {
  if (!env.DB) throw new GoogleIssue(503,'DATABASE_SETUP','The workspace database is not configured.');
  if (!init.has(env.DB)) {
    const setup = env.DB.batch(DDL.map(sql => env.DB.prepare(sql))).catch(error => {init.delete(env.DB);throw error;});
    init.set(env.DB,setup);
  }
  await init.get(env.DB);
}
export const allRows = async statement => (await statement.all()).results || [];
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const decode = value => Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const rand = n => encode(crypto.getRandomValues(new Uint8Array(n)));
const digest = async value => encode(await crypto.subtle.digest('SHA-256',utf8.encode(value)));
function isKey(value) {
  try {return typeof value === 'string' && decode(value).length === 32;} catch {return false;}
}
export function googleSetup(env) {
  const missing = ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_TOKEN_KEY','GOOGLE_REDIRECT_URI'].filter(k=>!env[k]);
  if (env.GOOGLE_TOKEN_KEY && !isKey(env.GOOGLE_TOKEN_KEY)) missing.push('valid GOOGLE_TOKEN_KEY');
  let redirectUri = null;
  if (env.GOOGLE_REDIRECT_URI) {
    try {
      const url = new URL(env.GOOGLE_REDIRECT_URI);
      if (url.pathname !== '/api/google/callback' || url.search || url.hash || url.username || url.password ||
          (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1','localhost'].includes(url.hostname)))) throw new Error();
      redirectUri = url.href;
    } catch {missing.push('valid GOOGLE_REDIRECT_URI');}
  }
  return {ready:missing.length===0,missing,redirectUri,canConfigure:!!redirectUri && isKey(env.GOOGLE_TOKEN_KEY),configuredHere:!!env.googleWorkspaceConfig};
}
export function requireSetup(env) {
  const s = googleSetup(env);
  if (!s.ready) throw new GoogleIssue(503,'GOOGLE_SETUP','Set the Google OAuth credentials and callback URL in the deployment settings.');
  return s;
}
async function cryptoKey(env) {
  return crypto.subtle.importKey('raw',decode(env.GOOGLE_TOKEN_KEY),{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function encrypt(env, owner, sub, token) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:utf8.encode(JSON.stringify([owner,sub]))},await cryptoKey(env),utf8.encode(token));
  return '1.' + encode(iv) + '.' + encode(ct);
}
async function decrypt(env, row) {
  const [,iv,ct] = row.encrypted.split('.');
  try {
    return text.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(iv),additionalData:utf8.encode(JSON.stringify([row.owner,row.subject]))},
      await cryptoKey(env),decode(ct)));
  } catch {throw new GoogleIssue(503,'TOKEN_KEY','The saved connection cannot be opened. Restore its token encryption key or reconnect the account.');}
}
async function tokenRequest(env, params) {
  return googleFetch(tokenEndpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,...params})});
}
export function userAccount(row) {
  return {id:row.id,email:row.email,scopes:row.scopes.split(/\s+/).filter(Boolean),connectedAt:row.connectedAt,lastError:row.lastError};
}
export async function accountById(env, owner, id) {
  const a = await env.DB.prepare('SELECT * FROM google_accounts WHERE owner=? AND id=?').bind(owner,id).first();
  if (!a) throw new GoogleIssue(404,'ACCOUNT_NOT_FOUND','Google account not found in this workspace.');
  return a;
}
export async function getToken(env, row, source) {
  requireSetup(env);
  if (source && !row.scopes.split(' ').includes(scopes[source])) throw new GoogleIssue(403,'SCOPE_REQUIRED',
    'Reconnect the Google account and grant access to this data source.');
  try {
    const data = await tokenRequest(env,{grant_type:'refresh_token',refresh_token:await decrypt(env,row)});
    if (!data.access_token) throw new GoogleIssue(502,'TOKEN_FAILED','Google did not issue an access token.');
    if (data.refresh_token) {
      // Only update the token used in this request. A concurrent reconnection takes precedence.
      const encrypted = await encrypt(env,row.owner,row.subject,data.refresh_token);
      await env.DB.prepare('UPDATE google_accounts SET encrypted=? WHERE owner=? AND id=? AND encrypted=?').bind(encrypted,row.owner,row.id,row.encrypted).run();
    }
    return data.access_token;
  } catch (e) {
    if (e.code === 'RECONNECT') await env.DB.prepare('UPDATE google_accounts SET lastError=? WHERE owner=? AND id=? AND encrypted=?')
      .bind(e.message,row.owner,row.id,row.encrypted).run();
    throw e;
  }
}
export async function startOAuth(env, owner, withBusiness) {
  const config = requireSetup(env);
  const state = rand(32), verifier = rand(48);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM google_states WHERE expires<?').bind(Date.now()),
    env.DB.prepare('INSERT INTO google_states(digest,owner,verifier,expires) VALUES(?,?,?,?)').bind(await digest(state),owner,verifier,Date.now()+600000)
  ]);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const requestedScopes = ['openid','email',scopes.ga4,scopes.gsc];
  if (withBusiness) requestedScopes.push(scopes.gbp);
  url.search = new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:config.redirectUri,response_type:'code',
    scope:requestedScopes.join(' '),state,access_type:'offline',prompt:'consent select_account',include_granted_scopes:'true',
    code_challenge:await digest(verifier),code_challenge_method:'S256'}).toString();
  return {url:url.href};
}
export async function finishOAuth(env, owner, url) {
  const config = requireSetup(env);
  const state = url.searchParams.get('state') || '';
  if (state.length > 180) throw new GoogleIssue(400,'INVALID_STATE','The Google connection request is invalid. Start a new connection.');
  const pending = await env.DB.prepare('DELETE FROM google_states WHERE digest=? AND owner=? AND expires>? RETURNING verifier')
    .bind(await digest(state),owner,Date.now()).first();
  if (!pending) throw new GoogleIssue(400,'INVALID_STATE','The Google connection request expired or was already used. Start a new connection.');
  if (url.searchParams.has('error')) return 'cancelled';
  if (url.searchParams.has('iss') && url.searchParams.get('iss') !== 'https://accounts.google.com')
    throw new GoogleIssue(400,'BAD_ISSUER','Unexpected authorization provider.');
  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) throw new GoogleIssue(400,'MISSING_CODE','Google did not provide an authorization code.');
  const grant = await tokenRequest(env,{code,code_verifier:pending.verifier,redirect_uri:config.redirectUri,grant_type:'authorization_code'});
  const user = await googleFetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+grant.access_token}});
  if (!user.sub || !user.email || !user.email_verified) throw new GoogleIssue(403,'NO_IDENTITY','A verified Google account email is required.');
  if (!(grant.scope || '').split(' ').some(scope=>Object.values(scopes).includes(scope))) throw new GoogleIssue(403,'SCOPE_REQUIRED','Google did not grant a reporting scope. Reconnect and select the reporting permissions.');
  const existing = await env.DB.prepare('SELECT id, encrypted FROM google_accounts WHERE owner=? AND subject=?').bind(owner,user.sub).first();
  const encrypted = grant.refresh_token ? await encrypt(env,owner,user.sub,grant.refresh_token) : existing?.encrypted;
  if (!encrypted) throw new GoogleIssue(409,'OFFLINE_REQUIRED','Google did not grant offline access. Reconnect and approve the requested permissions.');
  await env.DB.prepare(`INSERT INTO google_accounts(id,owner,subject,email,encrypted,scopes,connectedAt) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(owner,subject) DO UPDATE SET email=excluded.email, encrypted=excluded.encrypted,
    scopes=excluded.scopes,connectedAt=excluded.connectedAt,lastError=NULL`).bind(
    existing?.id || crypto.randomUUID(),owner,user.sub,user.email,encrypted,grant.scope || '',nowIso()).run();
  return 'connected';
}

// Each owner may supply an OAuth client without exposing either client secret or refresh credentials.
export async function googleEnv(env,owner) {
  if (env.googleWorkspaceConfig === owner) return env;
  const row = await env.DB.prepare('SELECT clientId,encrypted FROM google_configs WHERE owner=?').bind(owner).first();
  if (!row) return env;
  if (!isKey(env.GOOGLE_TOKEN_KEY)) return env;
  const secret = await decrypt(env,{encrypted:row.encrypted,owner:'oauth-client:'+owner,subject:row.clientId});
  return {...env,DB:env.DB,GOOGLE_TOKEN_KEY:env.GOOGLE_TOKEN_KEY,GOOGLE_REDIRECT_URI:env.GOOGLE_REDIRECT_URI,googleWorkspaceConfig:owner,GOOGLE_CLIENT_ID:row.clientId,GOOGLE_CLIENT_SECRET:secret};
}
export async function saveGoogleConfig(env,owner,{clientId,clientSecret}) {
  if (!googleSetup(env).canConfigure) throw new GoogleIssue(503,'HOST_SETUP','Configure the deployment encryption key and Google callback URL before saving credentials.');
  if (typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{6,200}\.apps\.googleusercontent\.com$/.test(clientId.trim()))
    throw new GoogleIssue(400,'INVALID_CLIENT_ID','Enter the Google Cloud web application client ID ending in .apps.googleusercontent.com.');
  if (typeof clientSecret !== 'string' || !/^[A-Za-z0-9_.~-]{12,256}$/.test(clientSecret.trim()))
    throw new GoogleIssue(400,'INVALID_CLIENT_SECRET','Enter the client secret from the same Google Cloud web application.');
  const id=clientId.trim();
  const encrypted = await encrypt(env,'oauth-client:'+owner,id,clientSecret.trim());
  // The switch and pending-authorization cancellation occur in the same D1 transaction.
  const [saved] = await env.DB.batch([
    env.DB.prepare(`INSERT INTO google_configs(owner,clientId,encrypted) SELECT ?,?,?
      WHERE NOT EXISTS (SELECT 1 FROM google_accounts WHERE owner=?)
      ON CONFLICT(owner) DO UPDATE SET clientId=excluded.clientId,encrypted=excluded.encrypted`).bind(owner,id,encrypted,owner),
    env.DB.prepare('DELETE FROM google_states WHERE owner=? AND NOT EXISTS (SELECT 1 FROM google_accounts WHERE owner=?)').bind(owner,owner)
  ]);
  if (!saved.meta.changes) throw new GoogleIssue(409,'ACCOUNTS_CONNECTED','Disconnect the existing Google accounts before changing this OAuth application.');
  return {configured:true,setup:googleSetup(await googleEnv(env,owner))};
}

export function sealBusinessCache(env,owner,id,content) {
  return encrypt(env,'business-cache:'+owner,id,JSON.stringify(content));
}
export async function openBusinessCache(env,owner,id,encrypted) {
  return JSON.parse(await decrypt(env,{owner:'business-cache:'+owner,subject:id,encrypted}));
}
