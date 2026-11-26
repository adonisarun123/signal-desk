import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryD1 } from './d1.mjs';
import { assessBinding } from '../server/health-rules.js';
import { runHealthChecks, healthApi } from '../server/health.js';
import { aiApi, classifyEvidence, extractSample } from '../server/ai.js';

const time = new Date('2026-11-25T13:00:00Z');
const DAY = 86_400_000;
function property({sessions = 100, previous = 100, days = 32} = {}) {
  return {id:'property',clientId:'atlas',source:'ga4',profile:{timeZone:'Asia/Kolkata'},
    lastSync:time.toISOString(), points:Array.from({length:days},(_,index)=>({
      date:new Date(time.getTime()-(2+index)*DAY).toISOString().slice(0,10),sessions:index ? previous : sessions,
    }))};
}
async function workspace(t) {
  const DB = memoryD1();
  t.after(() => DB.close());
  await DB.exec("CREATE TABLE clients (id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, domain TEXT NOT NULL)");
  await DB.prepare("INSERT INTO clients VALUES (?,?,?,?)").bind('atlas','alice','Atlas Clinic','atlas.example').run();
  return {DB};
}
function req(path,method='GET',data,headers={}) {
  return new Request('https://signal.test/api/' + path, {method,headers:{'Content-Type':'application/json',...headers},
    ...(data ? {body:JSON.stringify(data)} : {})});
}
const evidence={clientId:'atlas',engine:'ChatGPT',prompt:'Orthopaedic clinics in Bengaluru?',answer:'Atlas Clinic is one option.',citations:[{url:'https://atlas.example/clinic'}]};

test('weekday comparison, action and volume floors', () => {
  const dip = assessBinding(property({sessions:40}),time);
  assert.equal(dip.check.state,'critical');
  assert.equal(dip.alerts[0].metrics.baselineType,'same-weekday median');
  assert.equal(dip.alerts[0].metrics.comparisonDays,4);
  assert.equal(dip.alerts[0].metrics.changePercent,-60);
  assert.equal(assessBinding(property({sessions:68}),time).check.state,'warning');
  assert.equal(assessBinding(property({sessions:140}),time).alerts[0].kind,'gain');
  assert.equal(assessBinding(property({sessions:80}),time).alerts.length,0);
  assert.equal(assessBinding(property({sessions:0, previous:12}),time).check.state,'warming');
  assert.equal(assessBinding(property({days:6}),time).check.state,'warming');
  assert.equal(assessBinding(property({days:8,sessions:0}),time).alerts[0].metrics.baselineType,'recent-day median');
});

test('partial days, missing reports, stale data, sync errors and source-specific freshness', () => {
  const binding = property();
  binding.points.push({date:'2026-11-25',sessions:0},{date:'2026-11-24',sessions:0});
  assert.equal(assessBinding(binding,time).alerts.length,0);
  binding.points.push({date:'invalid',sessions:0});
  const missing = {...binding,points:binding.points.filter(p=>p.date!=='2026-11-23')};
  assert.equal(assessBinding(missing,time).alerts.length,0);
  const stale = {...binding,points:binding.points.filter(p=>p.date <= '2026-11-18')};
  assert.equal(assessBinding(stale,time).alerts[0].kind,'freshness');
  const failed = {...binding,lastError:'Access expired'};
  assert.equal(assessBinding(failed,time).alerts[0].kind,'sync');
  const gbp = assessBinding({...binding,source:'gbp',lastSync:time.toISOString()},time);
  assert.equal(gbp.check.latestDate,null);
  assert.equal(gbp.check.state,'healthy');
});

test('signal identity survives reruns, preserves acknowledgement, recovers and reopens', async t => {
  const env = await workspace(t);
  let snapshot = [property({sessions:12})];
  let clock = time.getTime();
  const run = () => runHealthChecks(env,'alice',null,{now:new Date(clock+=1000),read:async()=>({bindings:snapshot})});
  const first = await run();
  const id = first.alerts[0].id;
  const second = await run();
  assert.equal(second.alerts.length,1);
  assert.equal(second.alerts[0].id,id);
  assert.equal((await healthApi(req('alerts/'+id,'PATCH',{status:'resolved'}),env,'outsider')).status,404);
  assert.equal((await healthApi(req('alerts/'+id,'PATCH',{status:'acknowledged'}),env,'alice')).status,200);
  assert.equal((await run()).alerts[0].status,'acknowledged');
  snapshot = [{...property({sessions:12}),lastError:'Quota reached'}];
  assert.equal((await run()).alerts.find(r=>r.id===id).status,'acknowledged');
  snapshot = [property()];
  assert.equal((await run()).alerts.find(r=>r.id===id).status,'resolved');
  snapshot = [property({sessions:12})];
  assert.equal((await run()).alerts.find(r=>r.id===id).status,'open');
  snapshot = [];
  const disconnected = await run();
  assert.equal(disconnected.checks.length,0);
  assert.equal(disconnected.alerts.every(r=>r.status==='resolved'),true);
});

