// Google sign-in for the private workspace, with an email allowlist.
//
// Replaces the identity headers that OpenAI Sites hosting injected. The session is an
// HMAC-signed cookie; identity is only ever taken from it, never from request headers.
//
// Environment:
//   AUTH_SECRET          32+ random characters; signs session and sign-in cookies.
//   ALLOWED_EMAILS       Comma-separated Google account emails allowed to sign in.
//                        Empty means nobody can sign in (fails closed).
//   AUTH_GOOGLE_ID       OAuth web client for sign-in (falls back to GOOGLE_CLIENT_ID).
//   AUTH_GOOGLE_SECRET   Its secret (falls back to GOOGLE_CLIENT_SECRET).
//   AUTH_URL             Public origin, e.g. https://signal-desk.vercel.app. Fixes the
//                        redirect URI across preview URLs. Defaults to the request origin.
//   OWNER_ID_OVERRIDES   Optional "email=ownerId,..." to keep a workspace id from before
//                        the move (stored Google tokens are encrypted against it).

const SESSION_COOKIE = "sd_session";
const FLOW_COOKIE = "sd_signin";
const SESSION_TTL = 7 * 24 * 3600;
const FLOW_TTL = 600;
const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
const enc = new TextEncoder();

const b64url = bytes => Buffer.from(bytes).toString("base64url");
const fromB64url = text => new Uint8Array(Buffer.from(text, "base64url"));
const randomToken = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

function secret(env) {
  const value = env.AUTH_SECRET || "";
  if (value.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters.");
  return value;
}
async function hmacKey(env) {
  return crypto.subtle.importKey("raw", enc.encode(secret(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function seal(env, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(body));
  return body + "." + b64url(new Uint8Array(sig));
}
export async function unseal(env, token) {
  if (typeof token !== "string") return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await hmacKey(env), fromB64url(sig), enc.encode(body)); } catch { return null; }
  if (!ok) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return typeof payload?.exp === "number" && payload.exp * 1000 > Date.now() ? payload : null;
  } catch { return null; }
}

export function allowedEmails(env) {
  return new Set(String(env.ALLOWED_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean));
}
export function ownerFor(env, email) {
  for (const pair of String(env.OWNER_ID_OVERRIDES || "").split(",")) {
    const at = pair.indexOf("=");
    if (at > 0 && pair.slice(0, at).trim().toLowerCase() === email) {
      const id = pair.slice(at + 1).trim();
      if (id) return id;
    }
  }
  return email;
}

function cookies(request) {
  const out = {};
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const at = part.indexOf("=");
    if (at > 0) out[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim());
  }
  return out;
}
function origin(request, env) {
  return (env.AUTH_URL || new URL(request.url).origin).replace(/\/+$/, "");
}
function insecureLocal(base) {
  const { protocol, hostname } = new URL(base);
  return protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}
