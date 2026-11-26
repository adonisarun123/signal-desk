import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryD1} from './d1.mjs';
import {handleGoogle,readGoogle,syncGoogle} from '../server/google.js';
import {businessPoints,daily,scopes} from '../server/google-provider.js';

const origin='https://signals.example';
const setup = async () => {
  const env={DB:memoryD1(),GOOGLE_REDIRECT_URI:origin+'/api/google/callback',GOOGLE_TOKEN_KEY:Buffer.alloc(32,13).toString('base64url')};
  await env.DB.exec("CREATE TABLE clients(id TEXT PRIMARY KEY,owner TEXT);INSERT INTO clients VALUES('clinic','owner'),('other','otherOwner');");
  return env;
};
const call=(env,route,owner='owner',method='GET',body=null,headers={})=>handleGoogle(new Request(origin+'/api/google/'+route,{method,
  headers:{'Content-Type':'application/json',origin,...headers},body:body?JSON.stringify(body):null}),env,owner);
const creds={clientId:'99999999-example.apps.googleusercontent.com',clientSecret:'GOCSPX-test-placeholder'};
const grantScopes='openid email '+Object.values(scopes).join(' ');
test('Google app credentials and authorization state are isolated, encrypted, single-use and cleared on rotation',async t=>{
  const env=await setup();t.after(()=>env.DB.close());
  assert.equal((await call(env,'config','owner','POST',creds,{origin:'https://unrelated.example'})).status,403);
  assert.equal((await call(env,'config','owner','POST',{clientId:'abc',clientSecret:'bad'})).status,400);
  const initial=await (await call(env,'accounts')).json();
  assert.equal(initial.configured,false);assert.equal(initial.setup.canConfigure,true);
  assert.equal((await call(env,'config','owner','POST',creds)).status,200);
  assert.ok(!(await (await call(env,'accounts')).text()).includes(creds.clientSecret));
  const saved=await env.DB.prepare('SELECT encrypted FROM google_configs').first();
  assert.ok(!saved.encrypted.includes(creds.clientSecret));
  assert.equal((await (await call(env,'accounts','otherOwner')).json()).configured,false);
  const link=async()=>new URL((await (await call(env,'start','owner','POST',{includeBusiness:true})).json()).url);
  const u=await link();assert.ok(u.searchParams.get('scope').includes(scopes.gbp));assert.equal(u.searchParams.get('code_challenge_method'),'S256');
  const state=u.searchParams.get('state');
  // An anonymous request or a different user cannot consume the grant.
  assert.equal((await call(env,'callback?state='+state+'&error=access_denied',null)).status,401);
  env.GOOGLE_CLIENT_ID=creds.clientId;env.GOOGLE_CLIENT_SECRET=creds.clientSecret;
  assert.equal((await call(env,'callback?state='+state+'&error=access_denied','otherOwner')).status,400);
  assert.equal((await call(env,'callback?state='+state+'&error=access_denied')).status,303);
  assert.equal((await call(env,'callback?state='+state+'&error=access_denied')).status,400);
  const abandoned=(await link()).searchParams.get('state');
  await call(env,'config','owner','POST',creds);
  assert.equal((await call(env,'callback?state='+abandoned+'&error=access_denied')).status,400);
});
test('mocked Google account connects, maps, syncs, preserves last success and disconnects',async t=>{
  const env=await setup(); t.after(()=>env.DB.close());
  const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch});
  let denied=false;
  globalThis.fetch=async (input,options)=>{
    const u=new URL(input);
    if(u.host==='oauth2.googleapis.com'){
      assert.equal(options.body.get('client_secret'),creds.clientSecret);
      if(options.body.get('grant_type')==='authorization_code'){
        assert.ok(options.body.has('code_verifier'));
        return Response.json({access_token:'access',refresh_token:'secret-refresh',scope:grantScopes});
      }
      assert.equal(options.body.get('refresh_token'),'secret-refresh');
      if(denied) return Response.json({error:'invalid_grant'},{status:400});
      return Response.json({access_token:'access'});
    }
    assert.equal(options.headers.Authorization,'Bearer access');
    if(u.host==='openidconnect.googleapis.com')return Response.json({sub:'g1',email:'fixture@example.org',email_verified:true});
    if(u.pathname.endsWith('/accountSummaries'))return Response.json({accountSummaries:[{displayName:'Test',propertySummaries:[{property:'properties/42',displayName:'Clinic'}]}],nextPageToken:'page-two'});
    if(u.host==='analyticsadmin.googleapis.com')return Response.json({name:'properties/42',displayName:'Clinic',timeZone:'Asia/Kolkata'});
    if(u.pathname.endsWith(':runRealtimeReport'))return Response.json({rows:[{metricValues:[{value:'8'}]}]});
    if(u.pathname.endsWith(':runReport')){
      const body=JSON.parse(options.body),values=body.metrics.length===1?['2']:['12','9','3'];
      return Response.json({rows:[{dimensionValues:[{value:'20261110'}],metricValues:values.map(value=>({value}))}]});
    }
    throw Error('unexpected request');
  };
  await call(env,'config','owner','POST',creds);
  const start=await (await call(env,'start','owner','POST',{})).json();
  assert.equal((await call(env,'callback?state='+new URL(start.url).searchParams.get('state')+'&code=test')).status,303);
  const connected=await (await call(env,'accounts')).json();
  assert.equal(connected.accounts.length,1);const accountId=connected.accounts[0].id;
  assert.ok(!JSON.stringify(connected).includes('secret-refresh'));
  assert.ok(!(await env.DB.prepare('SELECT encrypted FROM google_accounts').first()).encrypted.includes('secret-refresh'));
  assert.equal((await call(env,'config','owner','POST',creds)).status,409);
  const list=await (await call(env,'discover?source=ga4&accountId='+accountId)).json();
  assert.equal(list.nextPageToken,'page-two');assert.equal(list.resources[0].id,'properties/42');
  const selection={accountId,clientId:'clinic',resourceId:'properties/42',source:'ga4'};
  assert.equal((await call(env,'bindings','owner','POST',{...selection,clientId:'other'})).status,404);
  const saved=await (await call(env,'bindings','owner','POST',selection)).json();
  const same=await (await call(env,'bindings','owner','POST',selection)).json();assert.equal(saved.id,same.id);
  const result=await syncGoogle(env,'owner');assert.equal(result.results[0].status,'synced');
  await syncGoogle(env,'owner','clinic',{realtime:true});
  let row=(await readGoogle(env,'owner')).bindings[0];
  assert.deepEqual(row.points,[{date:'2026-11-10',sessions:12,users:9,keyEvents:3,aiSessions:2}]);
  assert.equal(row.realtime.activeUsers,8);assert.equal(row.profile.timeZone,'Asia/Kolkata');
  assert.equal((await readGoogle(env,'otherOwner')).bindings.length,0);
  assert.equal((await syncGoogle(env,'owner')).processed,0);
  denied=true;await env.DB.exec("UPDATE google_bindings SET lastAttempt=NULL");
  const previous=row.lastSync;assert.equal((await syncGoogle(env,'owner')).results[0].code,'RECONNECT');
  row=(await readGoogle(env,'owner')).bindings[0];assert.equal(row.lastSync,previous);assert.equal(row.points[0].sessions,12);
  assert.equal((await call(env,'accounts/'+accountId,'otherOwner','DELETE')).status,404);
  assert.equal((await call(env,'accounts/'+accountId,'owner','DELETE')).status,200);
  assert.equal((await readGoogle(env,'owner')).bindings.length,0);
});
test('Search Console finalized date rows and Business Profile partial daily series preserve gaps',async t=>{
  const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});
  globalThis.fetch=async (input,options)=>{
    const u=new URL(input);
    assert.match(u.pathname,/sc-domain%3Aclinic.example/);const req=JSON.parse(options.body);
    assert.equal(req.dataState,'final');assert.equal(req.type,'web');
    return Response.json({rows:[{keys:['2026-11-10'],clicks:7,impressions:81,ctr:7/81,position:3.4}]});
  };
  assert.equal((await daily('token','gsc','sc-domain:clinic.example',{})).points.length,1);
  const raw={multiDailyMetricTimeSeries:[{dailyMetricTimeSeries:[
    {dailyMetric:'CALL_CLICKS',timeSeries:{datedValues:[{date:{year:2026,month:11,day:10}}]}},
    {dailyMetric:'WEBSITE_CLICKS',timeSeries:{datedValues:[{date:{year:2026,month:11,day:11},value:'5'}]}}
  ]}]};
  assert.deepEqual(businessPoints(raw),[{date:'2026-11-10',calls:0},{date:'2026-11-11',websiteClicks:5}]);
});
