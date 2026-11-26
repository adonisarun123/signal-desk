import { getClient, handleInputError, InputError, json, readObject, requiredText } from "./evidence-http.js";

const DAILY_LIMIT = 3;
const prepared = new WeakSet();
const MAX_CITATIONS = 40;

export async function ensureAi(env) {
  if (prepared.has(env.DB)) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_observations (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE, engine TEXT NOT NULL, model TEXT,
      prompt TEXT NOT NULL, answer TEXT NOT NULL, citations TEXT NOT NULL, mentioned INTEGER NOT NULL,
      cited INTEGER NOT NULL, observed_at TEXT NOT NULL, method TEXT NOT NULL, created_at TEXT NOT NULL)`),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS ai_obs_owner_client_date ON ai_observations(owner,client_id,observed_at)"),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS ai_sample_attempts (
      owner TEXT NOT NULL, day TEXT NOT NULL, token TEXT NOT NULL, PRIMARY KEY(owner,day,token))`),
  ]);
  prepared.add(env.DB);
}

function publicUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new InputError("Enter a complete http or https citation URL."); }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.href.length > 2048) {
    throw new InputError("Citation URLs must be http or https links without embedded credentials.");
  }
  return url;
}

function normalizeWords(value) {
  return value.normalize("NFKD").toLocaleLowerCase("en").replace(/\p{M}/gu,"").replace(/[^\p{L}\p{N}]+/gu," ").trim();
}

function citationsFor(input, answerLength) {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > MAX_CITATIONS) throw new InputError("Add up to 40 citation links.");
  return input.map(citation => {
    const candidate = typeof citation === "string" ? {url:citation} : citation;
    if (!candidate || typeof candidate.url !== "string") throw new InputError("Each citation requires a URL.");
    const link = publicUrl(candidate.url);
    const cleaned = { url: link.href, title: String(candidate.title || link.hostname).slice(0,300) };
    if (Number.isInteger(candidate.startIndex) && Number.isInteger(candidate.endIndex)
      && candidate.startIndex >= 0 && candidate.startIndex < candidate.endIndex && candidate.endIndex <= answerLength) {
      cleaned.startIndex = candidate.startIndex;
      cleaned.endIndex = candidate.endIndex;
    }
    return cleaned;
  });
}

/** An inline source title or URL alone does not count as a brand mention. */
export function classifyEvidence(client, answer, citations) {
  let sourceFree = answer;
  for (const c of citations.filter(x => x.startIndex !== undefined).sort((a,b) => b.startIndex-a.startIndex)) {
    sourceFree = sourceFree.slice(0,c.startIndex) + " " + sourceFree.slice(c.endIndex);
  }
  sourceFree = sourceFree.replace(/\[[^\]\n]*\]\(https?:\/\/[^)]+\)/gi," ").replace(/https?:\/\/[^\s<>]+/gi," ");
  const brand = normalizeWords(client.name);
  const mentioned = !!brand && (" " + normalizeWords(sourceFree) + " ").includes(" " + brand + " ");
  let host = "";
  try { host = new URL(client.domain.includes("://") ? client.domain : "https://" + client.domain).hostname.toLowerCase().replace(/^www\.|\.$/g,""); } catch { /* Unknown domain cannot match a citation. */ }
  const cited = !!host && citations.some(item => {
    const hostname = new URL(item.url).hostname.toLowerCase().replace(/\.$/,"");
    return hostname === host || hostname.endsWith("." + host);
  });
  return { mentioned, cited };
}

function record(row) {
  return { id: row.id, clientId: row.client_id, engine: row.engine, model: row.model, prompt: row.prompt, answer: row.answer,
    citations: JSON.parse(row.citations), mentioned: !!row.mentioned, cited: !!row.cited, method: row.method, observedAt: row.observed_at };
}

export async function readAi(env, owner, clientId) {
  await ensureAi(env);
  const params = clientId ? [owner,clientId] : [owner];
  const where = clientId ? "owner=? AND client_id=?" : "owner=?";
  const day = new Date().toISOString().slice(0,10);
  const [list, counts, attempts] = await Promise.all([
    env.DB.prepare(`SELECT * FROM ai_observations WHERE ${where} ORDER BY observed_at DESC,created_at DESC LIMIT 200`).bind(...params).all(),
    env.DB.prepare(`SELECT COUNT(*) samples, COALESCE(SUM(mentioned),0) mentions, COALESCE(SUM(cited),0) citations FROM ai_observations WHERE ${where}`).bind(...params).first(),
    env.DB.prepare("SELECT COUNT(*) used FROM ai_sample_attempts WHERE owner=? AND day=?").bind(owner,day).first(),
  ]);
  const rate = value => counts.samples ? Math.round(1000 * value / counts.samples) / 10 : null;
  return { observations: list.results.map(record), summary: { ...counts, mentionRate: rate(counts.mentions), citationRate: rate(counts.citations) },
    samplingAvailable: !!env.OPENAI_API_KEY, dailyLimit: DAILY_LIMIT, remaining: Math.max(0,DAILY_LIMIT-attempts.used) };
}

