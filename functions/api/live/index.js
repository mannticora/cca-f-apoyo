import { json, readJson, withDb } from "../_utils.js";

// The client generates the 5-letter code and passes it in; collisions are
// astronomically unlikely (33^5 space) but handled with a 409 so the client can retry.
export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const questionOrder = Array.isArray(body.questionOrder) ? body.questionOrder : null;
  if (!code || !questionOrder || !questionOrder.length) {
    return json(400, { error: "code y questionOrder son requeridos." });
  }

  return withDb(context.env, async (db) => {
    const existing = await db.prepare("SELECT code FROM live_sessions WHERE code = ?").bind(code).first();
    if (existing) return json(409, { error: "Ese código ya existe, intenta de nuevo." });

    const now = Date.now();
    const totalSeconds = body.totalSeconds || 25 * 60;
    await db.prepare(
      "INSERT INTO live_sessions (code, status, start_time, created_by_email, created_by_name, created_at, total_questions, total_seconds, question_order) " +
      "VALUES (?, 'waiting', NULL, ?, ?, ?, ?, ?, ?)"
    ).bind(
      code,
      body.createdByEmail || null,
      body.createdByName || "?",
      now,
      questionOrder.length,
      totalSeconds,
      JSON.stringify(questionOrder)
    ).run();
    return json(200, { code });
  });
}
