import { handleGoogle } from "./google.js";
import { healthApi } from "./health.js";
import { aiApi } from "./ai.js";
import { handleJobRequest } from "./jobs.js";
import { clientsApi } from "./clients.js";

function reply(body, status = 200) {
  return Response.json(body, {status, headers: {"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}

async function readBody(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body;
}

async function getSettings(env,owner) {
  const row = await env.DB.prepare("SELECT schedule_enabled,last_check FROM desk_settings WHERE owner=?").bind(owner).first();
  return {frequency:"hourly",timezone:"Asia/Kolkata",scheduleEnabled:row ? Boolean(row.schedule_enabled) : true,lastCheck:row?.last_check ?? null};
}

// Constant-time comparison for the scheduler's bearer secret.
function sameSecret(given,expected) {
  if (typeof given !== "string" || given.length !== expected.length) return false;
  let diff=0;
  for (let i=0;i<expected.length;i++) diff|=given.charCodeAt(i)^expected.charCodeAt(i);
  return diff === 0;
}

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Jobs stay disabled without a strong secret. */
export function cronAuthorized(request,env) {
  const secret=env.CRON_SECRET || "";
  if (secret.length < 16) return false;
  return sameSecret(request.headers.get("Authorization") || "","Bearer "+secret);
}

/**
 * `owner` is the verified identity from the session cookie (server/auth.js), resolved by the
 * route handler. Identity is never read from request headers, which any client can set.
 */
export async function handleApi(request,env,owner=null) {
  const url=new URL(request.url);
  const path=url.pathname;
  const jobs=path === "/api/jobs/tick" || path === "/api/jobs/status";
  const scheduler=jobs && cronAuthorized(request,env);
  const mutation=!["GET","HEAD"].includes(request.method);
  const origin=request.headers.get("Origin");
  if (mutation && (origin && origin !== url.origin || !origin && !scheduler)) return reply({error:"Open Signal Desk to make this change."},403);
  if (jobs && !scheduler && !(owner && path === "/api/jobs/status" && request.method === "GET")) {
    return reply({error:"The scheduled check needs the scheduler credential."},401);
  }
  if (!owner && !jobs) return reply({error:"Sign in to this private workspace.",signIn:"/api/auth/signin?return_to=%2F"},401);
  if (mutation && Number(request.headers.get("content-length")||0)>100000) return reply({error:"This request is too large."},413);
  if (path === "/api/session" && request.method === "GET") return reply({authenticated:true,signOut:"/api/auth/signout"});
  if (!env.DB) return reply({error:"Workspace storage is temporarily unavailable."},503);
  try {
    if (jobs) return await handleJobRequest(request,env);
    if (path.startsWith("/api/google/")) return await handleGoogle(request,env,owner);
    if (path === "/api/alerts" || path.startsWith("/api/alerts/")) return await healthApi(request,env,owner);
    if (path === "/api/ai" || path.startsWith("/api/ai/")) return await aiApi(request,env,owner);
    if (path === "/api/clients" || path.startsWith("/api/clients/")) return await clientsApi(request,env,owner);
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
    console.error("Signal Desk request failed",path.split("/").slice(0,3).join("/"),error?.name||"Error",process.env.SD_DEBUG?error:"");
    return reply({error:"The workspace could not complete this request. Please retry."},503);
  }
}
