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

const PBKDF2_ITERATIONS = 100000;

function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBits(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toBase64(new Uint8Array(bits));
}

// Uses the Workers runtime's native Web Crypto (PBKDF2-SHA256) — no npm
// dependency or bundler needed for this file-based-routing Functions project.
export async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, saltBytes);
  return { hash, salt: toBase64(saltBytes) };
}

export async function verifyPassword(password, salt, expectedHash) {
  const candidate = await deriveBits(password, fromBase64(salt));
  if (candidate.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}
