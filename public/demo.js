import {getDemoState} from "./overview.js";

const storageKey="signal-desk.demo.v1";
const emptyChanges=()=>({clients:[],statuses:{},hidden:[],linked:[],evidence:[],scheduleEnabled:true,lastCheck:null});
let changes;
try {changes={...emptyChanges(),...JSON.parse(localStorage.getItem(storageKey)||"{}")};}
catch {changes=emptyChanges();}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(changes));}catch{throw Error("The browser could not save this sample change.");}}
function observations(rows,clients) {
  return rows.map(row=>{
    if(row.answer)return row;
    const name=clients.find(c=>c.id===row.clientId)?.name||"the client";
    return {...row,method:"demo",answer:row.mentioned
      ? "Illustrative answer: "+name+" is one option a person might consider for this service."
      : "Illustrative answer: this response lists other providers for the service.",
    citations:row.citationUrl?[{title:name,url:row.citationUrl}]:[]};
  }).sort((a,b)=>b.observedAt.localeCompare(a.observedAt));
}
export function demoWorkspace(){
  const base=getDemoState(), clients=[...base.clients,...changes.clients];
  const bindings=[...base.bindings,...changes.linked].filter(b=>!changes.hidden.includes(b.id)&&!changes.hidden.includes(b.accountId));
  const activeIds=new Set(bindings.map(x=>x.id));
  const signals=base.signals.filter(s=>bindings.some(b=>b.clientId===s.clientId && b.source===s.source)).map(s=>({...s,status:changes.statuses[s.id]||s.status}));
  const mentions=observations([...changes.evidence,...base.mentions],clients);
  const accounts=changes.hidden.includes("demo-google")?[]:[{id:"demo-google",email:"analytics@example.com",connectedAt:base.dataAsOf}];
  const count=mentions.length, mentionsCount=mentions.filter(x=>x.mentioned).length, citations=mentions.filter(x=>x.cited).length;
  return {...base,clients,bindings,mentions,evidence:mentions,signals,checks:base.checks.filter(c=>activeIds.has(c.bindingId)),
    google:{configured:true,setup:{ready:true},accounts,bindings},
    ai:{observations:mentions,samplingAvailable:false,dailyLimit:3,remaining:3,summary:{samples:count,mentions:mentionsCount,citations,mentionRate:count?mentionsCount/count*100:null,citationRate:count?citations/count*100:null}},
    settings:{scheduleEnabled:changes.scheduleEnabled,frequency:"hourly",lastCheck:changes.lastCheck||base.checkedAt,timezone:"Asia/Kolkata"}};
}

export async function demoApi(path,options={}){
  const url=new URL(path,location.origin),p=url.pathname,body=options.body||{},method=options.method||"GET";
  const now=new Date().toISOString(),id="sample-"+crypto.randomUUID(),state=demoWorkspace();
  let result={ok:true};
  if(p==="/api/clients"&&method==="POST"){
    if(state.clients.some(c=>c.domain===body.domain))throw Error("This domain already belongs to a sample client.");
    changes.clients.push({id,name:body.name,domain:body.domain,createdAt:now});
  }else if(p==="/api/alerts/check"){changes.lastCheck=now;}
  else if(p.startsWith("/api/alerts/")&&method==="PATCH"){changes.statuses[p.split("/").pop()]=body.status;}
  else if(p==="/api/settings"&&method==="PATCH"){changes.scheduleEnabled=body.scheduleEnabled;}
  else if(p==="/api/google/discover"){
    const src=url.searchParams.get("source");
    const resources=state.clients.map(c=>({id:"demo-"+c.id+"-"+src,label:c.domain,description:"Example property"}));
    resources.push({id:"demo-additional-"+src,label:"Additional example property",description:"Illustrative property"});
    return {resources,nextPageToken:null};
  }else if(p==="/api/google/bindings"&&method==="POST"){
    if(state.bindings.some(b=>b.resourceId===body.resourceId&&b.source===body.source))throw Error("This sample property is already linked.");
    changes.linked.push({...body,id,label:body.label||body.resourceId,profile:{},points:[],lastSync:null,realtime:null});
  }else if((p.startsWith("/api/google/accounts/")||p.startsWith("/api/google/bindings/"))&&method==="DELETE"){
    changes.hidden.push(p.split("/").pop());
  }else if(p==="/api/google/sync"||p==="/api/google/realtime"){
    changes.lastCheck=now;
    changes.linked=changes.linked.map(b=>({...b,lastSync:now}));
    result={processed:state.bindings.length,remaining:0,results:state.bindings.map(b=>({id:b.id,status:"synced"}))};
  }else if(p==="/api/ai/sample"||p==="/api/ai/observations"){
    const c=state.clients.find(x=>x.id===body.clientId); if(!c)throw Error("Select a sample client.");
    const sample=p.endsWith("/sample");
    const answer=sample?"Illustrative answer: "+c.name+" is an example provider in this sample.":body.answer;
    const citations=sample?[{title:c.name,url:"https://"+c.domain}]:body.citations||[];
    const brand=String(c.name).toLocaleLowerCase(),text=String(answer).replace(/https?:\/\/\S+/gi," ").toLocaleLowerCase();
    const obs={...body,id,engine:sample?"Sample engine":body.engine,method:sample?"demo":"manual",answer,citations,
      mentioned:text.includes(brand),cited:citations.some(x=>{try{const h=new URL(x.url).hostname;return h===c.domain||h.endsWith("."+c.domain);}catch{return false;}}),
      observedAt:body.observedAt||now,createdAt:now};
    changes.evidence.unshift(obs);result={observation:obs};
  }else throw Error("Open the live workspace for this action.");
  persist();return result;
}
