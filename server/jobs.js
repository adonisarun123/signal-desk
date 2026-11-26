import { readGoogle, syncGoogle } from "./google.js";
import { runHealthChecks } from "./health.js";

function response(data,status=200) { return Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}}); }
function describe(row) {
  if (!row) return null;
  return {startedAt:row.started_at,finishedAt:row.finished_at,...(row.result ? JSON.parse(row.result) : {status:"running"})};
}

// The shared writer is served only behind owner-private Sites dispatch. Its native
// service credential is consumed at that boundary. The instance flag defaults off.
// It accepts no tenant, resource, or query selectors and returns only aggregate counts.
export async function handleJobRequest(req,env,owner) {
  if (env.PRIVATE_SITE_JOBS !== "enabled") return response({error:"The private scheduled writer is disabled."},403);
  const url=new URL(req.url);
  if (url.search) return response({error:"Job selectors are not supported."},400);
  const db=env.DB;
  if (url.pathname === "/api/jobs/status" && req.method === "GET") {
    const row=await db.prepare("SELECT * FROM desk_job_runs ORDER BY started_at DESC LIMIT 1").first();
    return response({lastRun:describe(row)});
  }
  if (url.pathname !== "/api/jobs/tick" || req.method !== "POST") return response({error:"Method unavailable."},405);
  const raw=await req.text();
  if (raw.trim() && raw.trim() !== "{}") return response({error:"The scheduled check does not accept parameters."},400);
  const now=new Date(), stamp=now.toISOString(), bucket=stamp.slice(0,13);
  const lease=crypto.randomUUID(), expired=new Date(now.getTime()-10*60*1000).toISOString();
  const locked=await db.prepare(`INSERT INTO desk_job_runs(bucket,started_at,lease) VALUES(?,?,?) ON CONFLICT(bucket)
    DO UPDATE SET started_at=excluded.started_at,lease=excluded.lease WHERE desk_job_runs.finished_at IS NULL AND desk_job_runs.started_at < ?
    RETURNING bucket`).bind(bucket,stamp,lease,expired).first();
  if (!locked) {
    const existing=await db.prepare("SELECT * FROM desk_job_runs WHERE bucket=?").bind(bucket).first();
    return response({run:describe(existing),alreadyRun:true});
  }
  // SYNC_BATCH_LIMIT raises the per-workspace pass size (1-25) as client count and quota allow.
  const configured=Number.parseInt(env.SYNC_BATCH_LIMIT ?? "",10);
  const batchLimit=Number.isInteger(configured)?Math.max(1,Math.min(configured,25)):5;
  const totals={workspaces:0,connections:0,synced:0,failed:0,partial:0,workspacesWithBacklog:0,newCritical:0,newWarnings:0};
  const workspaces=await db.prepare("SELECT owner FROM desk_settings WHERE schedule_enabled=1 ORDER BY COALESCE(last_check,'') LIMIT 8").all();
  for (const {owner:tenant} of workspaces.results) {
    totals.workspaces++;
    try {
      const bound=await readGoogle(env,tenant);
      totals.connections+=bound.bindings.length;
      if (bound.bindings.length) {
        const sync=await syncGoogle(env,tenant,undefined,{limit:batchLimit});
        const results=sync.results||[];
        totals.synced+=results.filter(row=>row.status==="synced").length;
        totals.failed+=results.filter(row=>row.status==="error").length;
        totals.partial+=results.filter(row=>row.status==="partial").length;
        if (sync.remaining) totals.workspacesWithBacklog++;
      }
      const checked=await runHealthChecks(env,tenant);
      for (const alert of checked.alerts) {
        if (alert.status!=="open" || alert.firstSeen<stamp) continue;
        if (alert.severity==="critical") totals.newCritical++;
        if (alert.severity==="warning") totals.newWarnings++;
      }
      await db.prepare("UPDATE desk_settings SET last_check=? WHERE owner=?").bind(new Date().toISOString(),tenant).run();
    } catch { totals.failed++; }
  }
  const result={status:(totals.failed || totals.partial) ? "partial" : "complete",batchLimit,...totals};
  const end=new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE desk_job_runs SET result=?,finished_at=? WHERE bucket=? AND lease=?").bind(JSON.stringify(result),end,bucket,lease),
    db.prepare("DELETE FROM desk_job_runs WHERE started_at<? AND finished_at IS NOT NULL").bind(new Date(now.getTime()-35*86400000).toISOString())
  ]);
  return response({run:{startedAt:stamp,finishedAt:end,...result},alreadyRun:false});
}
