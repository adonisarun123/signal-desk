import {icon} from './overview.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n = (value) => value === null || value === undefined || !Number.isFinite(Number(value)) ? '—' : Intl.NumberFormat(undefined, {maximumFractionDigits:1}).format(Number(value));
const cap = (value) => value ? String(value).charAt(0).toUpperCase()+String(value).slice(1) : 'Unknown';
const providerNames = {ga4:'Google Analytics 4', gsc:'Search Console', gbp:'Business Profile', ai:'AI visibility', system:'Workspace'};
const providerShort = {ga4:'GA4', gsc:'Search Console', gbp:'Business Profile', ai:'AI visibility'};
const providerIcons = {ga4:'chart',gsc:'search',gbp:'globe',ai:'spark'};
const providerCopy = {ga4:'Active users, sessions, key events and AI referrals.', gsc:'Organic clicks, impressions, CTR and average position.', gbp:'Location details, profile views, calls and directions.'};
const palette = [['#deede8','#235d48'],['#ebe8fa','#62538e'],['#fae9dc','#92603d'],['#dfeaf6','#416486'],['#f4e3ed','#8b5571'],['#e9eccd','#69753d']];
const viewMemory = {mode:'',detailId:'',signalStatus:'open',signalClient:'all',aiClient:'all',text:''};
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
  return '<div class="sdv-table-scroll"><table class="sdv-table"><thead><tr><th>Client</th><th>Sources</th><th>Health</th><th>Open signals</th><th><span class="sdv-note">Details</span></th></tr></thead><tbody>'+list.map(c=>{
    const count=signals().filter(s=>s.clientId===c.id && (s.status||'open')==='open').length;
    const sourceLabels=clientSources(c.id);
    return '<tr data-search="'+esc([c.name,c.domain,sourceLabels.join(' ')].join(' ').toLowerCase())+'"><td><button type="button" class="sdv-link-btn" data-vact="clientDetail" data-val="'+esc(c.id)+'">'+avatar(c)+'<span>'+esc(c.name)+'<small class="sdv-sub">'+esc(c.domain||'Domain not set')+'</small></span></button></td><td>'+esc(sourceLabels.join(' · ') || 'No properties')+'</td><td>'+chip(quality(c),toneFor(quality(c)))+'</td><td>'+n(count)+'</td><td>'+action('View','clientDetail',c.id,'small')+'</td></tr>';
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
  heading(c.name,c.domain || 'Client details',action('Manage connections','nav','connections','','plug')+action('View overview','overviewClient',sid,'primary','grid'))+
  '<div class="sdv-grid sdv-stat-grid">'+stat('Health',quality(c),'Current source checks')+stat('Active signals',n(sig.length),'Open or acknowledged')+stat('AI observations',n(obs.length),'Recorded answers')+'</div>'+
  section('Latest reported metrics','Daily readings are shown separately for each linked property.',b.length?b.map(latestMetrics).join(''):empty('Waiting for properties','Daily source metrics appear after a linked property syncs.','chart'))+
  section('Connected properties','Each source has its own reporting cadence.',b.length?b.map(bindingRow).join(''):empty('No property connected','Choose an account and bind a property to this client.','plug',action('Manage connections','nav','connections','small')))+
  section('Active signals','',sig.length?sig.map(signalRow).join(''):empty('No active signals','The next check will surface changes when enough source data is available.','activity'));
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
  return '<div class="sdv-row"><span class="sdv-outcome-icon '+sev+'">'+icon(sev==='info'?'activity':'triangle',18)+'</span><div class="sdv-row-main"><div class="sdv-title-line"><h3>'+esc(s.title)+'</h3>'+chip(cap(sev),sev==='warning'?'warn':sev==='critical'?'bad':'cool')+(status!=='open'?chip(cap(status),toneFor(status)):'')+'</div><p class="sdv-sub">'+esc(clientName(s.clientId))+' · '+esc(provider(s.source))+' · '+esc(dateText(s.observedAt||s.firstSeen))+'</p><p class="sdv-note">'+esc(s.detail||s.description||'')+'</p></div><div class="sdv-row-actions">'+action('Review','signal',s.id,'small')+'</div></div>';
}
function signalsPage() {
  const all=signals(), matching=all.filter(s=>(viewMemory.signalClient==='all'||s.clientId===viewMemory.signalClient)&&(viewMemory.signalStatus==='all'||(s.status||'open')===viewMemory.signalStatus));
  const ch=checks().filter(c=>viewMemory.signalClient==='all'||c.clientId===viewMemory.signalClient);
  const tabs=['open','acknowledged','resolved','all'].map(s=>'<button type="button" data-vact="signalStatus" data-val="'+s+'" aria-pressed="'+(s===viewMemory.signalStatus)+'">'+cap(s)+'</button>').join('');
  return heading('Health signals','Investigate changes, confirm what needs attention and track your response.',action('Run health check','runCheck','','primary','pulse'))+
  '<div class="sdv-toolbar"><div class="sdv-segment" aria-label="Signal status">'+tabs+'</div>'+selectClient('signalClient',viewMemory.signalClient)+'</div>'+
  section('Signal inbox','',matching.length?matching.map(signalRow).join(''):empty('No '+(viewMemory.signalStatus==='all'?'':viewMemory.signalStatus+' ')+'signals here','New findings appear after a health check. You can review the status of each property below.','checkCircle'),chip(n(matching.length)+' signals'))+
  section('Source health','Latest available check for each connected property.',ch.length?'<div class="sdv-table-scroll"><table class="sdv-table"><thead><tr><th>Client / source</th><th>State</th><th>Finding</th><th>Latest data</th></tr></thead><tbody>'+ch.map(c=>'<tr><td><strong>'+esc(clientName(c.clientId))+'</strong><small class="sdv-sub">'+esc(provider(c.source))+'</small></td><td>'+chip(cap(c.state),toneFor(c.state))+'</td><td>'+esc(c.detail||'—')+'</td><td>'+esc(dateText(c.latestDate))+'</td></tr>').join('')+'</tbody></table></div>':empty('No source checks yet','Connect a Google property and sync its data to begin.','plug'));
}
function bindingRow(b) {
  const prof=b.profile||{},phone=prof.phoneNumbers?.primaryPhone, addr=prof.storefrontAddress, location=[addr?.locality,addr?.administrativeArea].filter(Boolean).join(', ');
  return '<div class="sdv-row">'+sourceIcon(b.source)+'<div class="sdv-row-main"><div class="sdv-title-line"><h3>'+esc(b.label||b.resourceId)+'</h3>'+chip(providerShort[b.source]||b.source)+'</div><p class="sdv-sub">'+esc(clientName(b.clientId))+' · Last synced '+esc(b.lastSync?dateText(b.lastSync,true):'—')+'</p>'+
    (b.source==='ga4'&&b.realtime?.activeUsers!=null?'<p class="sdv-note">'+n(b.realtime.activeUsers)+' active users in the latest 30-minute reading · '+esc(dateText(b.realtime.observedAt,true))+'</p>':'')+
    (b.source==='gbp' && (phone||location||prof.title)?'<p class="sdv-note">'+esc([prof.title,phone,location].filter(Boolean).join(' · '))+'</p>':'')+
    (b.lastError?'<p class="sdv-error">'+esc(b.lastError)+'</p>':'')+'</div><div class="sdv-row-actions">'+(b.source==='gbp'&&Object.keys(prof).length?action('Profile','profile',b.id,'small'):'')+action('Unlink','unlink',b.id,'small')+'</div></div>';
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
function observationsForFilter(){
  const all=viewMemory.aiClient==='all';
  const list=all ? aiRows() : scopedAi.id===viewMemory.aiClient&&scopedAi.data ? scopedAi.data.observations||[] : aiRows();
  return list.filter(o=>all||o.clientId===viewMemory.aiClient);
}
async function getScopedAi(){
  const id=viewMemory.aiClient,base=model?.ai;
  if(id==='all'||!id||!holder||!model||modeDemo()||!callbacks.api || (scopedAi.id===id&&scopedAi.base===base))return;
  const ticket=++aiRequest;scopedAi={id,base,data:null,error:null};
  try{
    const data=await api('/api/ai?'+new URLSearchParams({clientId:id}));
    if(ticket!==aiRequest||model?.view!=='ai'||viewMemory.aiClient!==id||model.ai!==base)return;
    scopedAi.data=data;
  }catch(e){if(ticket!==aiRequest||model?.view!=='ai'||viewMemory.aiClient!==id||model.ai!==base)return;scopedAi.error=e.message;}
  draw();
}
function aiPage(){
  const list=observationsForFilter();
  const totals=(viewMemory.aiClient==='all'?model.ai?.summary:scopedAi.id===viewMemory.aiClient?scopedAi.data?.summary:null)||{};
  const samples=totals.samples??list.length,mentions=totals.mentions??list.filter(o=>o.mentioned).length,citations=totals.citations??list.filter(o=>o.cited).length;
  const haveClient=clientList().length>0;
  const sampling=!!model.ai?.samplingAvailable||modeDemo();
  return heading('AI visibility','Track when a client appears in a recorded AI answer and when the answer cites their website.',
    action('Record an answer','addEvidence','','','plus')+(sampling?action(modeDemo()?'Try a sample':'Run a prompt','sample','','primary','spark'):''))+
  (!haveClient?banner('Create a client to track AI visibility','A client name and domain are used to identify mentions and citations.',action('Add client','newClient','','small')):'')+
  '<div class="sdv-toolbar"><span class="sdv-note">Measured across recorded answers</span>'+selectClient('aiClient',viewMemory.aiClient)+'</div>'+
  '<div class="sdv-grid sdv-stat-grid">'+stat('Recorded answers',n(samples),'In the observation log')+stat('Mention rate',samples?n(100*mentions/samples)+'%':'—',n(mentions)+' answers mention the client')+stat('Citation rate',samples?n(100*citations/samples)+'%':'—',n(citations)+' answers cite the domain')+'</div>'+
  (scopedAi.error&&viewMemory.aiClient===scopedAi.id?banner('Client totals could not be loaded',scopedAi.error,action('Retry','retryAi','','small'),'amber'):'')+
  section('Observation log',samples>list.length?'Showing the '+list.length+' most recent answers. Rates include all recorded observations.':'Read the answer and source links behind each measurement.',list.length?'<div class="sdv-table-scroll"><table class="sdv-table"><thead><tr><th>Prompt / client</th><th>Engine</th><th>Mention</th><th>Citation</th><th>Observed</th><th>Evidence</th></tr></thead><tbody>'+list.map(o=>'<tr><td><strong>'+esc(o.prompt)+'</strong><small class="sdv-sub">'+esc(clientName(o.clientId))+'</small></td><td>'+esc(o.engine||'Unknown')+'<small class="sdv-sub">'+esc(o.method==='api'?'API sample':o.method==='demo'?'Sample':'Recorded manually')+'</small></td><td>'+chip(o.mentioned?'Mentioned':'Absent',o.mentioned?'good':'neutral')+'</td><td>'+chip(o.cited?'Cited':'Absent',o.cited?'cool':'neutral')+'</td><td>'+esc(dateText(o.observedAt))+'</td><td>'+action('Read','evidence',o.id,'small')+'</td></tr>').join('')+'</tbody></table></div>':empty('No answers recorded yet','Paste an observed answer with its citations to start measuring visibility for this client.','spark'))+
  '<p class="sdv-note sdv-section">Rates describe this set of prompts and recorded answers. '+(sampling?'Prompt runs are stored as individual observations.':'Manual recording is available. Automated sampling requires a configured provider.')+'</p>';
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
  if(filterFocusKey){holder.querySelector('[data-vchange="'+filterFocusKey+'"]')?.focus({preventScroll:true});filterFocusKey='';}
}
export function renderView(el,state,actions){
  holder=el;callbacks=actions;
  if(viewMemory.mode!==state.mode){aiRequest++;scopedAi={id:'',base:null,data:null,error:null};Object.assign(viewMemory,{mode:state.mode,detailId:'',signalStatus:'open',signalClient:'all',aiClient:'all',text:''});}
  const oldView=previousPage;previousPage=state.view;
  model=state;
  if(oldView!=='clients'&&state.view==='clients'){viewMemory.detailId=(state.clientId&&state.clientId!=='all')?state.clientId:'';}
  if(oldView!=='signals'&&state.view==='signals')viewMemory.signalClient=state.clientId||'all';
  if(oldView!=='ai'&&state.view==='ai')viewMemory.aiClient=state.clientId||'all';
  draw();
  el.onclick=evt=>{const button=evt.target.closest('button[data-vact]');if(button&&el.contains(button))handleAction(button.dataset.vact,button.dataset.val,button);};
  el.onchange=evt=>{const key=evt.target.dataset.vchange;if(['aiClient','signalClient'].includes(key)){viewMemory[key]=evt.target.value;filterFocusKey=key;draw();}};
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
function newClient(){
  const d=dialog('Add a client','<form><label>Client name<input required name="name" maxlength="100" placeholder="e.g. Makam Multispeciality Clinic" autocomplete="off" autofocus></label><label>Website domain<input required name="domain" maxlength="253" placeholder="example.com" autocomplete="off"></label>'+formFooter('Create client')+'</form>');
  onForm(d,async f=>{
    const name=f.name.trim(),raw=f.domain.trim();
    if(!name)throw Error('Enter a client name.');
    let url;try{url=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);}catch{throw Error('Enter a valid website domain.');}
    if(!safeUrl(url.href)||!url.hostname.includes('.')||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Enter the website domain without a path or query string.');
    await api('/api/clients','POST',{name,domain:url.hostname.toLowerCase()});
    return 'Client added.';
  });
}
function signalDetails(id){
  const s=signals().find(x=>String(x.id)===String(id));if(!s)return;
  const status=s.status||'open';
  const buttons=(status==='open'?action('Acknowledge','change','acknowledged','','check'):'')+(status!=='resolved'?action('Mark resolved','change','resolved','primary','checkCircle'):action('Reopen signal','change','open','primary','activity'));
  const numbers=Object.entries(s.metrics||{}).filter(([,v])=>typeof v==='string'||typeof v==='number');
  const details=numbers.length?'<dl class="sdv-facts">'+numbers.map(([k,v])=>'<dt>'+esc(cap(k.replace(/([A-Z])/g,' $1').replace(/_/g,' ')))+'</dt><dd>'+esc(typeof v==='number'?n(v):v)+'</dd>').join('')+'</dl>':'';
  const d=dialog('Review signal','<div class="sdv-title-line">'+chip(cap(severity(s)),severity(s)==='critical'?'bad':severity(s)==='warning'?'warn':'cool')+chip(cap(status))+'</div><h3 style="margin-top:13px">'+esc(s.title)+'</h3><p class="sdv-sub">'+esc(clientName(s.clientId))+' · '+esc(provider(s.source))+' · '+esc(dateText(s.observedAt||s.firstSeen,true))+'</p>'+
    '<div class="sdv-detail" style="margin-top:15px"><h3>What changed</h3><p>'+esc(s.detail||s.description||'Review the source report for this change.')+'</p>'+details+'</div>'+
    '<div class="sdv-detail"><h3>Suggested action</h3><p>'+esc(s.action||s.nextStep||'Check the source property and confirm whether the recent change was expected.')+'</p></div><p class="sdv-error" data-error role="alert" hidden></p><div class="sdv-row-actions">'+buttons+'</div>');
  d.querySelectorAll('[data-vact=change]').forEach(btn=>btn.onclick=async()=>{
    const buttons=d.querySelectorAll('[data-vact=change]');buttons.forEach(b=>b.disabled=true);
    try{await api('/api/alerts/'+encodeURIComponent(id),'PATCH',{status:btn.dataset.val});d.close();await updated('Signal updated.');}
    catch(e){showError(d,e);}finally{buttons.forEach(b=>b.disabled=false);}
  });
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
  const d=dialog(sample?'Run a visibility prompt':'Record an AI answer','<form><label>Client<select required name="clientId">'+optionsClients(selected)+'</select></label>'+
    (sample?'':'<label>Answer engine<select name="engine"><option>ChatGPT</option><option>Google AI Overviews</option><option>Google AI Mode</option><option>Perplexity</option><option>Gemini</option><option>Claude</option><option>Copilot</option><option>Other</option></select></label>')+
    '<label>Prompt<textarea required name="prompt" maxlength="1000" placeholder="Enter the exact question asked"></textarea></label>'+
    (sample?'<p class="sdv-note" style="margin-top:10px">'+esc(modeDemo()?'This demonstration creates an illustrative answer without calling a provider.':'This runs one web-search prompt using the configured API account and may incur provider charges. Remaining allowance: '+n(model.ai?.remaining)+' of '+n(model.ai?.dailyLimit)+' today.')+'</p>':
      '<label>Answer text<textarea required name="answer" maxlength="16000" placeholder="Paste the answer as shown by the engine"></textarea></label><label>Cited URLs <small class="sdv-sub">Optional · one URL per line</small><textarea name="citations" maxlength="15000" placeholder="https://example.com/article"></textarea></label><label>Observation date<input name="date" type="date" value="'+new Date().toISOString().slice(0,10)+'" max="'+new Date().toISOString().slice(0,10)+'" required></label>')+formFooter(sample?(modeDemo()?'Run sample':'Run prompt'):'Save observation')+'</form>');
  onForm(d,async f=>{
    const prompt=f.prompt.trim();if(!prompt)throw Error('Enter the exact prompt.');
    if(sample){await api('/api/ai/sample','POST',{clientId:f.clientId,prompt});return 'Prompt completed. Open the observation to review the answer.';}
    const answer=f.answer.trim();if(!answer)throw Error('Paste the answer text.');
    const lines=[...new Set(f.citations.split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];
    if(lines.some(v=>!safeUrl(v)))throw Error('Enter one complete HTTP or HTTPS citation URL on each line.');
    const observedAt=f.date===new Date().toISOString().slice(0,10)?new Date().toISOString():f.date+'T12:00:00.000Z';
    await api('/api/ai/observations','POST',{clientId:f.clientId,engine:f.engine,prompt,answer,observedAt,citations:lines.map(url=>({url:safeUrl(url),title:new URL(url).hostname}))});
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
      case 'runCheck':{button.disabled=true;button.textContent='Checking…';await api('/api/alerts/check','POST',viewMemory.signalClient==='all'?{}:{clientId:viewMemory.signalClient});await updated('Health check completed.');break;}
      case 'sync':{button.disabled=true;button.textContent='Syncing…';const r=await api('/api/google/sync','POST',{});const errors=(r.results||[]).filter(x=>x.error||x.status==='error').length;
        await updated(errors?'Sync completed with '+errors+' source issue'+(errors===1?'':'s')+'. See linked properties.':r.remaining?'Synced '+n(r.processed)+' properties. Additional properties are queued.':'Property sync completed.');break;}
      case 'schedule':{button.disabled=true;await api('/api/settings','PATCH',{scheduleEnabled:val==='resume'});await updated(val==='resume'?'Scheduled checks enabled.':'Scheduled checks paused.');break;}
    }
  }catch(e){toast(e?.message||'The action could not be completed.');if(holder&&model)draw();}
}
