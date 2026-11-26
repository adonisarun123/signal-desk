import {GoogleIssue, checkSource, checkResource, discover, resourceInfo, daily, realtime, businessPoints, nowIso, breakdown} from './google-provider.js';
import {initGoogle, allRows, userAccount, accountById, getToken, googleSetup, requireSetup, startOAuth, finishOAuth, googleEnv, saveGoogleConfig, sealBusinessCache, openBusinessCache} from './google-storage.js';
export {initGoogle,googleSetup};

// Raw Business Profile content is cached only for display in the owner's workspace.
// Workers Cache API expires the entry independently of future requests. D1 holds only the configured location ID.
const transient = new Map();
const businessTTL = 24 * 3600;
function cacheKey(env,id) {
  return new Request(new URL('/__private_cache/google-business/'+id, env.GOOGLE_REDIRECT_URI).href);
}
async function cacheBusiness(env,owner,id,content) {
  if (globalThis.caches?.default) {
    const cache = globalThis.caches.default;
    try {
      if (content) await cache.put(cacheKey(env,id),new Response(await sealBusinessCache(env,owner,id,content),{headers:{'Cache-Control':'max-age='+businessTTL,'Content-Type':'application/octet-stream'}}));
      else await cache.delete(cacheKey(env,id));
      transient.delete(id);
      return;
    } catch { /* The per-isolate bounded cache below also supports local development. */ }
  }
  transient.delete(id);
  if (!content) return;
  if (transient.size >= 64) transient.delete(transient.keys().next().value);
  transient.set(id,{owner,content,expires:Date.now()+businessTTL*1000});
}
async function businessCache(env,owner,id) {
  const cached = transient.get(id);
  if (cached?.owner===owner && cached.expires > Date.now()) return cached.content;
  transient.delete(id);
  if (!env.GOOGLE_REDIRECT_URI || !globalThis.caches?.default) return null;
  try {
    const result = await globalThis.caches.default.match(cacheKey(env,id));
    return result ? await openBusinessCache(env,owner,id,await result.text()) : null;
  } catch {return null;}
}
function output(data,status=200) {
  return Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
}
function requireOwner(owner) {
  if (!owner || typeof owner !== 'string') throw new GoogleIssue(401,'SIGN_IN','Sign in to access this workspace.');
}
function identifier(value,label='identifier') {
  if (typeof value !== 'string' || !value.length || value.length > 200) throw new GoogleIssue(400,'INVALID_ID','A valid '+label+' is required.');
  return value;
}
async function body(request) {
  if (!(request.headers.get('content-type') || '').startsWith('application/json'))
    throw new GoogleIssue(415,'JSON_REQUIRED','Send this request as JSON.');
  try {
    const data = await request.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch {throw new GoogleIssue(400,'INVALID_JSON','Invalid JSON request.');}
}
async function clientExists(env,owner,clientId) {
  identifier(clientId,'client ID');
  if (!await env.DB.prepare('SELECT id FROM clients WHERE owner=? AND id=?').bind(owner,clientId).first())
    throw new GoogleIssue(404,'CLIENT_NOT_FOUND','Client not found in this workspace.');
}
async function bindingView(env,row,withPoints) {
  const local = row.source === 'gbp' ? await businessCache(env,row.owner,row.id) : null;
  const profile = local?.profile || JSON.parse(row.profile);
  return {
    id:row.id,clientId:row.clientId,accountId:row.accountId,source:row.source,resourceId:row.resourceId,
    label:local?.profile?.title || row.label,profile,lastAttempt:row.lastAttempt,lastSync:row.lastSync,lastError:row.lastError,
    realtime:row.realtime ? JSON.parse(row.realtime) : null,realtimeError:row.rtError,realtimeAttempt:row.rtAttempt,
    ...(withPoints ? {points:row.source==='gbp' ? businessPoints(local?.raw) : JSON.parse(row.points)} : {})
  };
}
async function bindings(env,owner,clientId) {
  const stmt = clientId
    ? env.DB.prepare('SELECT * FROM google_bindings WHERE owner=? AND clientId=? ORDER BY clientId,source,label').bind(owner,clientId)
    : env.DB.prepare('SELECT * FROM google_bindings WHERE owner=? ORDER BY clientId,source,label').bind(owner);
  return allRows(stmt);
}
export async function readGoogle(env,owner,clientId) {
  requireOwner(owner);
  await initGoogle(env);
  const rows = await bindings(env,owner,clientId);
  return {bindings:await Promise.all(rows.map(r=>bindingView(env,r,true)))};
}
async function listAccounts(env,owner) {
  const [accounts,rows] = await Promise.all([
    allRows(env.DB.prepare('SELECT id,email,scopes,connectedAt,lastError FROM google_accounts WHERE owner=? ORDER BY email').bind(owner)),
    bindings(env,owner)
  ]);
  const setup = googleSetup(env);
  return {configured:setup.ready,setup,accounts:accounts.map(userAccount),bindings:await Promise.all(rows.map(r=>bindingView(env,r,false)))};
}
async function bind(env,owner,{clientId,accountId,source,resourceId}) {
  checkSource(source);
  checkResource(source,resourceId);
  await clientExists(env,owner,clientId);
  const account = await accountById(env,owner,identifier(accountId,'account ID'));
  const token = await getToken(env,account,source);
  const info = await resourceInfo(token,source,resourceId);
  const id = crypto.randomUUID();
  const isBusiness = source === 'gbp';
  await env.DB.prepare(`INSERT INTO google_bindings(id,owner,clientId,accountId,source,resourceId,label,profile)
    SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM clients WHERE id=? AND owner=?)
    ON CONFLICT(owner,source,resourceId) DO NOTHING`).bind(id,owner,clientId,accountId,source,resourceId,
    isBusiness ? resourceId : info.label,JSON.stringify(isBusiness ? {} : info.profile),clientId,owner).run();
  const saved = await env.DB.prepare('SELECT id,clientId,accountId FROM google_bindings WHERE owner=? AND source=? AND resourceId=?').bind(owner,source,resourceId).first();
  if (!saved || saved.clientId !== clientId || saved.accountId !== accountId)
    throw new GoogleIssue(409,'ALREADY_MAPPED','This property is already mapped or the client changed. Check its current mapping.');
  if (isBusiness && saved.id === id) await cacheBusiness(env,owner,id,{profile:info.profile});
  return {id:saved.id};
}
export async function removeGoogleClient(env,owner,clientId) {
  requireOwner(owner);
  await initGoogle(env);
  const removed = await allRows(env.DB.prepare('DELETE FROM google_bindings WHERE owner=? AND clientId=? RETURNING id,source').bind(owner,clientId));
  await Promise.all(removed.filter(x=>x.source==='gbp').map(x=>cacheBusiness(env,owner,x.id,null)));
}
async function disconnect(env,owner,id) {
  await accountById(env,owner,id);
  const [removed] = await env.DB.batch([
    env.DB.prepare('DELETE FROM google_bindings WHERE owner=? AND accountId=? RETURNING id,source').bind(owner,id),
    env.DB.prepare('DELETE FROM google_accounts WHERE owner=? AND id=?').bind(owner,id)
  ]);
  await Promise.all((removed.results || []).filter(x=>x.source==='gbp').map(x=>cacheBusiness(env,owner,x.id,null)));
}
async function refreshBinding(env,owner,binding,quick,tokenFor) {
  const {source,resourceId,id} = binding;
  const lease = crypto.randomUUID();
  const timestamp = nowIso();
  // Compare-and-swap leases also prevent late responses from overwriting newer observations.
  const leaseCol = quick ? 'rtLease' : 'lease';
  const untilCol = quick ? 'rtUntil' : 'leaseUntil';
  const attemptCol = quick ? 'rtAttempt' : 'lastAttempt';
  const cut = new Date(Date.now()-(quick ? 55000 : 300000)).toISOString();
  const claimed = await env.DB.prepare(`UPDATE google_bindings SET ${leaseCol}=?,${untilCol}=?,${attemptCol}=? WHERE owner=? AND id=?
    AND ${untilCol}<=? AND (${attemptCol} IS NULL OR ${attemptCol}<=?)`).bind(lease,Date.now()+90000,timestamp,owner,id,Date.now(),cut).run();
  if (!claimed.meta.changes) return {id,status:'skipped'};
  const complete = async (columns,params) => env.DB.prepare(`UPDATE google_bindings SET ${columns},${leaseCol}=NULL,${untilCol}=0 WHERE owner=? AND id=? AND ${leaseCol}=?`)
    .bind(...params,owner,id,lease).run();
  try {
    const token = await tokenFor(binding);
    if (quick) {
      const rt = await realtime(token,resourceId);
      await complete('realtime=?,rtError=NULL',[JSON.stringify(rt)]);
      return {id,status:'synced'};
    }
    const snapshot = await daily(token,source,resourceId,JSON.parse(binding.profile));
    const finished = nowIso();
    if (source==='gbp') {
      const res = await complete('lastSync=?,lastError=?',[finished,snapshot.partial || null]);
      if (res.meta.changes) await cacheBusiness(env,owner,id,{raw:snapshot.raw,profile:snapshot.profile});
    } else {
      await complete('points=?,profile=?,lastSync=?,lastError=?',[
        JSON.stringify(snapshot.points),JSON.stringify(snapshot.profile || JSON.parse(binding.profile)),finished,snapshot.partial || null]);
    }
    return {id,status:snapshot.partial ? 'partial' : 'synced',...(snapshot.partial ? {error:snapshot.partial} : {})};
  } catch(e) {
    const msg = e instanceof GoogleIssue ? e.message : 'Sync could not finish. Retry shortly.';
    await complete(quick ? 'rtError=?' : 'lastError=?',[msg]);
    return {id,status:'error',error:msg,code:e.code || 'SYNC_FAILED'};
  }
}
function reportDay(value,label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new GoogleIssue(400,'INVALID_DATE','Choose a valid '+label+'.');
  const t = Date.parse(value+'T00:00:00Z');
  if (!Number.isFinite(t) || !new Date(t).toISOString().startsWith(value)) throw new GoogleIssue(400,'INVALID_DATE','Choose a valid '+label+'.');
  const age = (Date.now()-t)/86400000;
  if (age < 0 || age > 480) throw new GoogleIssue(400,'INVALID_DATE','The '+label+' must be a completed day within the last 16 months.');
  return value;
}
async function locate(env,owner,params) {
  requireSetup(env);
  const id = identifier(params.get('bindingId'),'mapping');
  const row = await env.DB.prepare('SELECT * FROM google_bindings WHERE owner=? AND id=?').bind(owner,id).first();
  if (!row) throw new GoogleIssue(404,'BINDING_NOT_FOUND','Mapping not found in this workspace.');
  if (row.source === 'gbp') throw new GoogleIssue(400,'BREAKDOWN_UNSUPPORTED','Breakdowns are available for Analytics and Search Console properties.');
  const date = reportDay(params.get('date'),'reporting date');
  const fallback = new Date(Date.parse(date+'T00:00:00Z')-7*86400000).toISOString().slice(0,10);
  const compareDate = reportDay(params.get('compareDate') || fallback,'comparison date');
  if (compareDate === date) throw new GoogleIssue(400,'INVALID_DATE','Choose a comparison date different from the reporting date.');
  const token = await getToken(env,await accountById(env,owner,row.accountId),row.source);
  const result = await breakdown(token,row.source,row.resourceId,{dimension:params.get('dimension') || (row.source==='gsc'?'page':'landingPage'),
    date,compareDate,metric:params.get('metric')});
  return {bindingId:row.id,clientId:row.clientId,label:row.label,...result};
}
// Each pass limits provider requests and rotates oldest attempts first, including failed attempts.
export async function syncGoogle(env,owner,clientId,options={}) {
  requireOwner(owner);
  await initGoogle(env);
  env = await googleEnv(env,owner);
  const quick = options.realtime === true;
  const attemptCol = quick ? 'rtAttempt' : 'lastAttempt';
  const untilCol = quick ? 'rtUntil' : 'leaseUntil';
  // Interactive passes stay small. The scheduler can raise this with SYNC_BATCH_LIMIT as quota allows.
  const limit = Math.max(1,Math.min(Number.isInteger(options.limit) ? options.limit : 5,25));
  const args = [owner,Date.now(),new Date(Date.now()-(quick ? 55000 : 300000)).toISOString()];
  let where = `owner=? AND ${untilCol}<=? AND (${attemptCol} IS NULL OR ${attemptCol}<=?)`;
  if (clientId) {where += ' AND clientId=?';args.push(clientId);}
  if (quick) where += " AND source='ga4'";
  const due = await allRows(env.DB.prepare(`SELECT * FROM google_bindings WHERE ${where} ORDER BY ${attemptCol},id LIMIT ?`).bind(...args,limit+1));
  if (!due.length) return {processed:0,remaining:0,results:[]};
  const memo = new Map();
  const tokenFor = async b => {
    const key = b.accountId + ':' + b.source;
    if (!memo.has(key)) memo.set(key,accountById(env,owner,b.accountId).then(a=>getToken(env,a,b.source)));
    return memo.get(key);
  };
  const results = [];
  const rows = due.slice(0,limit);
  for (let index=0;index<rows.length;index+=2) {
    results.push(...await Promise.all(rows.slice(index,index+2).map(r=>refreshBinding(env,owner,r,quick,tokenFor))));
  }
  return {processed:results.filter(r=>r.status!=='skipped').length,remaining:due.length>limit ? 1 : 0,results};
}
export async function handleGoogle(request,env,owner) {
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/google\/?/,'').replace(/\/$/,'');
  try {
    requireOwner(owner);
    const mutation = !['GET','HEAD'].includes(request.method);
    const origin = request.headers.get('origin');
    if (mutation && ((origin && origin!==url.origin) || request.headers.get('sec-fetch-site')==='cross-site'))
      throw new GoogleIssue(403,'BAD_ORIGIN','Make this change from your dashboard.');
    await initGoogle(env);
    if (request.method === 'POST' && route === 'config') return output(await saveGoogleConfig(env,owner,await body(request)));
    env = await googleEnv(env,owner);
    if (request.method === 'GET' && route === 'accounts') return output(await listAccounts(env,owner));
    if (request.method === 'POST' && route === 'start') {
      const input = await body(request);
      return output(await startOAuth(env,owner,input.includeBusiness===true));
    }
    if (request.method === 'GET' && route === 'callback') {
      const result = await finishOAuth(env,owner,url);
      return new Response(null,{status:303,headers:{Location:'/?google='+result+'#connections','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }
    if (request.method === 'GET' && route === 'discover') {
      requireSetup(env);
      const source = url.searchParams.get('source');
      checkSource(source);
      const a = await accountById(env,owner,identifier(url.searchParams.get('accountId'),'account ID'));
      return output(await discover(await getToken(env,a,source),source,url.searchParams.get('pageToken')));
    }
    if (request.method === 'POST' && route === 'bindings') return output(await bind(env,owner,await body(request)),201);
    if (request.method === 'GET' && route === 'breakdown') return output(await locate(env,owner,url.searchParams));
    if (request.method === 'GET' && route === 'data') return output(await readGoogle(env,owner,url.searchParams.get('clientId')));
    if (request.method === 'POST' && ['sync','realtime'].includes(route)) {
      const {clientId} = await body(request);
      if (clientId) await clientExists(env,owner,clientId);
      return output(await syncGoogle(env,owner,clientId,{realtime:route==='realtime'}));
    }
    if (request.method === 'DELETE' && /^accounts\/[^/]+$/.test(route)) {
      await disconnect(env,owner,identifier(route.split('/')[1]));
      return output({ok:true});
    }
    if (request.method === 'DELETE' && /^bindings\/[^/]+$/.test(route)) {
      const row = await env.DB.prepare('DELETE FROM google_bindings WHERE owner=? AND id=? RETURNING id,source')
        .bind(owner,identifier(route.split('/')[1])).first();
      if (!row) throw new GoogleIssue(404,'BINDING_NOT_FOUND','Mapping not found in this workspace.');
      if (row.source==='gbp') await cacheBusiness(env,owner,row.id,null);
      return output({ok:true});
    }
    return output({error:'Google route not found.',code:'NOT_FOUND'},404);
  } catch (e) {
    const issue = e instanceof GoogleIssue ? e : new GoogleIssue(500,'GOOGLE_INTERNAL','The connection request could not finish. Retry shortly.');
    return output({error:issue.message,code:issue.code},issue.status);
  }
}