test('mentions are whole brand names in answer text, citations match owned hosts only', () => {
  const client = {name:'Atlas Clinic',domain:'www.atlas.example'};
  assert.deepEqual(classifyEvidence(client,'Atlas CLINIC is recommended.',[]),{mentioned:true,cited:false});
  assert.deepEqual(classifyEvidence(client,'Atlas Clinical has no availability.',[{url:'https://atlas.example.fake.test/'}]),{mentioned:false,cited:false});
  assert.deepEqual(classifyEvidence(client,'See [Atlas Clinic](https://atlas.example).',[{url:'https://care.atlas.example/'}]),{mentioned:false,cited:true});
  assert.deepEqual(classifyEvidence(client,'Text (Atlas Clinic)',[{url:'https://atlas.example/',startIndex:5,endIndex:19}]),{mentioned:false,cited:true});
});

test('manual evidence accepts negative records, prohibits forged flags, validates ownership and links', async t => {
  const env = await workspace(t);
  const add = (payload,owner='alice')=>aiApi(req('ai/observations','POST',payload),env,owner);
  assert.equal((await add(evidence,'outsider')).status,404);
  assert.equal((await add({...evidence,citations:[{url:'javascript:alert(1)'}]})).status,400);
  assert.equal((await add({...evidence,observedAt:'2099-01-01'})).status,400);
  assert.equal((await add(evidence)).status,201);
  const negative=await add({...evidence,answer:'Independent provider.',citations:[],mentioned:true,cited:true,method:'api'});
  const {observation}=await negative.json();
  assert.deepEqual([observation.mentioned,observation.cited,observation.method],[false,false,'manual']);
  const view=await (await aiApi(req('ai'),env,'alice')).json();
  assert.deepEqual(view.summary,{samples:2,mentions:1,citations:1,mentionRate:50,citationRate:50});
  const other=await (await aiApi(req('ai'),env,'outsider')).json();
  assert.equal(other.summary.samples,0);
  assert.equal((await aiApi(req('ai/sample','POST',evidence),env,'alice')).status,503);
});

const provider = {status:'completed',model:'sample-model',output:[
  {type:'web_search_call',status:'completed'},
  {type:'message',content:[{type:'output_text',text:'A clinic is available.'}]},
  {type:'message',content:[{type:'output_text',text:'Source: Atlas Clinic',annotations:[{
    type:'url_citation',title:'Atlas Clinic',url:'https://atlas.example',start_index:8,end_index:20,
  }]}]},
]};

test('sample annotations align across output blocks and incomplete responses are rejected', () => {
  const out=extractSample(provider);
  const [source]=out.citations;
  assert.equal(out.answer.slice(source.startIndex,source.endIndex),'Atlas Clinic');
  assert.throws(()=>extractSample({...provider,status:'incomplete'}),/incomplete/);
  assert.throws(()=>extractSample({...provider,output:provider.output.slice(1)}),/did not complete/);
});

test('sample budgets are atomically reserved, provider failures are counted, credentials stay server-side', async t => {
  const env = {...await workspace(t),OPENAI_API_KEY:'test-secret'};
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');
    const body=JSON.parse(init.body);
    assert.equal(body.input,evidence.prompt);
    assert.equal(body.input.includes('atlas.example'),false);
    assert.equal(body.max_tool_calls,1);
    assert.equal(body.store,false);
    calls++;
    return calls===3 ? new Response('provider error',{status:429}) : Response.json(provider);
  });
  const go = key=>aiApi(req('ai/sample','POST',evidence,{'Idempotency-Key':key}),env,'alice');
  assert.equal((await go('one')).status,201);
  assert.equal((await go('one')).status,409);
  const responses=await Promise.all(['two','three','four'].map(go));
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,429,502]);
  assert.equal(calls,3);
  const data=await(await aiApi(req('ai'),env,'alice')).json();
  assert.equal(data.remaining,0);
  assert.equal(data.summary.samples,2);
  assert.equal(data.summary.citations,2);
  assert.equal(data.summary.mentions,0);
  assert.equal(JSON.stringify(data).includes(env.OPENAI_API_KEY),false);
});

test('supporting metric evidence changes the next action and realtime failure keeps daily reports eligible', () => {
  const ga = property();
  ga.realtimeError = 'GA4 realtime quota reached.';
  ga.points.forEach((point,i)=>{point.keyEvents=i ? 20 : 5;});
  const report = assessBinding(ga,time);
  assert.equal(report.check.state,'critical');
  assert.equal(report.alerts.some(a=>a.key==='realtime'),true);
  const drop = report.alerts.find(a=>a.key==='keyEvents:drop');
  assert.equal(drop.metrics.companion.key,'sessions');
  assert.match(drop.action,/Sessions held/);
  const gsc={...ga,source:'gsc',points:ga.points.map((p,i)=>({...p,clicks:i ? 50:10,impressions:500}))};
  const search=assessBinding(gsc,time).alerts[0];
  assert.match(search.action,/Impressions held/);
  gsc.points[0].impressions=200;
  assert.match(assessBinding(gsc,time).alerts[0].action,/both declined/);
});
