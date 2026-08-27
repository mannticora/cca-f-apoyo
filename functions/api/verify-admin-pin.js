function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const expected = env.ADMIN_PIN;
  if (!expected) {
    return json(500, { ok: false, error: "El servidor no tiene configurado ADMIN_PIN." });
  }

  let body;
  try { body = await request.json(); } catch (e) { body = {}; }
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";

  return json(200, { ok: pin.length > 0 && pin === expected });
}
