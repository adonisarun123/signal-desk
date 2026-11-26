import { handleGoogle } from "./google.js";
import { healthApi } from "./health.js";
import { aiApi } from "./ai.js";
import { handleJobRequest } from "./jobs.js";

function reply(body, status = 200) {
  return Response.json(body, {status, headers: {"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}

async function readBody(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body;
}

function hostname(input) {
  if (typeof input !== "string" || input.length > 500) return null;
  try {
    const url = new URL(input.includes("://") ? input.trim() : "https://" + input.trim());
    const domain = url.hostname.toLowerCase().replace(/^www\./,"").replace(/\.$/,"");
    if (!["http:","https:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) return null;
    return domain;
  } catch { return null; }
}

async function getSettings(env,owner) {
  const row = await env.DB.prepare("SELECT schedule_enabled,last_check FROM desk_settings WHERE owner=?").bind(owner).first();
  return {frequency:"hourly",timezone:"Asia/Kolkata",scheduleEnabled:row ? Boolean(row.schedule_enabled) : true,lastCheck:row?.last_check ?? null};
}

export async function handleApi(request,env) {
  const url=new URL(request.url);
  const path=url.pathname;
  const owner=request.headers.get("oai-authenticated-user-id");
  const jobs=path === "/api/jobs/tick" || path === "/api/jobs/status";
  const mutation=!["GET","HEAD"].includes(request.method);
  const origin=request.headers.get("Origin");
  if (mutation && (origin && origin !== url.origin || !origin && !jobs)) return reply({error:"Open Signal Desk to make this change."},403);
  if (!owner && !jobs) return reply({error:"Sign in to this private workspace.",signIn:"/signin-with-chatgpt?return_to=%2F"},401);
  if (mutation && Number(request.headers.get("content-length")||0)>100000) return reply({error:"This request is too large."},413);
  if (path === "/api/session" && request.method === "GET") return reply({authenticated:true});
  if (!env.DB) return reply({error:"Workspace storage is temporarily unavailable."},503);
  try {
    if (jobs) return await handleJobRequest(request,env,owner);
    if (path.startsWith("/api/google/")) return await handleGoogle(request,env,owner);
    if (path === "/api/alerts" || path.startsWith("/api/alerts/")) return await healthApi(request,env,owner);
    if (path === "/api/ai" || path.startsWith("/api/ai/")) return await aiApi(request,env,owner);
    if (path === "/api/clients" && request.method === "GET") {
      const rows=await env.DB.prepare("SELECT id,name,domain,created_at AS createdAt FROM clients WHERE owner=? ORDER BY name COLLATE NOCASE").bind(owner).all();
      return reply({clients:rows.results});
    }
    if (path === "/api/clients" && request.method === "POST") {
      const body=await readBody(request);
      const name=typeof body?.name === "string" ? body.name.trim() : "";
      const domain=hostname(body?.domain);
      if (!name || name.length>100 || !domain) return reply({error:"Enter a client name of up to 100 characters and a valid website domain."},400);
      const client={id:crypto.randomUUID(),name,domain,createdAt:new Date().toISOString()};
      const added=await env.DB.batch([
        env.DB.prepare("INSERT INTO clients (id,owner,name,domain,created_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,domain) DO NOTHING").bind(client.id,owner,name,domain,client.createdAt),
        env.DB.prepare("INSERT INTO desk_settings(owner) VALUES(?) ON CONFLICT(owner) DO NOTHING").bind(owner),
      ]);
      if (added[0].meta.changes===0) return reply({error:"This domain already belongs to a client in your workspace."},409);
      return reply({client},201);
    }
    if (path === "/api/settings") {
      if (request.method === "PATCH") {
        const body=await readBody(request);
        if (typeof body?.scheduleEnabled !== "boolean") return reply({error:"Choose whether scheduled checks are enabled."},400);
        await env.DB.prepare("INSERT INTO desk_settings(owner,schedule_enabled) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET schedule_enabled=excluded.schedule_enabled").bind(owner,Number(body.scheduleEnabled)).run();
      } else if (request.method !== "GET") return reply({error:"Method unavailable."},405);
      return reply({settings:await getSettings(env,owner)});
    }
    return reply({error:"Route not found."},404);
  } catch (error) {
    console.error("Signal Desk request failed",path.split("/").slice(0,3).join("/"),error?.name||"Error");
    return reply({error:"The workspace could not complete this request. Please retry."},503);
  }
}
