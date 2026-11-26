import { env } from "cloudflare:workers";
import { handleApi } from "../../../server/router.js";

export const dynamic = "force-dynamic";
export function GET(request: Request) { return handleApi(request, env); }
export const POST = GET;
export const PATCH = GET;
export const DELETE = GET;