function cookie(name, value, base, { maxAge, path = "/" }) {
  return [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Lax",
    ...(insecureLocal(base) ? [] : ["Secure"])].join("; ");
}
function safeReturn(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}
function googleClient(env) {
  const id = env.AUTH_GOOGLE_ID || env.GOOGLE_CLIENT_ID;
  const secretValue = env.AUTH_GOOGLE_SECRET || env.GOOGLE_CLIENT_SECRET;
  return id && secretValue ? { id, secret: secretValue } : null;
}
function redirect(location, setCookies = []) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}
function page(status, title, message) {
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Signal Desk</title>
<body style="font:16px/1.5 system-ui;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#132e26"><h1 style="font-size:1.4rem">${esc(title)}</h1><p>${esc(message)}</p><p><a href="/api/auth/signin?return_to=%2F">Try another Google account</a> · <a href="/">Back to Signal Desk</a></p></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

/** Returns { email, owner } for a valid, still-allowlisted session, else null. */
export async function readSession(request, env) {
  if (!env.AUTH_SECRET) return null;
  const session = await unseal(env, cookies(request)[SESSION_COOKIE]);
  if (!session || session.kind !== "session" || typeof session.email !== "string") return null;
  if (!allowedEmails(env).has(session.email)) return null;
  return { email: session.email, owner: ownerFor(env, session.email) };
}

async function startSignIn(request, env) {
  const client = googleClient(env);
  if (!client) return page(503, "Sign-in isn't configured", "Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET for this deployment.");
  const base = origin(request, env);
  const state = randomToken(), verifier = randomToken(48);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(verifier))));
  const returnTo = safeReturn(new URL(request.url).searchParams.get("return_to"));
  const flow = await seal(env, { kind: "signin", state, verifier, returnTo, exp: Math.floor(Date.now() / 1000) + FLOW_TTL });
  const url = new URL(AUTHORIZE);
  url.search = new URLSearchParams({
    client_id: client.id, redirect_uri: base + "/api/auth/callback", response_type: "code",
    scope: "openid email profile", state, code_challenge: challenge, code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return redirect(url.href, [cookie(FLOW_COOKIE, flow, base, { maxAge: FLOW_TTL, path: "/api/auth" })]);
}

function decodeJwtPayload(jwt) {
  const part = typeof jwt === "string" ? jwt.split(".")[1] : null;
  if (!part) return null;
  try { return JSON.parse(Buffer.from(part, "base64url").toString("utf8")); } catch { return null; }
}

async function finishSignIn(request, env) {
  const client = googleClient(env);
  if (!client) return page(503, "Sign-in isn't configured", "Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET for this deployment.");
  const base = origin(request, env);
  const clearFlow = cookie(FLOW_COOKIE, "", base, { maxAge: 0, path: "/api/auth" });
  const params = new URL(request.url).searchParams;
  const flow = await unseal(env, cookies(request)[FLOW_COOKIE]);
  if (!flow || flow.kind !== "signin" || !params.get("state") || params.get("state") !== flow.state) {
    return page(400, "Sign-in expired", "Start sign-in again from Signal Desk.");
  }
  if (params.get("error") || !params.get("code")) return page(400, "Sign-in was cancelled", "Google did not complete the sign-in.");
  // The ID token comes straight from Google's token endpoint over TLS with our client
  // secret, so its signature need not be re-verified (OpenID Connect Core 3.1.3.7).
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.get("code"), client_id: client.id, client_secret: client.secret,
      redirect_uri: base + "/api/auth/callback", grant_type: "authorization_code", code_verifier: flow.verifier,
    }),
  });
  const tokens = await res.json().catch(() => null);
  const claims = res.ok ? decodeJwtPayload(tokens?.id_token) : null;
  if (!claims || !ISSUERS.has(claims.iss) || claims.aud !== client.id || !(claims.exp * 1000 > Date.now())) {
    return page(502, "Google sign-in failed", "Google did not return a valid identity. Please try again.");
  }
  const email = String(claims.email || "").toLowerCase();
  if (!email || claims.email_verified !== true || !allowedEmails(env).has(email)) {
    return new Response((await page(403, "This account can't open Signal Desk", "The Google account you chose isn't on this workspace's allowlist.").text()), {
      status: 403, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Set-Cookie": clearFlow },
    });
  }
  const session = await seal(env, { kind: "session", email, exp: Math.floor(Date.now() / 1000) + SESSION_TTL });
  return redirect(flow.returnTo, [clearFlow, cookie(SESSION_COOKIE, session, base, { maxAge: SESSION_TTL })]);
}

/** Handles /api/auth/signin, /api/auth/callback and /api/auth/signout. */
export async function handleAuth(request, env) {
  const path = new URL(request.url).pathname;
  if (request.method !== "GET") return new Response("Method unavailable.", { status: 405 });
  try {
    if (path === "/api/auth/signin") return await startSignIn(request, env);
    if (path === "/api/auth/callback") return await finishSignIn(request, env);
    if (path === "/api/auth/signout") return redirect("/", [cookie(SESSION_COOKIE, "", origin(request, env), { maxAge: 0 })]);
  } catch (error) {
    console.error("Signal Desk sign-in failed", error?.message || "Error");
    return page(503, "Sign-in is unavailable", "The deployment's sign-in settings are incomplete.");
  }
  return new Response("Not found.", { status: 404 });
}
