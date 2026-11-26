import {icon} from './overview.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = (value) => value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : Intl.NumberFormat(undefined, {maximumFractionDigits:1}).format(Number(value));
const cap = (value) => value ? String(value).charAt(0).toUpperCase()+String(value).slice(1) : 'Unknown';
const providerNames = {ga4:'Google Analytics 4', gsc:'Search Console', gbp:'Business Profile', ai:'AI visibility', system:'Workspace'};
const providerShort = {ga4:'GA4', gsc:'Search Console', gbp:'Business Profile', ai:'AI visibility'};
const providerIcons = {ga4:'chart',gsc:'search',gbp:'globe',ai:'spark'};
const providerCopy = {ga4:'Active users, sessions, key events and AI referrals.', gsc:'Organic clicks, impressions, CTR and average position.', gbp:'Location details, profile views, calls and directions.'};
const palette = [['#deede8','#235d48'],['#ebe8fa','#62538e'],['#fae9dc','#92603d'],['#dfeaf6','#416486'],['#f4e3ed','#8b5571'],['#e9eccd','#69753d']];
const viewMemory = {mode:'',detailId:'',signalStatus:'open',signalClient:'all',aiClient:'all',aiDays:'all',aiType:'all',text:''};
let reviewState = {id:'', data:null, error:null};
let reviewRequest = 0;
const outcomeLabels = {actionable:'Actionable',expected:'Expected change',data_issue:'Data issue'};
let holder, model, callbacks;
let openDialog;
let filterFocusKey, previousPage;
let scopedAi = {id:'', base:null, data:null, error:null};
let aiRequest = 0;
const modeDemo = () => model.mode === 'demo' || model.mode === 'sample';
const clientList = () => Array.isArray(model.clients) ? model.clients : [];
const bindings = () => model.google?.bindings || [];
const sources = () => model.google?.accounts || [];
const signals = () => model.signals || model.alerts || [];
const checks = () => model.checks || [];
const aiRows = () => model.ai?.observations || [];
const findClient = (id) => clientList().find(c => String(c.id) === String(id));
const clientName = (id) => findClient(id)?.name || 'Workspace';
const dateText = (value, withTime=false) => {
  if (!value) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const when = new Date(dateOnly ? value+'T12:00:00Z' : value);
  if (Number.isNaN(when.getTime())) return '—';
  const options = {day:'numeric',month:'short',year:'numeric', ...(dateOnly ? {timeZone:'UTC'} : {timeZone:model?.settings?.timezone || 'Asia/Kolkata'})};
  if(withTime && !dateOnly) Object.assign(options, {hour:'2-digit',minute:'2-digit'});
  return when.toLocaleString('en-IN',options);
};
const action = (label, key, value='', cls='', glyph='') => '<button type="button" class="sdv-action '+cls+'" data-vact="'+esc(key)+'" data-val="'+esc(value)+'">'+(glyph?icon(glyph,16):'')+esc(label)+'</button>';
const chip = (label,tone='neutral') => '<span class="sdv-chip '+esc(tone)+'">'+esc(label)+'</span>';
const toneFor = (status) => /critical|error|disconnect/i.test(status) ? 'bad' : /warn|stale|watch|attention|risk/i.test(status) ? 'warn' : /healthy|good|resolved|connected|complete|order|stable/i.test(status) ? 'good' : 'neutral';
const provider = (src) => providerNames[src] || src || 'Workspace';
const sourceIcon = (src) => '<span class="sdv-source-icon '+esc(src)+'">'+icon(providerIcons[src]||'plug',20)+'</span>';
const section = (title,subtitle,content,end='') => '<section class="sdv-card"><header class="sdv-card-head"><div><h2>'+esc(title)+'</h2>'+(subtitle?'<p class="sdv-sub">'+esc(subtitle)+'</p>':'')+'</div>'+end+'</header>'+content+'</section>';
const heading = (title,subtitle,buttons='') => '<header class="sdv-heading"><div><h1>'+esc(title)+'</h1><p class="sdv-description">'+esc(subtitle)+'</p></div><div class="sdv-row-actions">'+buttons+'</div></header>';
const empty = (title,body,glyph='layers',button='') => '<div class="sdv-empty"><span class="sdv-source-icon">'+icon(glyph,19)+'</span><strong>'+esc(title)+'</strong><p>'+esc(body)+'</p>'+button+'</div>';
const stat = (label,value,note) => '<div class="sdv-stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note)+'</small></div>';
const banner = (title,body,act='',tone='') => '<div class="sdv-banner '+esc(tone)+'"><div class="sdv-row-main"><strong>'+esc(title)+'</strong><p class="sdv-sub">'+esc(body)+'</p></div>'+act+'</div>';
const optionsClients = (selected,all=false) => (all?'<option value="all">All clients</option>':'')+clientList().map(c=>'<option value="'+esc(c.id)+'" '+(String(selected)===String(c.id)?'selected':'')+'>'+esc(c.name)+'</option>').join('');
const selectClient = (key,selected) => '<select class="sdv-select" aria-label="Filter by client" data-vchange="'+key+'">'+optionsClients(selected,true)+'</select>';
const safeUrl = (value) => {try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:''}catch{return ''}};
function avatar(c) {
  const hash = [...String(c.name || c.id)].reduce((a,b)=>a+b.charCodeAt(0),0);
  const colors=palette[hash%palette.length];
  const initials=String(c.name||'C').trim().split(/\s+/).slice(0,2).map(w=>w.charAt(0)).join('').toUpperCase();
  return '<span class="sdv-avatar" style="background:'+colors[0]+';color:'+colors[1]+'">'+esc(initials)+'</span>';
}
function quality(c){
  const items=checks().filter(r=>r.clientId===c.id);
  const open=signals().filter(s=>s.clientId===c.id&&s.status!=='resolved');
  if(open.some(s=>s.severity==='critical')||items.some(s=>s.state==='critical')) return 'Critical';
  if(items.some(s=>s.state==='stale'))return 'Stale';
  if(open.some(s=>s.severity==='warning') || items.some(s=>s.state==='warning'))return 'Needs attention';
  const label=c.health?.label || (typeof c.health==='string'?c.health:null) || c.status;
  if(label && typeof label==='string')return cap(label);
  if(items.length && items.every(s=>s.state==='healthy'))return 'Healthy';
  if(items.length || bindings().some(b=>b.clientId===c.id))return 'Warming up';
  return 'Awaiting data';
}
function clientSources(id){
  return [...new Set(bindings().filter(b=>b.clientId===id).map(b=>b.source))].map(s=>providerShort[s]||s);
}
function clientRows() {
  const list=clientList();
  if(!list.length)return empty('Your first client starts here','Create a client, then choose the Google properties you want to monitor.','briefcase',action('Add client','newClient','','primary','plus'));
  return '<div class="sdv-table-scroll"><table class="sdv-table"><thead><tr><th>Client</th><th>Operator</th><th>Sources</th><th>Health</th><th>Open signals</th><th><span class="sdv-note">Details</span></th></tr></thead><tbody>'+list.map(c=>{
    const count=signals().filter(s=>s.clientId===c.id && (s.status||'open')==='open').length;
    const sourceLabels=clientSources(c.id);
    return '<tr data-search="'+esc([c.name,c.domain,c.operator||'',sourceLabels.join(' ')].join(' ').toLowerCase())+'"><td><button type="button" class="sdv-link-btn" data-vact="clientDetail" data-val="'+esc(c.id)+'">'+avatar(c)+'<span>'+esc(c.name)+'<small class="sdv-sub">'+esc(c.domain||'Domain not set')+'</small></span></button></td><td>'+(c.operator?esc(c.operator):'<span class="sdv-note">Unassigned</span>')+'</td><td>'+esc(sourceLabels.join(' · ') || 'No properties')+'</td><td>'+chip(quality(c),toneFor(quality(c)))+'</td><td>'+n(count)+'</td><td>'+action('View','clientDetail',c.id,'small')+'</td></tr>';
  }).join('')+'</tbody></table></div><div class="sdv-empty" data-no-matches hidden><strong>No matching clients</strong><p>Try a different name or domain.</p></div>';
}
function clientsPage() {
  const cl=findClient(viewMemory.detailId);
  if(cl)return clientDetail(cl);
  return heading('Clients','Manage client websites, connected properties and portfolio health.',action('Add client','newClient','','primary','plus'))+
    '<div class="sdv-toolbar"><label class="sdv-filterbox">'+icon('search',16)+'<input type="search" aria-label="Search clients" placeholder="Search clients or domains" data-vinput="search" value="'+esc(viewMemory.text)+'"></label><span class="sdv-note">'+n(clientList().length)+' client'+(clientList().length===1?'':'s')+'</span></div>'+
    section('Client directory','',clientRows());
}
function clientDetail(c){
  const sid=c.id, b=bindings().filter(r=>r.clientId===sid), sig=signals().filter(r=>r.clientId===sid && r.status!=='resolved'), obs=aiRows().filter(r=>r.clientId===sid);
  return '<button class="sdv-link-btn sdv-back" type="button" data-vact="clientList">All clients</button>'+
  heading(c.name,c.domain || 'Client details',action('Edit record','editClient',sid,'','settings')+action('Export daily readings','exportClient',sid,'','list')+action('Manage connections','nav','connections','','plug')+action('View overview','overviewClient',sid,'primary','grid'))+
  '<div class="sdv-grid sdv-stat-grid">'+stat('Health',quality(c),'Current source checks')+stat('Active signals',n(sig.length),'Open or acknowledged')+stat('AI observations',n(obs.length),'Recorded answers')+'</div>'+
  section('Onboarding record','Agreed scope for this client. Every mapping needs an accountable operator.',onboardingFacts(c),action('Edit','editClient',sid,'small'))+
  section('Latest reported metrics','Daily readings are shown separately for each linked property.',b.length?b.map(latestMetrics).join(''):empty('Waiting for properties','Daily source metrics appear after a linked property syncs.','chart'))+
  section('Connected properties','Each source has its own reporting cadence.',b.length?b.map(bindingRow).join(''):empty('No property connected','Choose an account and bind a property to this client.','plug',action('Manage connections','nav','connections','small')))+
  section('Active signals','',sig.length?sig.map(signalRow).join(''):empty('No active signals','The next check will surface changes when enough source data is available.','activity'))+
  section('Weekly reviews','One material risk, one verified gain and one concrete next action, with an owner, due date and recovery metric.',reviewList(sid),action('Add weekly review','addReview',sid,'small','plus'))+
  section('Offboarding','Removes this client, its property mappings, signals, AI evidence and reviews from the workspace. Google access itself is revoked separately.',
    '<div class="sdv-row"><div class="sdv-row-main"><p class="sdv-note">Before revoking a shared Google identity, check which other clients still use it in Connections.</p></div><div class="sdv-row-actions">'+action('Offboard client','deleteClient',sid,'small danger')+'</div></div>');
}
function onboardingFacts(c){
  const rows=[['Accountable operator',c.operator],['Client contact',c.contact],['Key events tracked',c.keyEvents],['GA4 reporting time zone',c.timeZone],['Notes',c.notes],['Record created',c.createdAt?dateText(c.createdAt):'']];
  const filled=rows.filter(([,v])=>v);
  return '<dl class="sdv-facts" style="padding:0 20px 18px">'+(filled.length?filled.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join(''):'<dt>Status</dt><dd>No onboarding details recorded yet.</dd>')+'</dl>'+
    (!c.operator?'<p class="sdv-error" style="padding:0 20px 16px">No accountable operator. The pilot coverage target requires one for every onboarded client.</p>':'');
}
function reviewList(clientId){
  if(modeDemo()&&reviewState.id!==clientId)reviewState={id:clientId,data:demoReviews(clientId),error:null};
  if(reviewState.id!==clientId||(!reviewState.data&&!reviewState.error))return '<p class="sdv-note" style="padding:0 20px 18px">Loading reviews…</p>';
  if(reviewState.error)return banner('Reviews could not be loaded',reviewState.error,action('Retry','retryReviews',clientId,'small'),'amber');
  const rows=reviewState.data||[];
  if(!rows.length)return empty('No weekly reviews yet','Summarise the week for this client so the team can track what happens next.','calendar');
  return rows.map(r=>'<div class="sdv-row"><span class="sdv-source-icon">'+icon('calendar',18)+'</span><div class="sdv-row-main"><div class="sdv-title-line"><h3>Week of '+esc(dateText(r.weekOf))+'</h3>'+chip(r.status==='done'?'Done':'Open',r.status==='done'?'good':'warn')+'</div>'+
    (r.risk?'<p class="sdv-note"><strong>Risk:</strong> '+esc(r.risk)+'</p>':'')+(r.gain?'<p class="sdv-note"><strong>Gain:</strong> '+esc(r.gain)+'</p>':'')+
    '<p class="sdv-note"><strong>Next action:</strong> '+esc(r.nextAction)+'</p><p class="sdv-sub">'+esc(['Owner: '+r.actionOwner,r.dueDate?'Due '+dateText(r.dueDate):'',r.recoveryMetric?'Recovery metric: '+r.recoveryMetric:''].filter(Boolean).join(' · '))+'</p></div>'+
    '<div class="sdv-row-actions">'+action(r.status==='done'?'Reopen':'Mark done','reviewStatus',r.id+'|'+(r.status==='done'?'open':'done'),'small')+'</div></div>').join('');
}
function demoReviews(clientId){
  try{return JSON.parse(localStorage.getItem('signal-desk.demo.reviews')||'{}')[clientId]||[];}catch{return [];}
}
async function loadReviews(clientId,force=false){
  if(modeDemo()||!clientId||(!force&&reviewState.id===clientId&&(reviewState.data||reviewState.error)))return;
  const ticket=++reviewRequest;reviewState={id:clientId,data:null,error:null};
  try{const res=await api('/api/clients/'+encodeURIComponent(clientId)+'/reviews');if(ticket!==reviewRequest)return;reviewState.data=res.reviews||[];}
  catch(e){if(ticket!==reviewRequest)return;reviewState.error=e.message;}
  if(model?.view==='clients'&&viewMemory.detailId===clientId)draw();
}
function latestMetrics(b){
  const labels={ga4:[['sessions','Sessions'],['users','Active users'],['keyEvents','Key events'],['aiSessions','AI referral sessions']],gsc:[['clicks','Clicks'],['impressions','Impressions'],['ctr','CTR'],['position','Average position']],gbp:[['impressions','Profile impressions'],['calls','Call clicks'],['websiteClicks','Website clicks'],['directions','Direction requests']]};
  const latest=(b.points||[]).reduce((last,row)=>row.date&&(!last||row.date>last.date)?row:last,null);
  const fields=labels[b.source]||[];
  return '<div class="sdv-row">'+sourceIcon(b.source)+'<div class="sdv-row-main"><div class="sdv-title-line"><h3>'+esc(b.label||b.resourceId)+'</h3>'+chip(providerShort[b.source]||b.source)+'</div><p class="sdv-sub">'+esc(latest?'Reporting date · '+dateText(latest.date):'No daily reading available')+'</p><div class="sdv-readings">'+fields.map(([key,label])=>{const val=latest?.[key];const metric=key==='ctr'&&val!=null?n(val*100)+'%':n(val);return '<div><span>'+esc(label)+'</span><strong>'+esc(metric)+'</strong></div>';}).join('')+'</div></div></div>';
}
function severity(s){return ['critical','warning','info'].includes(s.severity)?s.severity:'info'}
function signalRow(s){
  const sev=severity(s),status=s.status||'open';
  return '<div class="sdv-row"><span class="sdv-outcome-icon '+sev+'">'+icon(sev==='info'?'activity':'triangle',18)+'</span><div class="sdv-row-main"><div class="sdv-title-line"><h3>'+esc(s.title)+'</h3>'+chip(cap(sev),sev==='warning'?'warn':sev==='critical'?'bad':'cool')+(status!=='open'?chip(cap(status),toneFor(status)):'')+(s.occurrences>1?chip('Recurred ×'+n(s.occurrences),'warn'):'')+(s.outcome?chip(outcomeLabels[s.outcome]||s.outcome):'')+'</div><p class="sdv-sub">'+esc(clientName(s.clientId))+' · '+esc(provider(s.source))+' · '+esc(dateText(s.observedAt||s.firstSeen))+(s.assignee?' · Assigned to '+esc(s.assignee):(status!=='resolved'&&s.severity!=='info'?' · Unassigned':''))+'</p><p class="sdv-note">'+esc(s.detail||s.description||'')+'</p></div><div class="sdv-row-actions">'+action('Review','signal',s.id,'small')+'</div></div>';
}
function signalStats(list){
  const critical=list.filter(s=>s.severity==='critical'),openCritical=critical.filter(s=>s.status!=='resolved');
  const waits=list.filter(s=>s.acknowledgedAt&&s.firstSeen).map(s=>(Date.parse(s.acknowledgedAt)-Date.parse(s.firstSeen))/3600000).filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);
  const median=waits.length?(waits.length%2?waits[(waits.length-1)/2]:(waits[waits.length/2-1]+waits[waits.length/2])/2):null;
  const reviewed=critical.filter(s=>s.outcome).length;
  const counts=Object.keys(outcomeLabels).map(k=>outcomeLabels[k]+' '+n(list.filter(s=>s.outcome===k).length)).join(' · ');
  return '<div class="sdv-grid sdv-stat-grid">'+stat('Open critical',n(openCritical.length),n(openCritical.filter(s=>!s.assignee).length)+' without an assignee')+
    stat('Median time to acknowledge',median===null?'—':median<1?Math.round(median*60)+' min':n(median)+' h',n(waits.length)+' acknowledged signals')+
    stat('Critical signals reviewed',critical.length?n(reviewed)+' of '+n(critical.length):'—',counts)+'</div>';
}
function signalsPage() {
  const all=signals(), matching=all.filter(s=>(viewMemory.signalClient==='all'||s.clientId===viewMemory.signalClient)&&(viewMemory.signalStatus==='all'||(s.status||'open')===viewMemory.signalStatus));
  const ch=checks().filter(c=>viewMemory.signalClient==='all'||c.clientId===viewMemory.signalClient);
  const tabs=['open','acknowledged','resolved','all'].map(s=>'<button type="button" data-vact="signalStatus" data-val="'+s+'" aria-pressed="'+(s===viewMemory.signalStatus)+'">'+cap(s)+'</button>').join('');
  return heading('Health signals','Investigate changes, confirm what needs attention and track your response.',action('Run health check','runCheck','','primary','pulse'))+
  '<div class="sdv-toolbar"><div class="sdv-segment" aria-label="Signal status">'+tabs+'</div>'+selectClient('signalClient',viewMemory.signalClient)+'</div>'+signalStats(all.filter(s=>viewMemory.signalClient==='all'||s.clientId===viewMemory.signalClient))+
  section('Signal inbox','',matching.length?matching.map(signalRow).join(''):empty('No '+(viewMemory.signalStatus==='all'?'':viewMemory.signalStatus+' ')+'signals here','New findings appear after a health check. You can review the status of each property below.','checkCircle'),chip(n(matching.length)+' signals'))+
  section('Source health','Latest available check for each connected property.',ch.length?'<div class="sdv-table-scroll"><table class="sdv-table"><thead><tr><th>Client / source</th><th>State</th><th>Finding</th><th>Latest data</th></tr></thead><tbody>'+ch.map(c=>'<tr><td><strong>'+esc(clientName(c.clientId))+'</strong><small class="sdv-sub">'+esc(provider(c.source))+'</small></td><td>'+chip(cap(c.state),toneFor(c.state))+'</td><td>'+esc(c.detail||'—')+'</td><td>'+esc(dateText(c.latestDate))+'</td></tr>').join('')+'</tbody></table></div>':empty('No source checks yet','Connect a Google property and sync its data to begin.','plug'));
}
function bindingRow(b) {
  const prof=b.profile||{},phone=prof.phoneNumbers?.primaryPhone, addr=prof.storefrontAddress, location=[addr?.locality,addr?.administrativeArea].filter(Boolean).join(', ');
  return '<div class="sdv-row">'+sourceIcon(b.source)+'<div class="sdv-row-main"><div class="sdv-title-line"><h3>'+esc(b.label||b.resourceId)+'</h3>'+chip(providerShort[b.source]||b.source)+'</div><p class="sdv-sub">'+esc(clientName(b.clientId))+' · Last synced '+esc(b.lastSync?dateText(b.lastSync,true):'—')+'</p>'+
    (b.source==='ga4'&&b.realtime?.activeUsers!=null?'<p class="sdv-note">'+n(b.realtime.activeUsers)+' active users in the latest 30-minute reading · '+esc(dateText(b.realtime.observedAt,true))+'</p>':'')+
    (b.source==='gbp' && (phone||location||prof.title)?'<p class="sdv-note">'+esc([prof.title,phone,location].filter(Boolean).join(' · '))+'</p>':'')+
    (b.lastError?'<p class="sdv-error">'+esc(b.lastError)+'</p>':'')+'</div><div class="sdv-row-actions">'+(b.source==='gbp'&&Object.keys(prof).length?action('Profile','profile',b.id,'small'):'')+(['ga4','gsc'].includes(b.source)&&(b.points||[]).length?action('Breakdown','breakdown',b.id,'small'):'')+action('Unlink','unlink',b.id,'small')+'</div></div>';
}
function connectionsPage() {
  const google=model.google||{}, acc=sources(), b=bindings(), setup=google.setup||{}, demo=modeDemo();
  const configured=!!(google.configured||setup.ready||demo);
  const configureAction=(!demo&&configured&&!acc.length&&setup.canConfigure)?action('Configure OAuth','setup','','','settings'):'';
  const primary=demo?action('Open live workspace','live','','primary','plug'):configured?action('Connect Google account','connect','','primary','plus'):action('Setup details','setup','','primary','settings');
  return heading('Connections','Choose the Google accounts and properties each client uses.',configureAction+primary)+
  (demo?banner('Sample workspace','These accounts and properties are illustrative. Open the live workspace to authorise Google access.'):!configured?banner('Google authorisation needs configuration','Complete the deployment setup before adding your first account.',action('View setup','setup','','small'),'amber'):'')+
  '<div class="sdv-grid sdv-provider-grid">'+Object.keys(providerCopy).map(src=>'<article class="sdv-provider">'+sourceIcon(src)+'<h3>'+esc(provider(src))+'</h3><p class="sdv-sub">'+esc(providerCopy[src])+'</p>'+chip(n(b.filter(x=>x.source===src).length)+' properties',b.some(x=>x.source===src)?'good':'neutral')+'</article>').join('')+'</div>'+
  section('Google accounts','One account can provide properties for several clients.',acc.length?acc.map(a=>'<div class="sdv-row"><span class="sdv-source-icon">'+icon('users',18)+'</span><div class="sdv-row-main"><div class="sdv-title-line"><h3>'+esc(a.email||a.label||a.id)+'</h3>'+chip(a.lastError?'Reconnect required':'Authorised',a.lastError?'warn':'good')+'</div><p class="sdv-sub">'+n(b.filter(x=>x.accountId===a.id).length)+' linked properties'+(a.connectedAt?' · Connected '+esc(dateText(a.connectedAt)):'')+'</p>'+(a.lastError?'<p class="sdv-error">'+esc(a.lastError)+'</p>':'')+'</div><div class="sdv-row-actions">'+(a.lastError&&!demo?action('Reconnect','connect','','small'):'')+action('Link a property','bind',a.id,'small','plus')+action('Disconnect','disconnect',a.id,'small')+'</div></div>').join(''):empty('No Google accounts connected','Authorise an account you use to manage client properties.','plug'))+
  section('Linked properties','Daily data, reporting windows and sync errors are tracked per source.',b.length?b.map(bindingRow).join(''):empty('No linked properties','After authorising Google, link a property or Business Profile location to a client.','layers'),b.length?action('Sync properties','sync','','small','refresh'):'');
}
const aiQueryKey=()=>[viewMemory.aiClient,viewMemory.aiDays,viewMemory.aiType].join('|');
const aiDefault=()=>viewMemory.aiClient==='all'&&viewMemory.aiDays==='all'&&viewMemory.aiType==='all';
function localAiFilter(list){
  const since=viewMemory.aiDays==='all'?null:Date.now()-Number(viewMemory.aiDays)*86400000;
  return list.filter(o=>(viewMemory.aiClient==='all'||o.clientId===viewMemory.aiClient)&&(viewMemory.aiType==='all'||o.promptType===viewMemory.aiType)&&(!since||Date.parse(o.observedAt)>=since));
}
function aiDataset(){
  if(aiDefault())return model.ai||{};
  if(!modeDemo()&&scopedAi.id===aiQueryKey()&&scopedAi.data)return scopedAi.data;
  const list=localAiFilter(aiRows());
  return {observations:list,failedRuns:localAiFilter(model.ai?.failedRuns||[]),local:true};
}
function observationsForFilter(){return localAiFilter(aiDataset().observations||[]);}
async function getScopedAi(){
  const key=aiQueryKey(),base=model?.ai;
  if(aiDefault()||!holder||!model||modeDemo()||!callbacks.api||(scopedAi.id===key&&scopedAi.base===base))return;
  const ticket=++aiRequest;scopedAi={id:key,base,data:null,error:null};
  const params=new URLSearchParams();
  if(viewMemory.aiClient!=='all')params.set('clientId',viewMemory.aiClient);
  if(viewMemory.aiDays!=='all')params.set('days',viewMemory.aiDays);
  if(viewMemory.aiType!=='all')params.set('promptType',viewMemory.aiType);
  try{
    const data=await api('/api/ai?'+params);
    if(ticket!==aiRequest||model?.view!=='ai'||aiQueryKey()!==key||model.ai!==base)return;
    scopedAi.data=data;
  }catch(e){if(ticket!==aiRequest||model?.view!=='ai'||aiQueryKey()!==key||model.ai!==base)return;scopedAi.error=e.message;}
  draw();
}
const filterSelect=(key,label,options)=>'<select class="sdv-select" aria-label="'+esc(label)+'" data-vchange="'+key+'">'+options.map(([v,t])=>'<option value="'+esc(v)+'" '+(viewMemory[key]===v?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select>';
function aiPage(){
  const data=aiDataset(),list=observationsForFilter();
  const exactTotals=!data.local&&data.summary?data.summary:null;
  const samples=exactTotals?exactTotals.samples:list.length,mentions=exactTotals?exactTotals.mentions:list.filter(o=>o.mentioned).length,citations=exactTotals?exactTotals.citations:list.filter(o=>o.cited).length;
  const failed=data.failedRuns||[],failedCount=data.failedCount??failed.length;
  const haveClient=clientList().length>0;
  const sampling=!!model.ai?.samplingAvailable||modeDemo();
  const mixed=viewMemory.aiType==='all'&&list.some(o=>o.promptType==='branded')&&list.some(o=>o.promptType==='discovery');
  const pending=!aiDefault()&&!modeDemo()&&scopedAi.id===aiQueryKey()&&!scopedAi.data&&!scopedAi.error;
  return heading('AI visibility','Track when a client appears in a recorded AI answer and when the answer cites their website.',
    action('Record an answer','addEvidence','','','plus')+(sampling?action(modeDemo()?'Try a sample':'Run a prompt','sample','','primary','spark'):''))+
  (!haveClient?banner('Create a client to track AI visibility','A client name and domain are used to identify mentions and citations.',action('Add client','newClient','','small')):'')+
  '<div class="sdv-toolbar"><span class="sdv-note">Compare one prompt panel and period at a time</span><div class="sdv-row-actions">'+selectClient('aiClient',viewMemory.aiClient)+
    filterSelect('aiType','Prompt type',[['all','All prompt types'],['branded','Branded prompts'],['discovery','Discovery prompts']])+
    filterSelect('aiDays','Observation period',[['all','All dates'],['7','Last 7 days'],['28','Last 28 days'],['90','Last 90 days']])+'</div></div>'+
  (mixed?banner('Branded and discovery prompts are combined','Select one prompt type before comparing visibility. Branded questions name the client, so they inflate the mention rate.','','amber'):'')+
  '<div class="sdv-grid sdv-stat-grid">'+stat('Successful observations',pending?'…':n(samples),n(failedCount)+' failed or unusable runs excluded')+
    stat('Mention rate',samples?n(100*mentions/samples)+'%':'—',n(mentions)+' of '+n(samples)+' answers name the client')+
    stat('Citation rate',samples?n(100*citations/samples)+'%':'—',n(citations)+' of '+n(samples)+' answers link to the client domain')+'</div>'+
  (samples>0&&samples<20?'<p class="sdv-note sdv-section">'+n(samples)+' observations describe these responses only. They are too few for a market-wide claim.</p>':'')+
  (scopedAi.error&&scopedAi.id===aiQueryKey()?banner('Filtered totals could not be loaded',scopedAi.error,action('Retry','retryAi','','small'),'amber'):'')+
  section('Observation log',samples>list.length?'Showing the '+list.length+' most recent answers. Rates include all matching observations.':'Read the answer and source links behind each measurement.',list.length?'<div class="sdv-table-scroll"><table class="sdv-table"><thead><tr><th>Prompt / client</th><th>Panel</th><th>Engine</th><th>Mention</th><th>Citation</th><th>Observed</th><th>Evidence</th></tr></thead><tbody>'+list.map(o=>'<tr><td><strong>'+esc(o.prompt)+'</strong><small class="sdv-sub">'+esc(clientName(o.clientId))+'</small></td><td>'+esc(o.promptType?cap(o.promptType):'Untyped')+'<small class="sdv-sub">'+esc([o.language,o.city].filter(Boolean).join(' · ')||'—')+'</small></td><td>'+esc(o.engine||'Unknown')+'<small class="sdv-sub">'+esc(o.method==='api'?'API sample':o.method==='demo'?'Sample':'Recorded manually')+'</small></td><td>'+chip(o.mentioned?'Mentioned':'Absent',o.mentioned?'good':'neutral')+'</td><td>'+chip(o.cited?'Cited':'Absent',o.cited?'cool':'neutral')+'</td><td>'+esc(dateText(o.observedAt))+'</td><td>'+action('Read','evidence',o.id,'small')+'</td></tr>').join('')+'</tbody></table></div>':empty('No answers recorded for this selection','Paste an observed answer with its citations, or widen the filters.','spark'))+
  (failed.length?section('Failed or unusable runs','Kept for collection review. These attempts never count toward the rates above.','<div class="sdv-table-scroll"><table class="sdv-table"><thead><tr><th>Prompt / client</th><th>Engine</th><th>What happened</th><th>Attempted</th></tr></thead><tbody>'+failed.map(f=>'<tr><td><strong>'+esc(f.prompt)+'</strong><small class="sdv-sub">'+esc(clientName(f.clientId))+'</small></td><td>'+esc(f.engine)+'<small class="sdv-sub">'+esc(f.method==='api'?'API sample':'Recorded manually')+'</small></td><td>'+esc(f.error)+'</td><td>'+esc(dateText(f.attemptedAt,true))+'</td></tr>').join('')+'</tbody></table></div>'):'')+
  '<p class="sdv-note sdv-section">Rates describe this set of prompts and recorded answers. Attributed AI referral sessions are a separate GA4 measure on the Overview. '+(sampling?'Prompt runs are stored as individual observations.':'Manual recording is available. Automated sampling requires a configured provider.')+'</p>';
}
function settingsPage(){
  const st=model.settings||{},enabled=st.scheduleEnabled!==false;
  return heading('Workspace settings','Manage monitoring and review account configuration.')+
    section('Monitoring','', '<div class="sdv-row"><span class="sdv-source-icon">'+icon('clock',18)+'</span><div class="sdv-row-main"><div class="sdv-title-line"><h3>Scheduled health checks</h3>'+chip(enabled?'Enabled':'Paused',enabled?'good':'neutral')+'</div><p class="sdv-sub">Check frequency: '+esc(st.frequency||'hourly')+'. Latest recorded check: '+esc(dateText(st.lastCheck||model.checkedAt,true))+'.</p></div><div class="sdv-row-actions">'+action(enabled?'Pause checks':'Resume checks','schedule',enabled?'pause':'resume','small')+'</div></div>'+
    '<div class="sdv-row"><span class="sdv-source-icon">'+icon('globe',18)+'</span><div class="sdv-row-main"><h3>Reporting timezone</h3><p class="sdv-sub">'+esc(st.timezone||'Asia/Kolkata')+'. Provider reporting dates retain their own reporting windows.</p></div></div>')+
    section('Workspace','', '<div class="sdv-row"><span class="sdv-source-icon">'+icon('layers',18)+'</span><div class="sdv-row-main"><h3>'+esc(modeDemo()?'Sample workspace':'Live workspace')+'</h3><p class="sdv-sub">'+esc(modeDemo()?'Explore the dashboard with illustrative client data.':'Your authorised accounts, client properties and recorded observations.')+'</p></div><div class="sdv-row-actions">'+action(modeDemo()?'Open live workspace':'Explore sample','switchMode','','small')+'</div></div>'+
    '<div class="sdv-row"><span class="sdv-source-icon">'+icon('plug',18)+'</span><div class="sdv-row-main"><h3>Google authorisation</h3><p class="sdv-sub">'+esc(modeDemo()?'Sample account configuration':model.google?.configured||model.google?.setup?.ready?'Configured':'Setup required')+'</p></div><div class="sdv-row-actions">'+action('Connections','nav','connections','small')+'</div></div>');
}
function filterClients(){
  if(!holder)return;
  const q=viewMemory.text.toLowerCase().trim();let matches=0;
  for(const el of holder.querySelectorAll('[data-search]')){const ok=el.dataset.search.includes(q);el.hidden=!ok;if(ok)matches++;}
  const notice=holder.querySelector('[data-no-matches]');if(notice)notice.hidden=matches!==0;
}
function draw(){
  if(!holder||!model)return;
  const pages={clients:clientsPage,signals:signalsPage,connections:connectionsPage,ai:aiPage,settings:settingsPage};
  const page=pages[model.view];if(!page)return;
  holder.innerHTML='<div class="sdv">'+page()+'</div>';
  if(model.view==='clients')filterClients();
  if(model.view==='ai')getScopedAi();
  if(model.view==='clients'&&viewMemory.detailId)loadReviews(viewMemory.detailId);
  if(filterFocusKey){holder.querySelector('[data-vchange="'+filterFocusKey+'"]')?.focus({preventScroll:true});filterFocusKey='';}
}
export function renderView(el,state,actions){
  holder=el;callbacks=actions;
  if(viewMemory.mode!==state.mode){aiRequest++;scopedAi={id:'',base:null,data:null,error:null};Object.assign(viewMemory,{mode:state.mode,detailId:'',signalStatus:'open',signalClient:'all',aiClient:'all',aiDays:'all',aiType:'all',text:''});reviewState={id:'',data:null,error:null};}
  const oldView=previousPage;previousPage=state.view;
  model=state;
  if(oldView!=='clients'&&state.view==='clients'){viewMemory.detailId=(state.clientId&&state.clientId!=='all')?state.clientId:'';}
  if(oldView!=='signals'&&state.view==='signals')viewMemory.signalClient=state.clientId||'all';
  if(oldView!=='ai'&&state.view==='ai')viewMemory.aiClient=state.clientId||'all';
  draw();
  el.onclick=evt=>{const button=evt.target.closest('button[data-vact]');if(button&&el.contains(button))handleAction(button.dataset.vact,button.dataset.val,button);};
  el.onchange=evt=>{const key=evt.target.dataset.vchange;if(['aiClient','signalClient','aiDays','aiType'].includes(key)){viewMemory[key]=evt.target.value;filterFocusKey=key;draw();}};
  el.oninput=evt=>{if(evt.target.dataset.vinput==='search'){viewMemory.text=evt.target.value;filterClients();}};
}
export function clearView(el,nextView=globalThis.location?.hash.slice(1)||'overview'){
  if(el){el.onclick=null;el.onchange=null;el.oninput=null;}
  if(!nextView || nextView!==previousPage){
    if(openDialog)openDialog.close();
    previousPage=null;
  }
  holder=null;model=null;
}
async function api(path,method='GET',body){
  const result=await callbacks.api(path,{method,...(body===undefined?{}:{body})});
  if(result instanceof Response){let data;try{data=await result.json()}catch{data={}}if(!result.ok)throw Error(data.error||'The request could not be completed.');return data;}
  if(result?.error)throw Error(typeof result.error==='string'?result.error:'The request could not be completed.');
  return result||{};
}
const toast=(message)=>callbacks?.toast?.(message);
async function updated(message){
  if(message)toast(message);
  if(callbacks?.refresh)await callbacks.refresh();else draw();
}
function dialog(title,body){
  if(openDialog)openDialog.close();
  const el=document.createElement('dialog');
  el.className='sdv-dialog';el.setAttribute('aria-labelledby','sdv-modal-title');
  el.innerHTML='<div class="sdv-dialog-head"><h2 id="sdv-modal-title">'+esc(title)+'</h2><button type="button" data-close aria-label="Close dialog" class="sdv-action icon">'+icon('x',18)+'</button></div><div class="sdv-dialog-body">'+body+'</div>';
  document.body.append(el);openDialog=el;
  el.addEventListener('click',event=>{if(event.target===el||event.target.closest('[data-close]'))el.close();});
  el.addEventListener('close',()=>{if(openDialog===el)openDialog=null;el.remove();},{once:true});
  el.showModal();
  return el;
}
function formFooter(label,cls='primary'){
  return '<p class="sdv-error" data-error role="alert" hidden></p><div class="sdv-row-actions"><button type="button" class="sdv-action" data-close>Cancel</button><button type="submit" class="sdv-action '+cls+'">'+esc(label)+'</button></div>';
}
function showError(el,err){
  const field=el.querySelector('[data-error]');
  if(field){field.hidden=false;field.textContent=err?.message||'The request failed. Try again.';}else toast(err?.message||'The request failed. Try again.');
}
function onForm(el,handler,options={}){
  const form=el.querySelector('form');
  form.onsubmit=async event=>{
    event.preventDefault();if(form.dataset.busy)return;
    const btn=form.querySelector('button[type=submit]'),err=el.querySelector('[data-error]');
    if(err){err.hidden=true;err.textContent='';}
    form.dataset.busy='1';btn.disabled=true;
    try{const result=await handler(Object.fromEntries(new FormData(form)),form);
      if(result===false)return;
      el.close();if(!options.skipRefresh)await updated(typeof result==='string'?result:undefined);
    }catch(error){showError(el,error);}
    finally{delete form.dataset.busy;btn.disabled=false;}
  };
}
function clientForm(existing){
  const c=existing||{},zone=c.timeZone||(existing?'':'Asia/Kolkata');
  const field=(label,name,value,extra='')=>'<label>'+label+'<input name="'+name+'" value="'+esc(value||'')+'" autocomplete="off" '+extra+'></label>';
  const d=dialog(existing?'Edit client record':'Add a client','<form>'+
    field('Client name','name',c.name,'required maxlength="100" placeholder="Name used in reporting" autofocus')+
    field('Website domain','domain',c.domain,'required maxlength="253" placeholder="example.com"')+
    '<p class="sdv-note" style="margin-top:6px">Agree which domain belongs to this record before mapping properties. A domain-wide Search Console property or shared GA4 property mapped to two clients inflates portfolio totals.</p>'+
    field('Accountable operator','operator',c.operator,'maxlength="120" placeholder="Who investigates this client\'s signals"')+
    field('Client contact','contact',c.contact,'maxlength="200" placeholder="Name and role. No patient information."')+
    field('Key events tracked','keyEvents',c.keyEvents,'maxlength="500" placeholder="e.g. form_submit, phone_tap, whatsapp_click"')+
    field('GA4 reporting time zone','timeZone',zone,'maxlength="64" placeholder="Asia/Kolkata"')+
    '<label>Onboarding notes<textarea name="notes" maxlength="2000" placeholder="Approvals, reporting scope, chosen locations, shared properties">'+esc(c.notes||'')+'</textarea></label>'+
    formFooter(existing?'Save changes':'Create client')+'</form>');
  onForm(d,async f=>{
    const name=f.name.trim(),raw=f.domain.trim();
    if(!name)throw Error('Enter a client name.');
    let url;try{url=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);}catch{throw Error('Enter a valid website domain.');}
    if(!safeUrl(url.href)||!url.hostname.includes('.')||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Enter the website domain without a path or query string.');
    const body={name,domain:url.hostname.toLowerCase(),operator:f.operator.trim(),contact:f.contact.trim(),keyEvents:f.keyEvents.trim(),timeZone:f.timeZone.trim(),notes:f.notes.trim()};
    if(existing&&body.domain!==existing.domain.replace(/^www\./,'')&&!confirm('Changing the domain changes which AI citations count as first-party. Continue?'))return false;
    await api(existing?'/api/clients/'+encodeURIComponent(existing.id):'/api/clients',existing?'PATCH':'POST',body);
    return existing?'Client record updated.':'Client added.';
  });
}
function newClient(){clientForm(null);}
function deleteClientDialog(id){
  const c=findClient(id);if(!c)return;
  const b=bindings().filter(x=>x.clientId===id),sig=signals().filter(x=>x.clientId===id),obs=aiRows().filter(x=>x.clientId===id);
  const shared=[...new Set(b.map(x=>x.accountId))].map(acc=>sources().find(a=>a.id===acc)).filter(Boolean).map(a=>a.email+' (also used by '+n(bindings().filter(x=>x.accountId===a.id&&x.clientId!==id).length)+' other mappings)');
  const d=dialog('Offboard '+c.name,'<form><p class="sdv-note">This permanently removes the client record and, from this workspace:</p><ul class="sdv-note"><li>'+n(b.length)+' property mappings and their stored readings</li><li>'+n(sig.length)+' signals with their incident history</li><li>'+n(obs.length)+' AI observations and failed-run records</li><li>All weekly reviews</li></ul>'+
    (shared.length?'<p class="sdv-note"><strong>Google identities stay connected:</strong> '+esc(shared.join('; '))+'. Revoke obsolete access in Connections once no other client relies on it.</p>':'')+
    '<label>Type the domain to confirm<input name="confirm" autocomplete="off" placeholder="'+esc(c.domain)+'"></label><p class="sdv-note" style="margin-top:8px">Record the confirmation, owner and date in the agency access register.</p>'+formFooter('Offboard client','danger')+'</form>');
  onForm(d,async f=>{
    if(f.confirm.trim().toLowerCase()!==c.domain)throw Error('Type '+c.domain+' to confirm.');
    await api('/api/clients/'+encodeURIComponent(id),'DELETE');
    viewMemory.detailId='';
    return c.name+' was offboarded.';
  });
}
function exportClient(id){
  const c=findClient(id);if(!c)return;
  const cols=['client','domain','source','property','resource_id','date','sessions','users','key_events','ai_referral_sessions','clicks','impressions','ctr','position','profile_impressions','call_clicks','website_clicks','direction_requests','last_successful_sync'];
  const keys={sessions:'sessions',users:'users',key_events:'keyEvents',ai_referral_sessions:'aiSessions',clicks:'clicks',impressions:'impressions',ctr:'ctr',position:'position',profile_impressions:'impressions',call_clicks:'calls',website_clicks:'websiteClicks',direction_requests:'directions'};
  const gbpOnly=new Set(['profile_impressions','call_clicks','website_clicks','direction_requests']),gscOnly=new Set(['clicks','impressions','ctr','position']),gaOnly=new Set(['sessions','users','key_events','ai_referral_sessions']);
  const cell=v=>{const t=v===null||v===undefined?'':String(v);return /[",\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;};
  const lines=[cols.join(',')];
  for(const b of bindings().filter(x=>x.clientId===id))for(const p of [...(b.points||[])].sort((a,z)=>a.date.localeCompare(z.date))){
    lines.push(cols.map(k=>{
      if(k==='client')return cell(c.name);if(k==='domain')return cell(c.domain);if(k==='source')return cell(b.source);
      if(k==='property')return cell(b.label);if(k==='resource_id')return cell(b.resourceId);if(k==='date')return cell(p.date);if(k==='last_successful_sync')return cell(b.lastSync);
      if((gbpOnly.has(k)&&b.source!=='gbp')||(gscOnly.has(k)&&b.source!=='gsc')||(gaOnly.has(k)&&b.source!=='ga4'))return '';
      return cell(p[keys[k]]);
    }).join(','));
  }
  if(lines.length===1){toast('No daily readings are stored for this client yet.');return;}
  const url=URL.createObjectURL(new Blob([lines.join('\n')+'\n'],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=(c.domain||'client')+'-daily-readings-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  toast('Exported '+n(lines.length-1)+' daily rows. Reconcile them against the native reports for the same dates and filters.');
}
function reviewDialog(clientId){
  const c=findClient(clientId);if(!c)return;
  const now=new Date(),monday=new Date(now.getTime()-((now.getDay()+6)%7)*86400000).toISOString().slice(0,10);
  const d=dialog('Weekly review · '+c.name,'<form><label>Week of<input type="date" name="weekOf" value="'+monday+'" required></label>'+
    '<label>One material risk<textarea name="risk" maxlength="1000" placeholder="e.g. Booking form key events fell 60% while sessions held"></textarea></label>'+
    '<label>One verified gain<textarea name="gain" maxlength="1000" placeholder="e.g. Knee replacement page gained 40 clicks after the title change"></textarea></label>'+
    '<label>Concrete next action<textarea name="nextAction" required maxlength="1000"></textarea></label>'+
    '<div class="sdv-grid" style="grid-template-columns:1fr 1fr;gap:10px"><label>Owner<input name="actionOwner" required maxlength="120" value="'+esc(c.operator||'')+'"></label><label>Due date<input type="date" name="dueDate"></label></div>'+
    '<label>Metric that would show recovery<input name="recoveryMetric" maxlength="300" placeholder="e.g. form_submit key events back above 5 per day"></label>'+formFooter('Save review')+'</form>');
  onForm(d,async f=>{
    const body={weekOf:f.weekOf,risk:f.risk.trim(),gain:f.gain.trim(),nextAction:f.nextAction.trim(),actionOwner:f.actionOwner.trim(),dueDate:f.dueDate||null,recoveryMetric:f.recoveryMetric.trim()};
    if(modeDemo()){saveDemoReview(clientId,{...body,id:'sample-'+crypto.randomUUID(),clientId,status:'open',createdAt:new Date().toISOString()});return 'Sample review saved in this browser.';}
    await api('/api/clients/'+encodeURIComponent(clientId)+'/reviews','POST',body);reviewState.id='';return 'Weekly review saved.';
  });
}
function saveDemoReview(clientId,review,replace=false){
  let all={};try{all=JSON.parse(localStorage.getItem('signal-desk.demo.reviews')||'{}');}catch{}
  const list=all[clientId]||[];
  all[clientId]=replace?list.map(r=>r.id===review.id?review:r):[review,...list];
  try{localStorage.setItem('signal-desk.demo.reviews',JSON.stringify(all));}catch{}
  reviewState={id:'',data:null,error:null};
}
async function setReviewStatus(value){
  const [id,status]=value.split('|'),clientId=viewMemory.detailId;
  if(modeDemo()){const r=demoReviews(clientId).find(x=>x.id===id);if(r)saveDemoReview(clientId,{...r,status},true);draw();return;}
  await api('/api/clients/'+encodeURIComponent(clientId)+'/reviews/'+encodeURIComponent(id),'PATCH',{status});
  await loadReviews(clientId,true);toast(status==='done'?'Review marked done.':'Review reopened.');
}
const eventLabels={detected:'Detected',recurred:'Recurred',acknowledged:'Acknowledged',assigned:'Assignment',outcome:'Review outcome',note:'Note',resolved:'Resolved',reopened:'Reopened',recovered:'Recovered automatically'};
function signalDetails(id){
  const s=signals().find(x=>String(x.id)===String(id));if(!s)return;
  const status=s.status||'open';
  const numbers=Object.entries(s.metrics||{}).filter(([,v])=>typeof v==='string'||typeof v==='number');
  const details=numbers.length?'<dl class="sdv-facts">'+numbers.map(([k,v])=>'<dt>'+esc(cap(k.replace(/([A-Z])/g,' $1').replace(/_/g,' ')))+'</dt><dd>'+esc(typeof v==='number'?n(v):v)+'</dd>').join('')+'</dl>':'';
  const binding=bindings().find(b=>b.id===s.bindingId);
  const canLocate=binding&&['ga4','gsc'].includes(binding.source)&&/^\d{4}-\d{2}-\d{2}$/.test(s.metrics?.date||'')&&['drop','gain'].includes(s.kind);
  const d=dialog('Review signal','<div class="sdv-title-line">'+chip(cap(severity(s)),severity(s)==='critical'?'bad':severity(s)==='warning'?'warn':'cool')+chip(cap(status))+(s.occurrences>1?chip('Recurred ×'+n(s.occurrences),'warn'):'')+'</div><h3 style="margin-top:13px">'+esc(s.title)+'</h3><p class="sdv-sub">'+esc(clientName(s.clientId))+' · '+esc(provider(s.source))+(binding?' · '+esc(binding.label||binding.resourceId):'')+' · First seen '+esc(dateText(s.firstSeen||s.observedAt,true))+'</p>'+
    '<div class="sdv-detail" style="margin-top:15px"><h3>What changed</h3><p>'+esc(s.detail||s.description||'Review the source report for this change.')+'</p>'+details+'</div>'+
    '<div class="sdv-detail"><h3>Suggested check</h3><p>'+esc(s.action||s.nextStep||'Check the source property and confirm whether the recent change was expected.')+'</p><p class="sdv-note" style="margin-top:6px">A highlighted movement is evidence of a change. Attributing it to a release, ranking update, holiday or demand shift needs a separate check.</p>'+
      (canLocate?'<p style="margin-top:10px">'+action('Locate the change by page, query or channel','breakdown',binding.id+'|'+s.metrics.date+'|'+(s.metrics.metric||''),'small','search')+'</p>':'')+'</div>'+
    '<form data-incident><div class="sdv-grid" style="grid-template-columns:1fr 1fr;gap:10px"><label>Assignee<input name="assignee" maxlength="120" value="'+esc(s.assignee||'')+'" placeholder="Named operator"></label>'+
    '<label>Review outcome<select name="outcome"><option value="">Not reviewed yet</option>'+Object.entries(outcomeLabels).map(([k,v])=>'<option value="'+k+'"'+(s.outcome===k?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label></div>'+
    '<label>'+(status==='resolved'?'Note':'Note or repair evidence')+'<textarea name="note" maxlength="2000" placeholder="'+(status==='resolved'?'Add context to this incident':'Required to resolve: the fix, its date and how you verified it in the native tool')+'"></textarea></label>'+
    (s.resolutionNote?'<p class="sdv-note" style="margin-top:6px"><strong>Resolution evidence:</strong> '+esc(s.resolutionNote)+'</p>':'')+
    '<p class="sdv-error" data-error role="alert" hidden></p><div class="sdv-row-actions" style="margin-top:12px">'+
      '<button type="button" class="sdv-action" data-incident-act="save">Save</button>'+
      (status==='open'?'<button type="button" class="sdv-action" data-incident-act="acknowledged">'+icon('check',16)+'Acknowledge</button>':'')+
      (status!=='resolved'?'<button type="button" class="sdv-action primary" data-incident-act="resolved">'+icon('checkCircle',16)+'Resolve with evidence</button>':(s.recoveredAt?'':'<button type="button" class="sdv-action primary" data-incident-act="open">'+icon('activity',16)+'Reopen signal</button>'))+
    '</div></form><h3 style="margin-top:18px">Incident timeline</h3><ol class="sdv-evidence-links" data-timeline><li class="sdv-note">'+(modeDemo()?'Timelines are recorded in the live workspace.':'Loading timeline…')+'</li></ol>');
  const form=d.querySelector('[data-incident]'),list=d.querySelector('[data-timeline]');
  const showTimeline=events=>{list.innerHTML=events.length?events.map(e=>'<li><strong>'+esc(eventLabels[e.kind]||cap(e.kind))+'</strong> <span class="sdv-sub">'+esc(dateText(e.at,true))+'</span>'+(e.note?'<span class="sdv-sub">'+esc(e.note)+'</span>':'')+'</li>').join(''):'<li class="sdv-note">No recorded events yet.</li>';};
  if(!modeDemo())api('/api/alerts/'+encodeURIComponent(id)).then(r=>{if(d.isConnected)showTimeline(r.events||[]);}).catch(e=>{if(d.isConnected)list.innerHTML='<li class="sdv-error">'+esc(e.message)+'</li>';});
  form.querySelectorAll('[data-incident-act]').forEach(btn=>btn.onclick=async()=>{
    const act=btn.dataset.incidentAct,note=form.elements.note.value.trim(),body={};
    const assignee=form.elements.assignee.value.trim(),outcome=form.elements.outcome.value||null;
    if(assignee!==(s.assignee||''))body.assignee=assignee||null;
    if(outcome!==(s.outcome||null))body.outcome=outcome;
    if(note)body.note=note;
    if(act!=='save')body.status=act;
    if(act==='resolved'&&!note){showError(d,Error('Record the fix, its date and the evidence you verified before resolving.'));form.elements.note.focus();return;}
    if(!Object.keys(body).length){d.close();return;}
    const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
    try{
      const res=await api('/api/alerts/'+encodeURIComponent(id),'PATCH',body);
      if(modeDemo()){d.close();await updated('Signal updated.');return;}
      showTimeline(res.events||[]);form.elements.note.value='';d.close();await updated(act==='resolved'?'Signal resolved with evidence.':'Signal updated.');
    }catch(e){showError(d,e);}finally{buttons.forEach(b=>b.disabled=false);}
  });
}
const breakdownOptions={gsc:[['page','Page'],['query','Query'],['country','Country'],['device','Device']],ga4:[['landingPage','Landing page'],['channel','Channel group'],['device','Device category'],['country','Country']]};
function breakdownDialog(value){
  const [bindingId,givenDate,givenMetric]=String(value).split('|');
  const b=bindings().find(x=>x.id===bindingId);if(!b)return;
  const latest=(b.points||[]).map(p=>p.date).sort().at(-1)||new Date(Date.now()-3*86400000).toISOString().slice(0,10);
  const date=givenDate||latest,compare=new Date(Date.parse(date+'T00:00:00Z')-7*86400000).toISOString().slice(0,10);
  const metrics=b.source==='gsc'?[['clicks','Clicks'],['impressions','Impressions']]:[['sessions','Sessions'],['keyEvents','Key events']];
  const metric=metrics.some(([k])=>k===givenMetric)?givenMetric:metrics[0][0];
  const d=dialog('Locate the change · '+(b.label||b.resourceId),'<form data-locate><p class="sdv-note">Compares one completed reporting day with a matched comparison day (default: the same weekday a week earlier). Identical property, search type and filters are used for both days.</p>'+
    '<div class="sdv-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:10px"><label>Break down by<select name="dimension">'+breakdownOptions[b.source].map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('')+'</select></label>'+
    '<label>Sort by<select name="metric">'+metrics.map(([k,v])=>'<option value="'+k+'"'+(k===metric?' selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>'+
    '<label>Reporting day<input type="date" name="date" value="'+esc(date)+'" required></label><label>Compare with<input type="date" name="compareDate" value="'+esc(compare)+'" required></label></div>'+
    '<p class="sdv-error" data-error role="alert" hidden></p><div class="sdv-row-actions" style="margin-top:10px"><button type="submit" class="sdv-action primary">'+icon('search',16)+'Compare days</button></div></form><div data-result style="margin-top:14px"></div>');
  const form=d.querySelector('[data-locate]'),out=d.querySelector('[data-result]');
  const fmt=(k,v)=>v===null||v===undefined?'—':k==='ctr'?(v*100).toFixed(2)+'%':k==='position'?Number(v).toFixed(1):n(v);
  const run=async()=>{
    const f=Object.fromEntries(new FormData(form));out.innerHTML='<p class="sdv-note">Requesting both days from Google…</p>';
    const err=d.querySelector('[data-error]');err.hidden=true;
    try{
      const r=await api('/api/google/breakdown?'+new URLSearchParams({bindingId,dimension:f.dimension,metric:f.metric,date:f.date,compareDate:f.compareDate}));
      const m=r.metric,extra=b.source==='gsc'?['ctr','position']:[metrics.find(([k])=>k!==m)[0]];
      const head='<tr><th>'+esc(breakdownOptions[b.source].find(([k])=>k===r.dimension)?.[1]||r.dimension)+'</th><th>'+esc(dateText(r.date))+'</th><th>'+esc(dateText(r.compareDate))+'</th><th>Change</th>'+extra.map(k=>'<th>'+esc(cap(k.replace(/([A-Z])/g,' $1')))+' (then → now)</th>').join('')+'</tr>';
      const rows=r.rows.map(x=>'<tr><td style="max-width:320px;overflow-wrap:anywhere">'+esc(x.key)+'</td><td>'+fmt(m,x[m])+'</td><td>'+fmt(m,x[m+'Previous'])+'</td><td>'+chip((x[m+'Change']>0?'+':'')+n(x[m+'Change']),x[m+'Change']<0?'bad':x[m+'Change']>0?'good':'neutral')+'</td>'+extra.map(k=>'<td>'+fmt(k,x[k+'Previous'])+' → '+fmt(k,x[k])+'</td>').join('')+'</tr>').join('');
      out.innerHTML='<p class="sdv-sub">Listed rows: '+fmt(m,r.totals[m])+' on '+esc(dateText(r.date))+' vs '+fmt(m,r.totals[m+'Previous'])+' on '+esc(dateText(r.compareDate))+'. '+esc(r.note)+(r.truncated?' Only the top 250 rows per day were requested.':'')+'</p>'+
        (r.rows.length?'<div class="sdv-table-scroll" style="margin-top:10px"><table class="sdv-table"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table></div>':'<p class="sdv-note">Google returned no rows for these days.</p>')+
        '<p class="sdv-note" style="margin-top:10px">Log the affected URLs and dates on the signal before changing a title or page.</p>';
    }catch(e){out.innerHTML='';showError(d,e);}
  };
  form.onsubmit=e=>{e.preventDefault();run();};
  run();
}
function setupDialog(){
  if(modeDemo()){callbacks.setMode?.('live');return;}
  const setup=model.google?.setup||{}, redirect=setup.redirectUri||'';
  if(setup.canConfigure===false||sources().length){
    dialog('Google OAuth setup','<div class="sdv-detail"><p>'+esc(sources().length?'Disconnect the currently authorised accounts before replacing OAuth credentials.':'The deployment needs a canonical HTTPS callback URL and a token encryption key before OAuth credentials can be saved.')+'</p></div>'+(redirect?'<label>Authorised redirect URI<input readonly value="'+esc(redirect)+'"></label>':''));
    return;
  }
  const googleLink='<a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud credentials</a>';
  const d=dialog('Configure Google OAuth','<div class="sdv-detail"><p>Create a Web application OAuth client in '+googleLink+'. Enable the Analytics Admin, Analytics Data and Search Console APIs. For business locations, enable Google’s Business Profile account management, business information and performance APIs in a project with Business Profile access.</p></div>'+
    (redirect?'<label>Authorised redirect URI<input data-redirect readonly value="'+esc(redirect)+'"></label><button type="button" class="sdv-action small" data-copy style="margin-top:8px">Copy URI</button>':'<p class="sdv-note" style="margin-top:10px">Set the canonical HTTPS callback URL on the deployment to display its authorised redirect URI.</p>')+
    '<form autocomplete="off"><label>OAuth client ID<input required name="clientId" maxlength="350" autocomplete="off" placeholder="Client ID from Google Cloud"></label><label>OAuth client secret<input required type="password" name="clientSecret" maxlength="350" autocomplete="new-password" placeholder="Client secret from Google Cloud"></label><p class="sdv-note" style="margin-top:10px">Credentials are stored by the server. To change the OAuth client later, disconnect its Google accounts first.</p>'+formFooter('Save configuration')+'</form>');
  const copy=d.querySelector('[data-copy]');
  if(copy)copy.onclick=async()=>{try{await navigator.clipboard.writeText(redirect);copy.textContent='Copied';}catch{const field=d.querySelector('[data-redirect]');field.select();copy.textContent='URI selected';}};
  onForm(d,async f=>{await api('/api/google/config','POST',{clientId:f.clientId.trim(),clientSecret:f.clientSecret.trim()});return 'Google OAuth configuration saved.';});
}
function connectDialog(){
  if(modeDemo()){callbacks.setMode?.('live');return;}
  const d=dialog('Connect a Google account','<form><p class="sdv-note">Choose a Google account that can read the client properties you want to monitor. You can add more accounts later.</p><label class="sdv-inline-check"><input type="checkbox" name="includeBusiness" value="yes"> Include Google Business Profile locations</label>'+formFooter('Continue with Google')+'</form>');
  onForm(d,async f=>{
    const res=await api('/api/google/start','POST',{includeBusiness:f.includeBusiness==='yes'});
    const u=new URL(res.url);if(u.protocol!=='https:'||u.hostname!=='accounts.google.com')throw Error('Google did not return a valid authorisation URL.');
    window.location.assign(u.href);
  },{skipRefresh:true});
}
function confirmDelete(type,id){
  const account=type==='disconnect', item=(account?sources():bindings()).find(r=>String(r.id)===String(id));
  if(!item)return;
  const d=dialog(account?'Disconnect Google account':'Unlink property','<form><p class="sdv-note">'+esc(account?'Disconnecting '+(item.email||item.label||'this account')+' removes its links from this workspace and stops new syncs.':'Unlinking '+(item.label||item.resourceId)+' removes this property and its saved source readings from the client.')+'</p>'+formFooter(account?'Disconnect account':'Unlink property','danger')+'</form>');
  onForm(d,async()=>{await api('/api/google/'+(account?'accounts':'bindings')+'/'+encodeURIComponent(id),'DELETE');return account?'Account disconnected.':'Property unlinked.';});
}
function bindProperty(accountId){
  if(!clientList().length){newClient();return;}
  const account=sources().find(a=>String(a.id)===String(accountId)),client=viewMemory.detailId||model.clientId;
  if(!account)return;
  const d=dialog('Link a Google property','<form><p class="sdv-note">'+esc(account.email||account.label||'Google account')+'</p><label>Client<select required name="clientId">'+optionsClients(client)+'</select></label><label>Source<select name="source">'+Object.entries(providerShort).filter(([id])=>['ga4','gsc','gbp'].includes(id)).map(([id])=>'<option value="'+id+'">'+esc(provider(id))+'</option>').join('')+'</select></label><label>Available property<select required name="resourceId" disabled><option value="">Loading properties…</option></select></label><p class="sdv-note" data-discovery-note style="margin-top:7px"></p><div class="sdv-row-actions"><button type="button" class="sdv-action small" data-load hidden>Load more</button><button type="button" class="sdv-action small" data-retry hidden>Retry discovery</button></div>'+formFooter('Link property')+'</form>');
  const form=d.querySelector('form'),select=form.elements.resourceId,source=form.elements.source,load=d.querySelector('[data-load]'),retry=d.querySelector('[data-retry]'),note=d.querySelector('[data-discovery-note]'),save=form.querySelector('button[type=submit]');
  let resourceList=[], nextPage=null, requestNo=0;
  const discover=async(append=false)=>{
    const token=++requestNo;if(!append){resourceList=[];nextPage=null;select.innerHTML='<option value="">Loading properties…</option>';}
    const src=source.value,params=new URLSearchParams({accountId,source:src});if(append&&nextPage)params.set('pageToken',nextPage);
    select.disabled=true;save.disabled=true;load.hidden=true;retry.hidden=true;note.textContent='Loading available properties…';
    try{
      const res=await api('/api/google/discover?'+params);if(!d.isConnected||token!==requestNo)return;
      resourceList=[...new Map([...resourceList,...(res.resources||[])].map(r=>[r.id,r])).values()];nextPage=res.nextPageToken;
      const existing=new Set(bindings().filter(b=>b.source===src).map(b=>b.resourceId));
      const selected=select.value,available=resourceList.filter(r=>!existing.has(r.id));
      select.innerHTML='<option value="">Choose a property</option>'+resourceList.map(r=>'<option value="'+esc(r.id)+'" '+(existing.has(r.id)?'disabled':'')+'>'+esc((r.label||r.id)+(r.description&&r.description!==r.label?' · '+r.description:'')+(existing.has(r.id)?' · already linked':''))+'</option>').join('');
      if(available.some(r=>r.id===selected))select.value=selected;else if(available.length===1)select.value=available[0].id;
      select.disabled=!available.length;save.disabled=!available.length;
      note.textContent=resourceList.length?(available.length?'Choose the property assigned to this client.':'All listed properties are already linked.'):'Google returned no properties for this source and account. Check access in the source product.';
      load.hidden=!nextPage;
    }catch(e){if(!d.isConnected||token!==requestNo)return;note.textContent=e.message;retry.hidden=false;if(!append)select.innerHTML='<option value="">Discovery unavailable</option>';}
  };
  source.onchange=()=>discover();load.onclick=()=>discover(true);retry.onclick=()=>discover(Boolean(nextPage));discover();
  onForm(d,async f=>{
    const resource=resourceList.find(r=>r.id===f.resourceId);if(!resource)throw Error('Choose an available property.');
    await api('/api/google/bindings','POST',{accountId,clientId:f.clientId,source:f.source,resourceId:resource.id,label:resource.label||resource.id});
    return modeDemo()?'Sample property linked.':'Property linked. Review the latest sync status below.';
  });
}
function showProfile(id){
  const b=bindings().find(x=>x.id===id);if(!b)return;
  const p=b.profile||{},a=p.storefrontAddress||{},ph=p.phoneNumbers||{};
  const vals=[['Business name',p.title],['Phone',[ph.primaryPhone,...(ph.additionalPhones||[])].filter(Boolean).join(', ')],['Address',[...(a.addressLines||[]),a.locality,a.administrativeArea,a.postalCode,a.regionCode].filter(Boolean).join(', ')],['Primary category',p.categories?.primaryCategory?.displayName],['Open status',p.openInfo?.status],['Website',p.websiteUri]];
  const periods=(p.regularHours?.periods||[]).map(x=>{const time=v=>String(v?.hours||0).padStart(2,'0')+':'+String(v?.minutes||0).padStart(2,'0');return cap(String(x.openDay||'').toLowerCase())+' '+time(x.openTime)+' – '+(x.closeDay!==x.openDay?cap(String(x.closeDay||'').toLowerCase())+' ':'')+time(x.closeTime);});
  dialog('Business Profile details','<p class="sdv-sub">'+esc(clientName(b.clientId))+'</p><dl class="sdv-facts">'+vals.filter(([,v])=>v).map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>').join('')+(periods.length?'<dt>Regular hours</dt><dd>'+periods.map(esc).join('<br>')+'</dd>':'')+'</dl><p class="sdv-note">Last synced '+esc(dateText(b.lastSync,true))+'.</p>');
}
function addEvidence(sample=false){
  if(!clientList().length){newClient();return;}
  const selected=viewMemory.aiClient==='all'?model.clientId:viewMemory.aiClient;
  const today=new Date().toISOString().slice(0,10);
  const panel='<label>Prompt type<select name="promptType" required><option value="discovery"'+(viewMemory.aiType==='branded'?'':' selected')+'>Discovery · does not name the client</option><option value="branded"'+(viewMemory.aiType==='branded'?' selected':'')+'>Branded · names the client or doctor</option></select></label>'+
    '<div class="sdv-grid" style="grid-template-columns:1fr 1fr;gap:10px"><label>Language<input name="language" maxlength="40" value="English"></label><label>City<input name="city" maxlength="80" value="Bengaluru"></label></div>';
  const d=dialog(sample?'Run a visibility prompt':'Record an AI answer','<form><label>Client<select required name="clientId">'+optionsClients(selected)+'</select></label>'+
    (sample?'':'<label>Answer engine and surface<select name="engine"><option>ChatGPT</option><option>Google AI Overviews</option><option>Google AI Mode</option><option>Perplexity</option><option>Gemini</option><option>Claude</option><option>Copilot</option><option>Other</option></select></label>')+
    panel+'<label>Prompt<textarea required name="prompt" maxlength="1000" placeholder="Enter the exact question asked. Avoid patient names or clinical details."></textarea></label>'+
    (sample?'<p class="sdv-note" style="margin-top:10px">'+esc(modeDemo()?'This demonstration creates an illustrative answer without calling a provider.':'This runs one web-search prompt using the configured API account and may incur provider charges. A failed run still uses the allowance and is logged separately. Remaining allowance: '+n(model.ai?.remaining)+' of '+n(model.ai?.dailyLimit)+' today.')+'</p>':
      '<label class="sdv-inline-check"><input type="checkbox" name="failed" value="yes"> The engine errored, refused or returned no usable answer</label>'+
      '<label>Answer text<textarea name="answer" maxlength="16000" placeholder="Paste the answer as shown by the engine"></textarea></label><label>Cited URLs <small class="sdv-sub">Optional · one URL per line</small><textarea name="citations" maxlength="15000" placeholder="https://example.com/article"></textarea></label><label>Observation date<input name="date" type="date" value="'+today+'" max="'+today+'" required></label>')+formFooter(sample?(modeDemo()?'Run sample':'Run prompt'):'Save observation')+'</form>');
  onForm(d,async f=>{
    const prompt=f.prompt.trim();if(!prompt)throw Error('Enter the exact prompt.');
    const meta={promptType:f.promptType,language:f.language.trim()||undefined,city:f.city.trim()||undefined};
    if(sample){await api('/api/ai/sample','POST',{clientId:f.clientId,prompt,...meta});return 'Prompt completed. Open the observation to review the answer.';}
    if(f.failed==='yes'){
      await api('/api/ai/failures','POST',{clientId:f.clientId,engine:f.engine,prompt,promptType:f.promptType,error:f.answer.trim().slice(0,500)||'No usable answer was returned.'});
      return 'Failed run logged. It is excluded from the visibility rates.';
    }
    const answer=f.answer.trim();if(!answer)throw Error('Paste the answer text, or mark the run as failed.');
    const lines=[...new Set(f.citations.split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];
    if(lines.some(v=>!safeUrl(v)))throw Error('Enter one complete HTTP or HTTPS citation URL on each line.');
    const observedAt=f.date===today?new Date().toISOString():f.date+'T12:00:00.000Z';
    await api('/api/ai/observations','POST',{clientId:f.clientId,engine:f.engine,prompt,answer,observedAt,...meta,citations:lines.map(url=>({url:safeUrl(url),title:new URL(url).hostname}))});
    return 'Observation saved.';
  });
}
function annotationText(o){
  const answer=String(o.answer||''), links=(o.citations||[]).filter(c=>safeUrl(c.url)&&Number.isInteger(c.startIndex)&&Number.isInteger(c.endIndex)&&c.startIndex>=0&&c.endIndex>c.startIndex&&c.endIndex<=answer.length).sort((a,b)=>a.startIndex-b.startIndex);
  let cursor=0,text='';
  for(const link of links){if(link.startIndex<cursor)continue;text+=esc(answer.slice(cursor,link.startIndex))+'<a target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(link.url))+'">'+esc(answer.slice(link.startIndex,link.endIndex))+'</a>';cursor=link.endIndex;}
  return text+esc(answer.slice(cursor));
}
function seeEvidence(id){
  const o=observationsForFilter().find(r=>String(r.id)===String(id));if(!o)return;
  const links=(o.citations||[]).filter(c=>safeUrl(c.url));
  dialog('Observation evidence','<div class="sdv-title-line">'+chip(o.mentioned?'Mentioned':'No mention',o.mentioned?'good':'neutral')+chip(o.cited?'Domain cited':'No domain citation',o.cited?'cool':'neutral')+'</div><p class="sdv-sub">'+esc([clientName(o.clientId),o.engine,o.model,dateText(o.observedAt,true)].filter(Boolean).join(' · '))+'</p><div class="sdv-detail" style="margin-top:15px"><h3>Prompt</h3><p>'+esc(o.prompt)+'</p></div><div class="sdv-detail"><h3>Answer</h3><p>'+annotationText(o)+'</p></div><h3 style="margin-top:16px">Sources cited</h3>'+(links.length?'<ol class="sdv-evidence-links">'+links.map(c=>'<li><a target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(c.url))+'">'+esc(c.title||c.url)+'</a><span class="sdv-sub">'+esc(new URL(c.url).hostname)+'</span></li>').join('')+'</ol>':'<p class="sdv-note">No source URLs recorded.</p>'));
}
async function handleAction(key,val,button){
  if(button.disabled)return;
  try{
    switch(key){
      case 'nav':callbacks.navigate(val);break;
      case 'live':await callbacks.setMode('live');break;
      case 'switchMode':await callbacks.setMode(modeDemo()?'live':'demo');break;
      case 'clientDetail':viewMemory.detailId=val;draw();holder.querySelector('h1')?.scrollIntoView({block:'nearest'});break;
      case 'clientList':viewMemory.detailId='';draw();break;
      case 'overviewClient':await callbacks.selectClient(val);callbacks.navigate('overview');break;
      case 'newClient':newClient();break;
      case 'signalStatus':viewMemory.signalStatus=val;draw();holder.querySelector('[data-vact=signalStatus][aria-pressed=true]')?.focus({preventScroll:true});break;
      case 'signal':signalDetails(val);break;
      case 'setup':setupDialog();break;
      case 'connect':connectDialog();break;
      case 'bind':bindProperty(val);break;
      case 'unlink':case 'disconnect':confirmDelete(key,val);break;
      case 'profile':showProfile(val);break;
      case 'addEvidence':addEvidence(false);break;
      case 'sample':addEvidence(true);break;
      case 'evidence':seeEvidence(val);break;
      case 'retryAi':scopedAi.base=undefined;await getScopedAi();break;
      case 'editClient':clientForm(findClient(val));break;
      case 'deleteClient':deleteClientDialog(val);break;
      case 'exportClient':exportClient(val);break;
      case 'addReview':reviewDialog(val);break;
      case 'reviewStatus':await setReviewStatus(val);break;
      case 'retryReviews':await loadReviews(val,true);break;
      case 'breakdown':breakdownDialog(val);break;
      case 'runCheck':{button.disabled=true;button.textContent='Checking…';await api('/api/alerts/check','POST',viewMemory.signalClient==='all'?{}:{clientId:viewMemory.signalClient});await updated('Health check completed.');break;}
      case 'sync':{button.disabled=true;button.textContent='Syncing…';const r=await api('/api/google/sync','POST',{});const errors=(r.results||[]).filter(x=>x.error||x.status==='error').length;
        await updated(errors?'Sync completed with '+errors+' source issue'+(errors===1?'':'s')+'. See linked properties.':r.remaining?'Synced '+n(r.processed)+' properties. Additional properties are queued.':'Property sync completed.');break;}
      case 'schedule':{button.disabled=true;await api('/api/settings','PATCH',{scheduleEnabled:val==='resume'});await updated(val==='resume'?'Scheduled checks enabled.':'Scheduled checks paused.');break;}
    }
  }catch(e){toast(e?.message||'The action could not be completed.');if(holder&&model)draw();}
}
