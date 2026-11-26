const shapes = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  briefcase:'<rect x="3" y="7" width="18" height="14" rx="2.5"/><path d="M8 7V5c0-1 .7-2 2-2h4c1.3 0 2 1 2 2v2M3 12c5 3 13 3 18 0m-9 .5v3"/>',
  activity:'<path d="M2 12h4l3-7 4 14 3-9 2 2h4"/>',
  plug:'<path d="m8 4 3 3m3-7 3 3M5 14l-2 2a3 3 0 0 0 4 4l3-3m-5-5 7-7 7 7-7 7z" transform="translate(1 1) scale(.94)"/>',
  spark:'<path d="M12 3c.8 5.2 2.8 7.2 8 8-5.2.8-7.2 2.8-8 8-.8-5.2-2.8-7.2-8-8 5.2-.8 7.2-2.8 8-8Zm7-2v4m-2-2h4M4 17v5m-2.5-2.5h5"/>',
  settings:'<path d="m9.5 3-.8 2.1-2.1 1-2.1-.3L3 8.7l1.5 1.7v2.9L3 15.1l1.5 3 2.3-.4 2 1.1.8 2.2h4.7l.8-2.2 2-1.1 2.3.4 1.5-3-1.5-1.8v-2.9L21 8.7l-1.5-2.9-2.1.3-2.1-1-.8-2.1Z"/><circle cx="12" cy="12" r="3"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  chevronDown:'<path d="m7 9 5 5 5-5"/>', chevronRight:'<path d="m9 6 6 6-6 6"/>',
  check:'<path d="m4 12 5 5L20 6"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  pulse:'<path d="M2 12h4l3-7 4 14 3-9 2 2h4"/>', globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  users:'<circle cx="9" cy="8" r="3.4"/><path d="M3 20v-1.5a6 6 0 0 1 12 0V20m1-15a3.5 3.5 0 0 1 0 6.7M18 15c2 .5 3 2 3 4v1"/>',
  mouse:'<path d="m5 3 4.5 16 3-6 6.5-2.5L5 3Zm8 11 4 6"/><path d="M13 3.5 14 1m3 6 3-1"/>',
  eye:'<path d="M2.2 12s3.6-7 9.8-7 9.8 7 9.8 7-3.6 7-9.8 7-9.8-7-9.8-7Z"/><circle cx="12" cy="12" r="3"/>',
  triangle:'<path d="m10.4 4.1-8.1 14a1.9 1.9 0 0 0 1.7 2.8h16a1.9 1.9 0 0 0 1.7-2.8l-8.1-14a1.8 1.8 0 0 0-3.2 0Z"/><path d="M12 9v5m0 3h.01"/>',
  up:'<path d="m4 16 6-6 4 4 6-8m-6 0h6v6"/>',down:'<path d="m4 8 6 6 4-4 6 8m-6 0h6v-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  bell:'<path d="M6 10a6 6 0 0 1 12 0v3c0 3 2 4 2 5H4c0-1 2-2 2-5Zm4 10a2.1 2.1 0 0 0 4 0"/>',
  layers:'<path d="m12 3 10 5.5L12 14 2 8.5 12 3Zm-9 9.5 9 5 9-5m-18 4.3 9 5 9-5"/>',
  radio:'<circle cx="12" cy="12" r="1.5"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4m8.4-8.4a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',x:'<path d="m6 6 12 12M18 6 6 18"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  filter:'<path d="M3 5h18M6 12h12m-9 7h6"/>',refresh:'<path d="M20 10a8 8 0 0 0-14-4L3 9m0-5v5h5m-4 5a8 8 0 0 0 14 4l3-3m0 5v-5h-5"/>',
  shield:'<path d="m12 2 8 3.5v6.2c0 4.9-4.1 7.8-8 10.3-3.9-2.5-8-5.4-8-10.3V5.5L12 2Z"/><path d="m8.5 12 2.3 2.3 4.8-5"/>',
  link:'<path d="m10 14 4-4m-6 5-1 1a3.3 3.3 0 0 1-4.7-4.7l4-4A3.3 3.3 0 0 1 12 7m0 10a3.3 3.3 0 0 0 4.7-.3l4-4A3.3 3.3 0 0 0 16 8l-1 1"/>',
  chart:'<path d="M3 3v17h18M7 15l4-5 4 2 5-7"/>', checkCircle:'<circle cx="12" cy="12" r="9"/><path d="m7.5 12.1 3.1 3.1 5.8-6.4"/>',
  signalDesk:'<path d="m2 15 4.3-1 4.1-8.2 1.8 13.1 4.4-11.3 1.8 5.2 3.6-.7"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'
};
export function icon(name,size=18){return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(name==='signalDesk'?'2.4':'1.65')+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(shapes[name]??shapes.activity)+'</svg>'}
const html = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayMs=86400000;
const dateKey = date=>new Date(date).toISOString().slice(0,10);
const dateLabel = (date,opts={month:'short',day:'numeric'})=>new Intl.DateTimeFormat('en-GB',{...opts,timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
const numeric=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const sumKnown=values=>{const known=values.filter(numeric);return known.length?known.reduce((s,v)=>s+Number(v),0):null};
const small=n=>!numeric(n)?'—':Intl.NumberFormat('en-US',{notation:n>=10000?'compact':'standard',maximumFractionDigits:n>=1000000?2:n>=10000?1:0}).format(n);
const exact=n=>!numeric(n)?'—':Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
const palette=[['#e5f1e2','#477645'],['#e2eef6','#47728e'],['#f0e9f5','#755d91'],['#f8eadb','#916c47'],['#e1efea','#547a66'],['#f5e5e6','#9b666e']];
const brandNames=['EzyHelpers','Trebound','Physio Central','The Doctor Index','Bevu Social Farmstay','Fresh Origins'];
const demoSites=['ezyhelpers.com','trebound.com','physiocentral.in','thedoctorindex.com','bevusocialfarmstay.com','freshoriginsmart.com'];
const demoIds=['ezyhelpers','trebound','physio-central','doctor-index','bevu-social','fresh-origins'];
const gaNow=[43,35,18,27,8,11];
const noise=i=>{const x=Math.sin(i*78.233+0.572)*43758.5453;return x-Math.floor(x)};
function datesTo(end,count){const t=Date.parse(end+'T12:00:00Z');return Array.from({length:count},(_,i)=>dateKey(t-(count-i-1)*dayMs))}
export function getDemoState(now=new Date()){
  const stamp=now.toISOString(),end=dateKey(now.valueOf()-dayMs),days=datesTo(end,182);
  const clients=brandNames.map((name,i)=>({id:demoIds[i],name,domain:demoSites[i],initials:['EH','TB','PC','DI','BS','FO'][i],timezone:'Asia/Kolkata'}));
  const bindings=[],checks=[],mentions=[];
  clients.forEach((c,k)=>{
    const base=[186,126,68,132,38,64][k];
    ['ga4','gsc','gbp'].filter(s=>s!=='gbp'||k!==3).forEach(source=>{
      const id=c.id+'-'+source;
      const points=days.map((date,i)=>{
        const swing=0.93+Math.sin(i*.53)*.12+Math.sin(i*.15)*.13+Math.sin(i*.93)*.05+(noise(i+1)-.5)*.2+(noise(i+k*9)-.5)*.1;
        const trend=.8+i*.0038;
        const clicks=Math.max(1,Math.round(base*trend*swing*(k===2&&i>177?.64:1)));
        const impressions=Math.round(clicks*(26.4+k*.7+noise(i)*2));
        if(source==='gsc')return {date,clicks,impressions,ctr:clicks/impressions,position:8.6+k*.7+Math.cos(i/20)};
        if(source==='ga4'){const sessions=Math.round(clicks*(1.6+k*.1));return {date,sessions,users:Math.round(sessions*.82),keyEvents:Math.round(sessions*.028),aiSessions:Math.round(sessions*.017)}}
        return {date,impressions:Math.round(clicks*5.3),calls:Math.round(clicks*.05),directions:Math.round(clicks*.065),websiteClicks:Math.round(clicks*.09)};
      });
      const latest=source==='gbp'&&k===5?days[days.length-6]:end;
      const effective=points.filter(p=>p.date<=latest);
      if(source==='gsc'&&(k===1||k===2)){
        const index=effective.length-1;
        const baseline=[7,14,21,28].map(offset=>effective[index-offset].clicks).sort((a,b)=>a-b);
        const middle=(baseline[1]+baseline[2])/2,record=effective[index];
        record.clicks=Math.round(middle*(k===1?1.46:.43));
        record.impressions=Math.round(record.clicks*28.2);record.ctr=record.clicks/record.impressions;
      }
      bindings.push({id,accountId:'demo-google',clientId:c.id,source,resourceId:'demo-'+id,label:c.domain,lastSync:source==='gbp'&&k===5?latest+'T12:00:00Z':stamp,lastError:null,profile:source==='gbp'?{title:c.name,websiteUri:'https://'+c.domain,regularHours:{periods:['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'].map(day=>({openDay:day,openTime:{hours:9},closeDay:day,closeTime:{hours:17}}))}}:{},realtime:source==='ga4'?{activeUsers:gaNow[k],observedAt:stamp}:null,points:effective});
      checks.push({bindingId:id,clientId:c.id,source,state:source==='gbp'&&k===5?'stale':source==='gsc'&&k===2?'critical':'healthy',detail:source==='gbp'&&k===5?'Business Profile data is behind its expected reporting window.':'Daily health check completed.',lastSync:source==='gbp'&&k===5?latest+'T12:00:00Z':stamp,latestDate:latest});
    });
    for(let i=k;i<182;i+=3+k){
      const mentioned=noise(i*3+k+1)>.27,cited=mentioned&&noise(i+k)>.45;
      mentions.push({id:'demo-prompt-'+k+'-'+i,clientId:c.id,provider:'OpenAI',engine:'ChatGPT',brand:c.name,prompt:'Which providers in India offer '+['home help services','corporate team building','physiotherapy','doctor discovery','farm stays','fresh groceries'][k]+'?',mentioned,cited,citationUrl:cited?'https://'+c.domain:null,observedAt:days[i]+'T12:00:00Z',createdAt:days[i]+'T12:00:00Z',method:'manual',model:'Recorded answer',answer:mentioned?'The recorded example named '+c.name+' as one option.':'The recorded example listed other providers.',citations:cited?[{title:c.name,url:'https://'+c.domain}]:[]});
    }
  });
  const signals=[
    {id:'demo-health-1',clientId:'physio-central',source:'gsc',title:'Organic clicks dropped',detail:'The latest complete day recorded fewer Search clicks than the same weekdays in the baseline.',action:'Open Search Console and compare the pages and queries that lost clicks. Check recent page changes before assigning a cause.',severity:'critical',kind:'drop',metrics:{metric:'clicks',current:58,baseline:85,changePercent:-32,date:end}},
    {id:'demo-health-2',clientId:'fresh-origins',source:'gbp',title:'Business Profile sync is overdue',detail:'The location has not completed a successful sync in five days.',action:'Check location access and run a fresh sync from Connections.',severity:'warning',kind:'freshness',metrics:{metric:'dataAge',current:5,baseline:3,date:end}},
    {id:'demo-health-3',clientId:'trebound',source:'gsc',title:'Organic clicks increased',detail:'The latest complete day had more search clicks than the comparable weekday baseline.',action:'Review improving queries and check whether their click-through rates moved with impressions.',severity:'info',kind:'gain',metrics:{metric:'impressions',current:8091,baseline:6525,changePercent:24,date:end}}
  ].map((s,i)=>({...s,status:'open',observedAt:new Date(now.valueOf()-(i+1)*27*60000).toISOString(),firstSeen:new Date(now.valueOf()-(i+1)*27*60000).toISOString()}));
  for(const s of signals.filter(s=>s.source==='gsc')){
    const series=bindings.find(b=>b.clientId===s.clientId&&b.source==='gsc').points,idx=series.length-1;
    const samples=[7,14,21,28].map(offset=>series[idx-offset].clicks).sort((a,b)=>a-b);
    const baseline=(samples[1]+samples[2])/2,current=series[idx].clicks,changePercent=(current/baseline-1)*100;
    s.metrics={metric:'clicks',current,baseline,changePercent,baselineType:'same_weekday',comparisonDays:4,date:end};
    s.title='Organic clicks '+(changePercent<0?'dropped ':'rose ')+Math.round(Math.abs(changePercent))+'%';
  }
  return {mode:'demo',view:'overview',range:28,clientId:'all',clients,bindings,signals,checks,mentions,evidence:mentions,observations:mentions,checkedAt:stamp,dataAsOf:stamp};
}
const labels={overview:'Overview',clients:'Clients',signals:'Health signals',ai:'AI visibility',connections:'Connections',settings:'Settings'};
const sourceName={ga4:'Analytics',gsc:'Search Console',gbp:'Business Profile'};
function navItem(state,view,ico,title,count=''){
  const active=state.view===view||(!state.view&&view==='overview');
  return '<button type="button" class="desk-nav-item'+(active?' active':'')+'" data-desk-action="navigate" data-value="'+view+'"'+(active?' aria-current="page"':'')+'>'+icon(ico,18)+'<span>'+title+'</span>'+(count?'<span class="desk-nav-count">'+html(count)+'</span>':'')+'</button>';
}
let eventsReady=false;
function emit(action,value){document.dispatchEvent(new CustomEvent('desk-action',{detail:{action,value}}))}
function closePopover(){const menu=document.getElementById('desk-mode-menu');if(menu){menu.hidden=true;document.getElementById('desk-mode-trigger')?.setAttribute('aria-expanded','false')}}
function toggleMobile(open){
  const layout=document.querySelector('.desk-layout');layout?.classList.toggle('menu-open',open);
  const button=document.getElementById('desk-open-nav');button?.setAttribute('aria-expanded',String(open));
  if(open)layout?.querySelector('.desk-sidebar .active')?.focus();else button?.focus();
}
function bindEvents(){
  if(eventsReady)return;eventsReady=true;
  document.addEventListener('click',e=>{
    const t=e.target.closest?.('[data-desk-action]');
    if(!t){if(!e.target.closest?.('.desk-menu-parent'))closePopover();return}
    const a=t.dataset.deskAction,v=t.dataset.value;
    if(a==='menu'){toggleMobile(true);return}
    if(a==='close-menu'){toggleMobile(false);return}
    if(a==='toggle-mode'){
      const menu=document.getElementById('desk-mode-menu');menu.hidden=!menu.hidden;
      t.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector('[aria-checked="true"]')?.focus();return;
    }
    closePopover();document.querySelector('.desk-layout')?.classList.remove('menu-open');emit(a,v);
  });
  document.addEventListener('change',e=>{const target=e.target.closest?.('[data-desk-change]');if(target)emit(target.dataset.deskChange,target.dataset.deskChange==='range'?Number(target.value):target.value)});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(document.querySelector('.desk-layout.menu-open'))toggleMobile(false);
      const m=document.getElementById('desk-mode-menu');if(m&&!m.hidden){closePopover();document.getElementById('desk-mode-trigger')?.focus()}
    }
    const m=document.getElementById('desk-mode-menu');
    if(m&&!m.hidden&&m.contains(e.target)&&['ArrowDown','ArrowUp'].includes(e.key)){
      e.preventDefault();const options=[...m.querySelectorAll('button')];options[(options.indexOf(e.target)+1)%options.length]?.focus();
    }
  });
}
export function renderShell(state={}){
  bindEvents();
  const root=document.getElementById('app'),demo=state.mode!=='live',signals=(state.signals||[]).filter(s=>s.status!=='resolved'&&s.severity!=='info').length;
  document.title=(labels[state.view]||'Overview')+' · Signal Desk';
  root.innerHTML='<a href="#view" class="desk-skip">Skip to main content</a><div class="desk-layout"><button type="button" class="desk-scrim" data-desk-action="close-menu" aria-label="Close navigation"></button><aside id="desk-side" class="desk-sidebar" aria-label="Workspace navigation"><button type="button" class="desk-brand" data-desk-action="navigate" data-value="overview" aria-label="Signal Desk overview"><span class="desk-brand-mark">'+icon('signalDesk',28)+'</span><span><span class="desk-brand-title">Signal Desk</span><span class="desk-brand-by">by Monk Mantra</span></span></button><nav class="desk-nav" aria-label="Main"><div class="desk-nav-group"><div class="desk-nav-label">Workspace</div>'+navItem(state,'overview','grid','Overview')+navItem(state,'clients','briefcase','Clients')+navItem(state,'signals','activity','Health signals',signals)+'</div><div class="desk-nav-group"><div class="desk-nav-label">Monitoring</div>'+navItem(state,'ai','spark','AI visibility')+navItem(state,'connections','plug','Connections')+'</div></nav><div class="desk-sidebar-bottom">'+navItem(state,'settings','settings','Settings')+'<div class="desk-account"><span class="desk-account-logo">MM</span><span><strong>Monk Mantra</strong><small>Agency workspace</small></span></div></div></aside><div class="desk-main"><header class="desk-topbar"><div class="desk-crumb"><button type="button" id="desk-open-nav" class="desk-mobile desk-menu-toggle" data-desk-action="menu" aria-label="Open navigation" aria-controls="desk-side" aria-expanded="false">'+icon('menu',20)+'</button><span class="desk-home-icon">'+icon('layers',17)+'</span><span class="desk-crumb-first">Workspace</span><span class="desk-separator" aria-hidden="true">/</span><span class="desk-crumb-current">'+html(labels[state.view]||'Overview')+'</span></div><div class="desk-tools"><div class="desk-menu-parent"><button id="desk-mode-trigger" class="desk-button desk-mode'+(demo?'':' live')+'" aria-haspopup="menu" aria-controls="desk-mode-menu" aria-expanded="false" data-desk-action="toggle-mode"><span class="desk-mode-dot"></span>'+(demo?'Demo workspace':'Live workspace')+icon('chevronDown',13)+'</button><div class="desk-pop" id="desk-mode-menu" role="menu" aria-label="Choose workspace" hidden>'+[['demo','Demo workspace'],['live','Live workspace']].map(([value,name])=>'<button type="button" role="menuitemradio" aria-checked="'+(demo===(value==='demo'))+'" data-desk-action="mode" data-value="'+value+'">'+name+(demo===(value==='demo')?icon('check',15):'')+'</button>').join('')+'</div></div><button type="button" class="desk-button desk-primary" data-desk-action="connect" aria-label="Connect a source">'+icon('plus',15)+'<span class="desk-connect-text">Connect source</span></button></div></header><main id="view" class="desk-view" tabindex="-1"></main></div></div>';
  return document.getElementById('view');
}
function pointsFor(bindings,days,metric){
  const totals=new Map();
  for(const binding of bindings){
    for(const entry of binding.points||[]){
      if(numeric(entry[metric]))totals.set(entry.date,(totals.get(entry.date)||0)+Number(entry[metric]));
    }
  }
  return days.map(d=>totals.get(d)??null);
}
function clientStatus(id,checks,signals,bindings){
  const items=signals.filter(a=>a.clientId===id&&a.status!=='resolved');
  const states=checks.filter(c=>c.clientId===id).map(c=>c.state);
  if(items.some(a=>a.severity==='critical')||states.includes('critical'))return ['critical','Critical'];
  if(items.some(a=>a.severity==='warning')||states.some(s=>['warning','stale'].includes(s)))return ['warning','Needs attention'];
  if(states.includes('warming'))return ['unknown','Building baseline'];
  if(states.length&&states.every(s=>s==='healthy'))return ['healthy','Healthy'];
  return ['unknown',bindings.some(b=>b.clientId===id)?'Awaiting check':'No sources'];
}
export function composeOverview(state={}){
  const range=[7,28,90].includes(Number(state.range))?Number(state.range):28;
  const selected=state.clientId||'all',allClients=state.clients||[],clients=allClients.filter(c=>selected==='all'||c.id===selected);
  const ids=new Set(clients.map(c=>c.id));
  const bindings=(state.bindings||[]).filter(b=>ids.has(b.clientId));
  const sampleTime=Date.parse(state.dataAsOf);
  const now=state.mode==='demo'&&Number.isFinite(sampleTime)?sampleTime:Date.now();
  const end=dateKey(now-dayMs),allDays=datesTo(end,range*2),days=allDays.slice(range),priorDays=allDays.slice(0,range);
  const gsc=bindings.filter(b=>b.source==='gsc'),ga=bindings.filter(b=>b.source==='ga4');
  const signals=(state.signals||[]).filter(s=>ids.has(s.clientId));
  const checks=(state.checks||[]).filter(s=>ids.has(s.clientId));
  const rank={critical:0,warning:1,info:2};
  const openSignals=signals.filter(s=>s.status!=='resolved').sort((a,b)=>(rank[a.severity]??3)-(rank[b.severity]??3)||String(b.observedAt).localeCompare(String(a.observedAt)));
  const allObserved=state.mentions||state.evidence||[];
  const observed=allObserved.filter(o=>ids.has(o.clientId));
  const metrics={};
  const compare=(list,key)=>{
    const series=pointsFor(list,allDays,key);
    const split=series.slice(range),previous=series.slice(0,range);
    const cur=sumKnown(split),prev=sumKnown(previous);
    // Compare only matched source/day pairs. Partial provider coverage can otherwise
    // produce misleading changes, especially at the lagging end of a reporting window.
    const currPairs=[],prevPairs=[];let currentCount=0;
    for(const b of list){
      const byDate=new Map((b.points||[]).map(r=>[r.date,r[key]]));
      for(let i=0;i<range;i++){
        const a=byDate.get(days[i]),p=byDate.get(priorDays[i]);
        if(numeric(a))currentCount++;
        if(numeric(a)&&numeric(p)){currPairs.push(a);prevPairs.push(p)}
      }
    }
    const comparable=sumKnown(prevPairs),matched=sumKnown(currPairs);
    // Keep the headline percentage on the same population as the headline count.
    const delta=numeric(cur)&&currentCount===currPairs.length&&comparable>0?(matched/comparable-1)*100:null;
    return {value:cur,previous:prev,delta,series:split,priorSeries:previous,daysKnown:split.filter(numeric).length};
  };
  for(const key of ['clicks','impressions'])metrics[key]=compare(gsc,key);
  for(const key of ['sessions','keyEvents','aiSessions'])metrics[key]=compare(ga,key);
  // Weighted CTR is total clicks / total impressions. Position is impressions-weighted.
  // Neither averages percentages across clients, and a zero denominator stays unavailable.
  {
    let cc=0,ci=0,pc=0,pi=0,cp=0,cpi=0,pp=0,ppi=0,rowsNow=0,pairs=0;
    const valid=r=>r&&numeric(r.clicks)&&numeric(r.impressions);
    for(const b of gsc){
      const byDate=new Map((b.points||[]).map(r=>[r.date,r]));
      for(let i=0;i<range;i++){
        const a=byDate.get(days[i]),p=byDate.get(priorDays[i]);
        if(!valid(a))continue;
        rowsNow++;cc+=Number(a.clicks);ci+=Number(a.impressions);
        if(numeric(a.position)&&a.impressions>0){cp+=a.position*a.impressions;cpi+=Number(a.impressions)}
        if(valid(p)){pairs++;pc+=Number(p.clicks);pi+=Number(p.impressions);if(numeric(p.position)&&p.impressions>0){pp+=p.position*p.impressions;ppi+=Number(p.impressions)}}
      }
    }
    const full=rowsNow>0&&pairs===rowsNow;
    metrics.ctr={value:ci>0?cc/ci:null,previous:full&&pi>0?pc/pi:null};
    metrics.position={value:cpi>0?cp/cpi:null,previous:full&&ppi>0?pp/ppi:null};
  }
  const mentionsPerDay=new Map(),samplesPerDay=new Map();
  for(const o of observed){
    const date=(o.observedAt||o.createdAt||'').slice(0,10);
    if(!date)continue;
    samplesPerDay.set(date,(samplesPerDay.get(date)||0)+1);
    if(o.mentioned===true)mentionsPerDay.set(date,(mentionsPerDay.get(date)||0)+1);
  }
  // Include observations through today for the evidence count. Search uses complete days.
  const observedDays=datesTo(dateKey(now),range);
  const aiSeries=observedDays.map(d=>samplesPerDay.has(d)?mentionsPerDay.get(d)||0:null);
  const aiSamples=observedDays.reduce((n,d)=>n+(samplesPerDay.get(d)||0),0);
  const oldestReturned=allObserved.map(o=>o.observedAt||o.createdAt||'').filter(Boolean).sort()[0]?.slice(0,10);
  const totalLogged=state.ai?.summary?.samples;
  const truncated=state.mode==='live'&&allObserved.length>=200&&(!numeric(totalLogged)||Number(totalLogged)>allObserved.length)&&oldestReturned>=observedDays[0];
  metrics.mentions={value:sumKnown(aiSeries),series:aiSeries,samples:aiSamples,truncated};
  const validRealtime=b=>b.realtime&&numeric(b.realtime.activeUsers)&&Number.isFinite(Date.parse(b.realtime.observedAt))&&now-Date.parse(b.realtime.observedAt)<10*60000&&now-Date.parse(b.realtime.observedAt)>=-60000;
  const recentGa=ga.filter(validRealtime);
  metrics.active={value:sumKnown(recentGa.map(b=>b.realtime.activeUsers)),properties:recentGa.length};
  const rows=clients.map((c,i)=>{
    const own=bindings.filter(b=>b.clientId===c.id),cb=own.filter(b=>b.source==='gsc'),cg=own.filter(b=>b.source==='ga4'&&validRealtime(b));
    const [status,health]=clientStatus(c.id,checks,signals,bindings);
    const colorIndex=allClients.findIndex(x=>x.id===c.id);
    return {...c,colorIndex:colorIndex<0?i:colorIndex,health,status,clicks:sumKnown(pointsFor(cb,days,'clicks')),users:sumKnown(cg.map(b=>b.realtime.activeUsers)),sources:[...new Set(own.map(b=>b.source))].filter(s=>s in sourceName)};
  });
  return {range,selected,allClients,clients,bindings,days,priorDays,metrics,openSignals,rows,now,checks};
}
function plottedLine(values,width,height){
  if(!values?.length)return '';
  const entries=values.flatMap((v,i)=>numeric(v)?[[i,Number(v)]]:[]);if(entries.length<2)return '';
  const vals=entries.map(([,v])=>v),lo=Math.min(...vals),hi=Math.max(...vals);
  const mapped=values.map((v,i)=>numeric(v)?{x:1+i/(values.length-1||1)*(width-2),y:height-3-(v-lo)/(hi-lo||1)*(height-6)}:null);
  return lineSegments(mapped).map(s=>smooth(s)).join(' ');
}
function lineSegments(points){
  const segments=[];let next=[];
  for(const p of points){if(p){next.push(p)}else if(next.length){segments.push(next);next=[]}}
  if(next.length)segments.push(next);
  return segments;
}
function smooth(points){
  if(!points.length)return '';
  const n=v=>Number(v.toFixed(2)),coords=p=>n(p.x)+' '+n(p.y);
  let d='M'+coords(points[0]);
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],delta=(b.x-a.x)*.32;d+=' C'+n(a.x+delta)+' '+n(a.y)+' '+n(b.x-delta)+' '+n(b.y)+' '+coords(b)}
  return d;
}
function spark(series,color){
  const d=plottedLine(series,85,27);return d?'<svg class="ov-spark" viewBox="0 0 85 27" preserveAspectRatio="none" aria-hidden="true"><path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="1.65" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>':'';
}
function changeLine(data){
  if(data.delta===null)return data.daysKnown?data.daysKnown+' reporting days':'Awaiting Search Console';
  return '<span class="ov-change'+(data.delta<0?' negative':'')+'">'+icon(data.delta<0?'down':'up',13)+(data.delta>0?'+':'')+data.delta.toFixed(1)+'%</span><span>vs previous period</span>';
}
function metricCard(type,ico,title,value,context,mini='',subtitle=''){
  return '<article class="ov-card"><div class="ov-card-top"><span class="ov-metric-icon '+type+'">'+icon(ico,16)+'</span><span>'+title+'</span></div><div class="ov-value-line"><strong class="ov-metric-value" title="'+html(subtitle||exact(value))+'">'+small(value)+'</strong>'+mini+'</div><div class="ov-context">'+context+'</div></article>';
}
function metricsMarkup(vm){
  const m=vm.metrics;
  return '<section class="ov-metrics" aria-label="Portfolio metrics">'+
    metricCard('active','users','Active users',m.active.value,m.active.properties?'<span class="ov-live"><i></i>Realtime</span><span>· Last 30 min</span>':'Awaiting realtime data','')+
    metricCard('clicks','mouse','Organic clicks',m.clicks.value,changeLine(m.clicks),spark(m.clicks.series,'#6694bd'))+
    metricCard('impressions','eye','Search impressions',m.impressions.value,changeLine(m.impressions),spark(m.impressions.series,'#9b85b8'))+
    metricCard('mentions','spark','AI mentions',m.mentions.value,m.mentions.truncated?'Within latest 200 answers':m.mentions.samples?'Across '+exact(m.mentions.samples)+' recorded answers':'Awaiting AI observations','')+'</section>';
}
function periodChange(data,kind){
  if(kind==='ctr'||kind==='position'){
    if(!numeric(data.value)||!numeric(data.previous))return numeric(data.value)?'Previous period not comparable':'Awaiting Search Console';
    const diff=kind==='ctr'?(data.value-data.previous)*100:data.value-data.previous;
    const better=kind==='ctr'?diff>=0:diff<=0;
    return '<span class="ov-change'+(better?'':' negative')+'">'+icon(diff<0?'down':'up',13)+(diff>0?'+':'')+diff.toFixed(kind==='ctr'?2:1)+(kind==='ctr'?' pp':'')+'</span><span>vs previous period</span>';
  }
  if(data.delta===null)return data.daysKnown?data.daysKnown+' reporting days':'Awaiting Analytics';
  return changeLine(data);
}
function periodMarkup(vm){
  const m=vm.metrics,pct=v=>numeric(v)?(v*100).toFixed(2)+'%':'—',pos=v=>numeric(v)?v.toFixed(1):'—';
  const card=(type,ico,title,display,exactValue,context)=>'<article class="ov-card"><div class="ov-card-top"><span class="ov-metric-icon '+type+'">'+icon(ico,16)+'</span><span>'+title+'</span></div><div class="ov-value-line"><strong class="ov-metric-value" title="'+html(exactValue)+'">'+display+'</strong></div><div class="ov-context">'+context+'</div></article>';
  return '<section class="ov-metrics ov-period" aria-label="Completed reporting period">'+
    card('active','activity','Sessions',small(m.sessions.value),exact(m.sessions.value),periodChange(m.sessions))+
    card('mentions','checkCircle','Key events',small(m.keyEvents.value),exact(m.keyEvents.value),periodChange(m.keyEvents))+
    card('clicks','mouse','Weighted CTR',pct(m.ctr.value),'Total clicks ÷ total impressions',periodChange(m.ctr,'ctr'))+
    card('impressions','up','Avg. position',pos(m.position.value),'Impressions-weighted',periodChange(m.position,'position'))+
    card('mentions','spark','AI referral sessions',small(m.aiSessions.value),exact(m.aiSessions.value),periodChange(m.aiSessions))+'</section>';
}
function selectWrap(label,action,options,selected,ico){
  return '<label class="desk-select-wrap'+(ico?'':' is-compact')+'"><span class="desk-sr">'+html(label)+'</span>'+(ico?icon(ico,14):'')+'<select '+(action==='chart-metric'?'id="ov-metric-select"':'data-desk-change="'+action+'"')+' aria-label="'+html(label)+'">'+options.map(([v,text])=>'<option value="'+html(v)+'"'+(String(selected)===String(v)?' selected':'')+'>'+html(text)+'</option>').join('')+'</select>'+icon('chevronDown',13)+'</label>';
}
function alertLabel(s){return s.severity==='critical'?'Critical':s.severity==='warning'?'Needs attention':'Opportunity'}
function signalPanel(vm){
  const content=vm.openSignals.slice(0,3).map(s=>{
    const client=vm.clients.find(c=>c.id===s.clientId),sev=['critical','warning','info'].includes(s.severity)?s.severity:'info';
    const symbol=sev==='critical'?'down':sev==='warning'?'clock':'up';
    return '<button type="button" class="ov-sig-row" data-desk-action="signal-detail" data-value="'+html(s.id)+'"><span class="ov-signal-icon '+sev+'">'+icon(symbol,17)+'</span><span class="ov-sig-content"><span class="ov-sig-name">'+html(s.title)+'</span><span class="ov-sig-meta">'+html(client?.name??'Client')+' <span aria-hidden="true">·</span> '+alertLabel(s)+'</span></span></button>';
  }).join('');
  return '<section class="ov-panel ov-signals"><div class="ov-panel-head"><div><h2>Health signals</h2><p>Changes that deserve a closer look.</p></div><span class="ov-sig-head-icon">'+icon('activity',19)+'</span></div><div class="ov-sig-list">'+(content||'<div class="ov-empty">'+icon('shield',25)+'<b>'+(!vm.checks.length?'Awaiting first health check':'No open signals')+'</b><p>'+(!vm.checks.length?'Connect a source and sync its reporting data.':'The latest checks have no open alerts for this selection.')+'</p></div>')+'</div><button type="button" class="ov-all" data-desk-action="navigate" data-value="signals">'+icon('list',14)+'View all signals</button></section>';
}
const sourceShort={ga4:'GA4',gsc:'GSC',gbp:'GBP'};
function rowMarkup(c){
  const [bg,fg]=palette[c.colorIndex%palette.length],initials=c.initials||c.name.trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  return '<tr><td><button type="button" class="ov-table-client" data-desk-action="client-detail" data-value="'+html(c.id)+'"><span class="ov-avatar" style="color:'+fg+';background:'+bg+'">'+html(initials)+'</span><span><b>'+html(c.name)+'</b><small>'+html(c.domain)+'</small></span></button></td><td><span class="ov-status '+c.status+'"><i></i>'+html(c.health)+'</span></td><td>'+exact(c.users)+'</td><td>'+exact(c.clicks)+'</td><td><span class="ov-source-row">'+(c.sources.length?c.sources.map(s=>'<abbr class="ov-source" title="'+sourceName[s]+'">'+sourceShort[s]+'</abbr>').join(''):'—')+'</span></td></tr>';
}
function tableMarkup(vm){
  return '<section class="ov-panel"><div class="ov-panel-head ov-table-head"><div><div class="ov-table-title"><h2>Client portfolio</h2><span class="ov-total">'+vm.rows.length+'</span></div><p>Account health and performance by client.</p></div><label class="ov-search">'+icon('search',15)+'<span class="desk-sr">Search portfolio clients</span><input id="ov-find-client" type="search" placeholder="Find a client…" autocomplete="off"></label></div><div class="ov-table-scroll"><table class="ov-table"><thead><tr><th scope="col">Client</th><th scope="col">Health status</th><th scope="col">Active users</th><th scope="col">Organic clicks</th><th scope="col">Sources</th></tr></thead><tbody id="ov-client-rows">'+vm.rows.map(rowMarkup).join('')+'</tbody></table></div><div id="ov-no-results" class="ov-empty" '+(vm.rows.length?'hidden':'')+'><b>'+(vm.rows.length?'No matching clients':'No clients in this workspace')+'</b><p>'+(vm.rows.length?'Try a different name or domain.':'Open Clients to add a client and its reporting sources.')+'</p></div></section>';
}
let metricChoice='clicks';
function niceStep(v){const p=Math.pow(10,Math.floor(Math.log10(Math.max(v,1))));const a=v/p;return (a<=1?1:a<=2?2:a<=2.5?2.5:a<=5?5:10)*p}
function graphMarkup(vm,metric,width,height){
  const data=vm.metrics[metric],known=data.series.concat(data.priorSeries).filter(numeric);
  if(!known.length)return '<div class="ov-chart-empty">'+icon('chart',26)+'<b>No Search Console data in this period</b><p>Connect a property or select another date range.</p></div>';
  const W=Math.max(width,255),H=Math.max(height,142),left=W<390?37:43,right=13,top=9,bottom=25;
  const plotW=W-left-right,plotH=H-top-bottom;
  const max=Math.max(...known),step=niceStep(max/4),gridMax=Math.max(step*Math.ceil(max/step),4),gridCount=Math.max(2,Math.round(gridMax/step));
  const y=v=>top+plotH*(1-v/gridMax),x=i=>left+(plotW*i/(vm.days.length-1));
  const map=values=>values.map((v,i)=>numeric(v)?{x:x(i),y:y(Number(v))}:null);
  const current=lineSegments(map(data.series)),previous=lineSegments(map(data.priorSeries));
  const grid=Array.from({length:gridCount+1},(_,i)=>{const val=gridMax*(gridCount-i)/gridCount,yy=y(val);return '<line x1="'+left+'" x2="'+(W-right)+'" y1="'+yy+'" y2="'+yy+'" stroke="#e3e9e2" stroke-dasharray="3 4"/><text x="'+(left-8)+'" y="'+(yy+3.7)+'" text-anchor="end">'+Intl.NumberFormat('en-US',{notation:val>=1000?'compact':'standard',maximumFractionDigits:1}).format(val)+'</text>'}).join('');
  const ticks=W<410?4:6;
  const labels=Array.from({length:ticks},(_,i)=>{const index=Math.round(i*(vm.days.length-1)/(ticks-1));return '<text x="'+x(index)+'" y="'+(H-5)+'" text-anchor="'+(i===0?'start':i===ticks-1?'end':'middle')+'">'+dateLabel(vm.days[index])+'</text>'}).join('');
  const shape=(segment,stroke,dash='')=>segment.length===1?'<circle cx="'+segment[0].x+'" cy="'+segment[0].y+'" r="2.5" fill="'+stroke+'"/>':'<path d="'+smooth(segment)+'" fill="none" stroke="'+stroke+'" stroke-width="'+(dash?1.9:2.4)+'" stroke-linejoin="round" stroke-linecap="round" '+(dash?'stroke-dasharray="5 5"':'')+'/>';
  const fill=current.filter(s=>s.length>1).map(s=>'<path d="'+smooth(s)+' L'+s.at(-1).x+' '+(top+plotH)+' L'+s[0].x+' '+(top+plotH)+' Z" fill="url(#ov-chart-fill)"/>').join('');
  return '<svg class="ov-graph" viewBox="0 0 '+W+' '+H+'" data-width="'+W+'" data-left="'+left+'" data-plot="'+plotW+'" role="img" tabindex="0" aria-label="'+html((metric==='clicks'?'Organic clicks':'Search impressions')+' by date. Use left and right arrow keys for daily values.')+'"><defs><linearGradient id="ov-chart-fill" x1="0" x2="0" y1="0" y2="1" gradientUnits="objectBoundingBox"><stop offset="0%" stop-color="#8fbd93" stop-opacity=".39"/><stop offset="100%" stop-color="#bad4b4" stop-opacity=".06"/></linearGradient></defs><g fill="#758177" font-family="Inter, Arial, sans-serif" font-size="10.5">'+grid+labels+'</g>'+fill+previous.map(s=>shape(s,'#9daf9f',true)).join('')+current.map(s=>shape(s,'#39794d')).join('')+'<line class="ov-crosshair" visibility="hidden" x1="0" x2="0" y1="'+top+'" y2="'+(top+plotH)+'" stroke="#758e78" stroke-dasharray="3 4"/></svg><div class="ov-chart-tip" role="status" hidden></div>';
}
function drawGraph(box,vm){
  const width=box.clientWidth||550,height=box.clientHeight||165;
  box.innerHTML=graphMarkup(vm,metricChoice,width,height);
  const svg=box.querySelector('.ov-graph'),tip=box.querySelector('.ov-chart-tip');if(!svg)return;
  const cross=svg.querySelector('.ov-crosshair');let pos=vm.days.length-1;
  function show(i){
    pos=Math.max(0,Math.min(vm.days.length-1,i));
    const d=vm.metrics[metricChoice],axis=Number(svg.dataset.left)+pos*Number(svg.dataset.plot)/(vm.days.length-1);
    cross.setAttribute('x1',axis);cross.setAttribute('x2',axis);cross.setAttribute('visibility','visible');
    tip.hidden=false;tip.innerHTML='<strong>'+dateLabel(vm.days[pos],{month:'short',day:'numeric',year:'numeric'})+'</strong><span>Current · '+exact(d.series[pos])+'</span><span>Previous · '+exact(d.priorSeries[pos])+'</span>';
    tip.style.left=Math.max(67,Math.min(width-67,axis))+'px';tip.style.top='3px';
  }
  function hide(){tip.hidden=true;cross.setAttribute('visibility','hidden')}
  svg.addEventListener('pointermove',e=>{const r=svg.getBoundingClientRect();const px=(e.clientX-r.left)/r.width*Number(svg.dataset.width);show(Math.round((px-Number(svg.dataset.left))/Number(svg.dataset.plot)*(vm.days.length-1)))});
  svg.addEventListener('pointerleave',hide);svg.addEventListener('blur',hide);svg.addEventListener('focus',()=>show(pos));
  svg.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();show(pos+(e.key==='ArrowRight'?1:-1))}});
}
let observer;
export function renderOverview(state={}){
  const view=document.getElementById('view');if(!view)return;
  observer?.disconnect();
  const vm=composeOverview(state);
  const options=[['all','All clients'],...vm.allClients.map(c=>[c.id,c.name])];
  const demo=state.mode!=='live';
  const banner=state.loading?'<div class="ov-message" role="status">'+icon('refresh',16)+' Loading workspace data…</div>':'';
  view.innerHTML='<div class="ov-intro"><div><h1>Portfolio overview</h1><p>Traffic, visibility and health across your client portfolio.</p></div><div class="ov-filters">'+selectWrap('Filter by client','client',options,vm.selected,'briefcase')+selectWrap('Reporting period','range',[[7,'Last 7 days'],[28,'Last 28 days'],[90,'Last 90 days']],vm.range,'calendar')+'</div></div>'+banner+metricsMarkup(vm)+periodMarkup(vm)+'<div class="ov-grid"><section class="ov-panel ov-chart-panel"><div class="ov-panel-head"><div><h2>Search performance</h2><p>Organic search '+(metricChoice==='clicks'?'clicks':'impressions')+' over time.</p></div>'+selectWrap('Chart metric','chart-metric',[['clicks','Clicks'],['impressions','Impressions']],metricChoice,'')+'</div><div class="ov-legend"><span><i></i>Current period</span><span><i></i>Previous period</span></div><div id="ov-plot" class="ov-graph-wrap"></div></section>'+signalPanel(vm)+'</div>'+tableMarkup(vm)+'<p class="ov-footnote">'+(demo?'Illustrative workspace data. Switch to the live workspace to monitor connected client accounts.':'Realtime counts use Google Analytics’ last 30 minutes. Daily Search Console totals reflect available reporting days.')+'</p>';
  const box=document.getElementById('ov-plot');drawGraph(box,vm);
  if(typeof ResizeObserver!=='undefined'){
    let oldW=box.clientWidth,oldH=box.clientHeight;
    const localObserver=new ResizeObserver(()=>{if(!box.isConnected){localObserver.disconnect();return}const w=box.clientWidth,h=box.clientHeight;if(Math.abs(w-oldW)>1||Math.abs(h-oldH)>1){oldW=w;oldH=h;drawGraph(box,vm)}});
    localObserver.observe(box);observer=localObserver;
  }
  document.getElementById('ov-metric-select').addEventListener('change',e=>{metricChoice=e.target.value==='impressions'?'impressions':'clicks';box.closest('section').querySelector('.ov-panel-head p').textContent='Organic search '+metricChoice+' over time.';drawGraph(box,vm)});
  const find=document.getElementById('ov-find-client'),tbody=document.getElementById('ov-client-rows'),empty=document.getElementById('ov-no-results');
  find.addEventListener('input',()=>{const q=find.value.trim().toLowerCase(),rows=vm.rows.filter(c=>(c.name+' '+(c.domain||'')).toLowerCase().includes(q));tbody.innerHTML=rows.map(rowMarkup).join('');empty.hidden=!!rows.length});
}
