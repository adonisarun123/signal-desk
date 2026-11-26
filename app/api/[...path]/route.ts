import { handleApi } from "@/server/router.js";
import { handleAuth, readSession } from "@/server/auth.js";
import { serverEnv } from "@/server/env.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The hourly sync walks Google bindings in bounded batches; give it room (Vercel Pro).
export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
  const env = serverEnv();
  if (new URL(request.url).pathname.startsWith("/api/auth/")) return handleAuth(request, env);
  const session = await readSession(request, env);
  return (await handleApi(request, env, session?.owner ?? null))
    ?? Response.json({ error: "Route not found." }, { status: 404 });
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
