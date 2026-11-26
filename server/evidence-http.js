export function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function readObject(request) {
  const raw = await request.text();
  if (raw.length > 48_000) throw new InputError("This record is too large.", 413);
  try {
    const value = raw ? JSON.parse(raw) : {};
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  } catch { /* handled below */ }
  throw new InputError("Supply a JSON object.");
}

export async function getClient(env, owner, id) {
  if (typeof id !== "string" || !id.trim() || id.length > 180) throw new InputError("Select a client.");
  const client = await env.DB.prepare("SELECT id, name, domain FROM clients WHERE owner = ? AND id = ?").bind(owner, id).first();
  if (!client) throw new InputError("Client not found.", 404);
  return client;
}

export function requiredText(value, name, limit) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit) {
    throw new InputError(`${name} must contain 1–${limit} characters.`);
  }
  return value.trim();
}

export function handleInputError(err) {
  if (err instanceof InputError) return json({ error: err.message }, err.status);
  throw err;
}
