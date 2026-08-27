export function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function readJson(request) {
  try { return await request.json(); } catch (e) { return {}; }
}

// Wraps a D1 call so every endpoint returns a consistent 500 shape on failure
// instead of leaking a raw D1/driver error to the client.
export async function withDb(env, fn) {
  if (!env.DB) return json(500, { error: "D1 no está configurado en este entorno (falta el binding DB)." });
  try {
    return await fn(env.DB);
  } catch (e) {
    return json(500, { error: "Error de base de datos: " + e.message });
  }
}
