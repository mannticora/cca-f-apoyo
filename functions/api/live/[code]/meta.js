import { json, readJson, withDb } from "../../_utils.js";

export async function onRequestGet(context) {
  const code = decodeURIComponent(context.params.code || "").trim().toUpperCase();
  if (!code) return json(400, { error: "code es requerido." });

  return withDb(context.env, async (db) => {
    const row = await db.prepare(
      "SELECT code, status, start_time AS startTime, created_by_email AS createdByEmail, created_by_name AS createdBy, " +
      "created_at AS createdAt, total_questions AS totalQuestions, total_seconds AS totalSeconds, question_order AS questionOrderRaw " +
      "FROM live_sessions WHERE code = ?"
    ).bind(code).first();
    if (!row) return json(200, { meta: null });
    const { questionOrderRaw, ...rest } = row;
    return json(200, { meta: { ...rest, questionOrder: JSON.parse(questionOrderRaw) } });
  });
}

// Atomic start: only flips waiting -> running once; a double-click racing two
// requests results in one no-op (meta.changes === 0 on the second), no read-modify-write.
export async function onRequestPatch(context) {
  const code = decodeURIComponent(context.params.code || "").trim().toUpperCase();
  const body = await readJson(context.request);
  if (body.action !== "start") return json(400, { error: "Acción no soportada." });

  return withDb(context.env, async (db) => {
    const startTime = Date.now();
    const result = await db.prepare(
      "UPDATE live_sessions SET status = 'running', start_time = ? WHERE code = ? AND status = 'waiting'"
    ).bind(startTime, code).run();
    return json(200, { started: !!(result.meta && result.meta.changes), startTime });
  });
}
