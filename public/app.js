import {renderShell,renderOverview} from "./overview.js";
import {renderView,clearView} from "./views.js";
import {demoWorkspace,demoApi} from "./demo.js";

const routes=new Set(["overview","clients","signals","connections","ai","settings"]);
const route=()=>{
  const wanted=location.hash.slice(1)||new URLSearchParams(location.search).get("view");
  return routes.has(wanted)?wanted:"overview";
};
const localPref=(key,def)=>{try{return localStorage.getItem("signal-desk."+key)||def;}catch{return def;}};
const savePref=(key,val)=>{try{localStorage.setItem("signal-desk."+key,val);}catch{}};
let mode=localPref("mode","demo")==="live"?"live":"demo";
const callbackResult=new URLSearchParams(location.search).get("google");
const liveLink=new URLSearchParams(location.search).get("workspace")==="live";
if(callbackResult||liveLink)mode="live";
let view=route(),range=Number(localPref("range","28")),clientId="all",version=0,lastRealtime=0,realtimePending=false;
if(![7,28,90].includes(range))range=28;
const blank=()=>({clients:[],bindings:[],signals:[],checks:[],mentions:[],ai:{observations:[],summary:{},samplingAvailable:false},google:{accounts:[],bindings:[],configured:false,setup:{ready:false}},settings:{timezone:"Asia/Kolkata",frequency:"hourly"},dataAsOf:null});
let signInPath=null;
let data=mode==="demo"?demoWorkspace():blank(),loading=mode==="live",error="",partialErrors=[],main=null;
function toast(message){
  let el=document.getElementById("signal-toast");
  if(!el){el=document.createElement("div");el.id="signal-toast";el.setAttribute("role","status");el.style.cssText="position:fixed;z-index:110;bottom:22px;left:50%;transform:translateX(-50%);padding:12px 18px;border-radius:10px;background:#17392f;color:white;box-shadow:0 4px 20px #132e262b;font:500 14px/1.45 system-ui;max-width:min(90vw,640px);";document.body.append(el);}
  el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,5000);
}
async function call(path,options={}){
  const hasBody=options.body!==undefined,headers=new Headers(options.headers||{});
  if(hasBody)headers.set("Content-Type","application/json");
  if(path==="/api/ai/sample"&&!headers.has("Idempotency-Key"))headers.set("Idempotency-Key",crypto.randomUUID());
  const res=await fetch(path,{method:options.method||"GET",headers,body:hasBody?JSON.stringify(options.body):undefined,credentials:"same-origin",cache:"no-store"});
  const obj=await res.json().catch(()=>null);
  if(res.status===401&&obj?.signIn?.startsWith("/api/auth/signin?"))signInPath=obj.signIn;
  if(!res.ok||!obj)throw Error(obj?.error||(res.status===401?"Sign in to open the live workspace.":"The server did not return dashboard data. Please retry."));
  return obj;
}
async function api(path,options={}){
  if(mode==="demo")return demoApi(path,options);
  const result=await call(path,options);
  if(options.method==="POST" && path==="/api/google/bindings"){
    try{await call("/api/google/sync",{method:"POST",body:{clientId:options.body.clientId}});await call("/api/alerts/check",{method:"POST",body:{clientId:options.body.clientId}});}catch{toast("Property linked. Visit Connections to retry its first sync.");}
  }else if(path==="/api/google/sync"||options.method==="DELETE"&&path.startsWith("/api/google/")){
    try{await call("/api/alerts/check",{method:"POST",body:{}});}catch{toast("Source updated. Run a health check to refresh the signal inbox.");}
  }
  return result;
}
function draw(){
  const state={...data,mode,view,clientId,selectedClientId:clientId,range,loading,error};
  if(main)clearView(main,view);
  main=renderShell(state)||document.getElementById("view");
  if(mode==="live"&&loading&&!data.clients.length){let notice=document.createElement("p");notice.className="desk-loading";notice.textContent="Opening your live workspace…";main.append(notice);return;}
  if(view==="overview")renderOverview(state);
  else renderView(main,state,actions);
  if(error||partialErrors.length){
    const notice=document.createElement("div");notice.className="work-error";notice.setAttribute("role","status");
    notice.append(document.createTextNode(error||"Some sources could not be refreshed. "+partialErrors.join(", ")+". The last available readings are shown. "));
    const retry=document.createElement("button");retry.type="button";retry.textContent="Retry";retry.addEventListener("click",()=>refresh());notice.append(retry);
    if(signInPath){const link=document.createElement("a");link.href=signInPath;link.target="_top";link.textContent="Sign in";notice.append(link);}
    main.prepend(notice);
  }
}
async function refresh(){
  const n=++version;
  if(mode==="demo"){data=demoWorkspace();partialErrors=[];error="";loading=false;draw();return;}
  const names=["Clients","Google accounts","Google readings","Health signals","AI evidence","Settings"];
  const paths=["/api/clients","/api/google/accounts","/api/google/data","/api/alerts","/api/ai","/api/settings"];
  const loads=await Promise.allSettled(paths.map(p=>call(p)));
  if(n!==version||mode!=="live")return;
  loading=false;partialErrors=names.filter((_,i)=>loads[i].status==="rejected");error="";
  if(partialErrors.length===paths.length){error=loads[0].reason?.message||"Unable to load the workspace.";draw();return;}
  const [clients,google,points,health,ai,settings]=loads.map(r=>r.status==="fulfilled"?r.value:null);
  signInPath=null;
  const bindings=points?.bindings??data.bindings;
  const stamps=bindings.map(b=>b.lastSync).filter(Boolean).sort();
  data={...data,clients:clients?.clients??data.clients,google:{...(google??data.google),bindings},bindings,
    signals:health?.alerts??data.signals,checks:health?.checks??data.checks,checkedAt:health?.checkedAt??data.checkedAt,
    ai:ai??data.ai,mentions:ai?.observations??data.mentions,settings:settings?.settings??data.settings,dataAsOf:stamps.at(-1)??null};
  if(clientId!=="all"&&!data.clients.some(c=>c.id===clientId))clientId="all";
  draw();
}
function navigate(target,historyMode="push"){
  if(!routes.has(target))target="overview";
  view=target;
  if(location.hash.slice(1)!==target&&historyMode==="push")history.pushState(null,"","#"+target);
  draw();window.scrollTo({top:0});
  if(target==="overview")void pollRealtime();
}
async function setMode(value){
  const next=value==="live"?"live":"demo";
  if(next===mode)return;
  version++;mode=next;savePref("mode",mode);clientId="all";partialErrors=[];error="";
  data=mode==="demo"?demoWorkspace():blank();loading=mode==="live";lastRealtime=0;draw();
  await refresh();if(mode==="live")void pollRealtime();
}
const selectClient=id=>{clientId=id||"all";draw();};
const actions={api,refresh,navigate,selectClient,toast,setMode};
async function pollRealtime(){
  if(mode!=="live"||view!=="overview"||document.hidden||loading||realtimePending||Date.now()-lastRealtime<58000||!data.bindings.some(b=>b.source==="ga4"))return;
  if(document.querySelector('dialog[open], [aria-expanded="true"]')||document.activeElement?.matches("select,input,textarea"))return;
  const initialVersion=version,scope=clientId;
  lastRealtime=Date.now();realtimePending=true;
  try{
    await call("/api/google/realtime",{method:"POST",body:scope==="all"?{}:{clientId:scope}});
    const readings=await call("/api/google/data");
    if(initialVersion!==version||mode!=="live"||view!=="overview"||scope!==clientId)return;
    data={...data,bindings:readings.bindings,google:{...data.google,bindings:readings.bindings}};draw();
  }catch{if(mode==="live"&&view==="overview")toast("Real-time refresh failed. The previous reading is still shown.");}
  finally{realtimePending=false;}
}
document.addEventListener("desk-action",async event=>{
  const {action,value}=event.detail;
  try{
    if(action==="navigate")navigate(value);
    else if(action==="range"){range=Number(value);savePref("range",String(range));draw();}
    else if(action==="client")selectClient(value);
    else if(action==="mode")await setMode(value);
    else if(action==="connect"){view="connections";if(mode==="demo")await setMode("live");navigate("connections");}
    else if(action==="client-detail"){clientId=value;navigate("clients");}
    else if(action==="signal-detail"){navigate("signals");main.querySelector('[data-vact="signal"][data-val="'+CSS.escape(value)+'"]')?.click();}
    else if(action==="refresh"){await refresh();lastRealtime=0;await pollRealtime();toast(mode==="demo"?"Sample workspace refreshed.":"Readings refreshed.");}
  }catch(e){toast(e.message);}
});
window.addEventListener("popstate",()=>navigate(route(),"none"));
document.addEventListener("visibilitychange",()=>{if(!document.hidden)void pollRealtime();});
setInterval(pollRealtime,60000);
if(liveLink){
  savePref("mode","live");history.replaceState(null,"",location.pathname+"#"+view);
}
draw();
if(mode==="live")refresh().then(pollRealtime);
if(callbackResult){
  savePref("mode","live");history.replaceState(null,"",location.pathname+"#connections");
  toast(callbackResult==="connected"?"Google account connected. Link a property to a client.":"Google authorisation returned. Review the connection status.");
}
