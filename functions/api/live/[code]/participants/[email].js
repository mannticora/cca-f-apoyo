import { json, readJson, withDb } from "../../../_utils.js";

function paramsToKey(context) {
  return {
    code: decodeURIComponent(context.params.code || "").trim().toUpperCase(),
    email: decodeURIComponent(context.params.email || "").trim().toLowerCase()
  };
}

export async function onRequestGet(context) {
  const { code, email } = paramsToKey(context);
  if (!code || !email) return json(400, { error: "code y email son requeridos." });

  return withDb(context.env, async (db) => {
    const row = await db.prepare(
      "SELECT email, name, joined_at AS joinedAt, start_time AS startTime, last_seen AS lastSeen, answers AS answersRaw " +
      "FROM live_participants WHERE session_code = ? AND email = ?"
    ).bind(code, email).first();
    if (!row) return json(200, { participant: null });
    const { answersRaw, ...rest } = row;
    return json(200, { participant: { ...rest, answers: JSON.parse(answersRaw) } });
  });
}

// Create-if-absent (reconnect-safe): pre-sizes `answers` to the session's question
// count so every later answer PATCH can target its index directly, no read-modify-write.
export async function onRequestPost(context) {
  const { code, email } = paramsToKey(context);
  const body = await readJson(context.request);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!code || !email || !name) return json(400, { error: "code, email y name son requeridos." });

  return withDb(context.env, async (db) => {
    const existing = await db.prepare(
      "SELECT email, name, joined_at AS joinedAt, start_time AS startTime, last_seen AS lastSeen, answers AS answersRaw " +
      "FROM live_participants WHERE session_code = ? AND email = ?"
    ).bind(code, email).first();
    if (existing) {
      const { answersRaw, ...rest } = existing;
      return json(200, { participant: { ...rest, answers: JSON.parse(answersRaw) } });
    }

    const session = await db.prepare("SELECT total_questions AS totalQuestions FROM live_sessions WHERE code = ?").bind(code).first();
    if (!session) return json(404, { error: "Sesión no encontrada." });

    const now = Date.now();
    const answers = new Array(session.totalQuestions).fill(null);
    await db.prepare(
      "INSERT INTO live_participants (session_code, email, name, joined_at, start_time, last_seen, answers) VALUES (?, ?, ?, ?, NULL, ?, ?)"
    ).bind(code, email, name, now, now, JSON.stringify(answers)).run();
    return json(200, { participant: { email, name, joinedAt: now, startTime: null, lastSeen: now, answers } });
  });
}

// Sets the personal countdown anchor exactly once (server-guarded), matching the
// old "if (!p.startTime)" client-side check but race-free.
export async function onRequestPatch(context) {
  const { code, email } = paramsToKey(context);
  if (!code || !email) return json(400, { error: "code y email son requeridos." });

  return withDb(context.env, async (db) => {
    const startTime = Date.now();
    await db.prepare(
      "UPDATE live_participants SET start_time = ?, last_seen = ? WHERE session_code = ? AND email = ? AND start_time IS NULL"
    ).bind(startTime, startTime, code, email).run();
    const row = await db.prepare(
      "SELECT start_time AS startTime FROM live_participants WHERE session_code = ? AND email = ?"
    ).bind(code, email).first();
    return json(200, { startTime: row ? row.startTime : startTime });
  });
}