async function storeEvidence(env, owner, client, data) {
  const prompt = requiredText(data.prompt, "Prompt", 1000);
  // Keep API annotation offsets aligned with provider output.
  const answer = data.method === "api" ? data.answer : requiredText(data.answer, "Observed answer", 16000);
  const engine = requiredText(data.engine, "AI engine", 80);
  const model = data.model ? requiredText(data.model, "Model", 160) : null;
  const citations = citationsFor(data.citations, answer.length);
  const evaluated = classifyEvidence(client,answer,citations);
  const recorded = new Date();
  const when = data.observedAt === undefined ? recorded : new Date(data.observedAt);
  if (!Number.isFinite(when.getTime()) || when.getTime() <= 0 || when.getTime() > recorded.getTime() + 300_000) throw new InputError("Enter a valid observation date in the past.");
  const id = crypto.randomUUID();
  const saved = await env.DB.prepare(`INSERT INTO ai_observations
    (id,owner,client_id,engine,model,prompt,answer,citations,mentioned,cited,observed_at,method,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`).bind(id,owner,client.id,engine,model,prompt,answer,JSON.stringify(citations),
    Number(evaluated.mentioned),Number(evaluated.cited),when.toISOString(),data.method,recorded.toISOString()).first();
  return record(saved);
}

export function extractSample(result) {
  if (result.status !== "completed") throw new InputError("The AI provider returned an incomplete sample.",502);
  if (!result.output?.some(item => item.type === "web_search_call" && item.status === "completed")) {
    throw new InputError("The provider did not complete a web search for this sample.",502);
  }
  let answer = "";
  const citations = [];
  for (const entry of result.output) {
    if (entry.type !== "message") continue;
    for (const part of entry.content || []) {
      if (part.type !== "output_text" || typeof part.text !== "string" || !part.text) continue;
      if (answer) answer += "\n";
      const offset = answer.length;
      answer += part.text;
      for (const annotation of part.annotations || []) {
        if (annotation.type === "url_citation") citations.push({ url: annotation.url, title: annotation.title,
          startIndex: offset + annotation.start_index, endIndex: offset + annotation.end_index });
      }
    }
  }
  if (!answer.trim() || answer.length > 16000) throw new InputError("The provider returned no usable answer text.",502);
  return { answer, citations: citations.slice(0,MAX_CITATIONS) };
}

async function sample(env, owner, client, prompt, requestToken) {
  if (!env.OPENAI_API_KEY) throw new InputError("Add a server-side OpenAI API key to enable paid sampling.",503);
  const token = requestToken ? requiredText(requestToken,"Request identifier",100) : crypto.randomUUID();
  const model = env.OPENAI_MODEL || "gpt-5.4-mini";
  const today = new Date().toISOString().slice(0,10);
  // One atomic reservation per attempt. A timeout may have incurred a charge upstream.
  const reserved = await env.DB.prepare(`INSERT OR IGNORE INTO ai_sample_attempts (owner,day,token)
    SELECT ?,?,? WHERE (SELECT COUNT(*) FROM ai_sample_attempts WHERE owner=? AND day=?) < ? RETURNING token`)
    .bind(owner,today,token,owner,today,DAILY_LIMIT).first();
  if (!reserved) {
    const duplicate = await env.DB.prepare("SELECT token FROM ai_sample_attempts WHERE owner=? AND day=? AND token=?").bind(owner,today,token).first();
    throw new InputError(duplicate ? "This sample request was already submitted." : "The workspace has used its three sample attempts for this UTC day.", duplicate ? 409 : 429);
  }
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { "Content-Type":"application/json", Authorization: "Bearer " + env.OPENAI_API_KEY },
      body: JSON.stringify({ model, input: prompt, store: false,
        instructions: "Answer the user's search question briefly using public web sources, as a neutral research assistant. Where relevant, cite your sources inline.",
        tools: [{ type:"web_search", search_context_size:"low" }], tool_choice:"required", max_tool_calls: 1, max_output_tokens: 900 }),
      signal: AbortSignal.timeout(70_000),
    });
  } catch { throw new InputError("The AI provider could not be reached. This attempt counts toward the daily limit.",502); }
  if (!response.ok) throw new InputError(`The AI provider rejected this request (HTTP ${response.status}). Check the server key, billing, and model access.`,502);
  let result;
  try { result = await response.json(); } catch { throw new InputError("The provider returned an unreadable response.",502); }
  const parsed = extractSample(result);
  return storeEvidence(env,owner,client,{ ...parsed, prompt, engine: "OpenAI web search", model: result.model || model, method:"api" });
}

export async function aiApi(request,env,owner) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/ai")) return null;
  if (!owner) return json({error:"Sign in to your workspace."},401);
  try {
    await ensureAi(env);
    if (url.pathname === "/api/ai" && request.method === "GET") {
      const id = url.searchParams.get("clientId");
      if (id) await getClient(env,owner,id);
      return json(await readAi(env,owner,id));
    }
    if (request.method === "POST" && ["/api/ai/observations","/api/ai/sample"].includes(url.pathname)) {
      const body = await readObject(request);
      const client = await getClient(env,owner,body.clientId);
      const observation = url.pathname.endsWith("/sample")
        ? await sample(env,owner,client,requiredText(body.prompt,"Prompt",1000),request.headers.get("Idempotency-Key"))
        : await storeEvidence(env,owner,client,{ ...body, method: "manual" });
      return json({observation},201);
    }
    return json({error:"AI evidence route not found."},404);
  } catch (error) { return handleInputError(error); }
}
