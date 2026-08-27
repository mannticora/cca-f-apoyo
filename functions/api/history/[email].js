import { json, withDb } from "../_utils.js";

export async function onRequestGet(context) {
  const email = decodeURIComponent(context.params.email || "").trim().toLowerCase();
  if (!email) return json(400, { error: "email es requerido." });

  return withDb(context.env, async (db) => {
    const { results } = await db.prepare(
      "SELECT tipo, modulo, timestamp, total, correctas, incorrectas, pct, session_code AS sessionCode, " +
      "question_order AS questionOrderRaw, questions AS questionsRaw, answers AS answersRaw " +
      "FROM history_entries WHERE email = ? ORDER BY timestamp DESC"
    ).bind(email).all();

    const entries = results.map(r => ({
      tipo: r.tipo, modulo: r.modulo, timestamp: r.timestamp, total: r.total,
      correctas: r.correctas, incorrectas: r.incorrectas, pct: r.pct,
      sessionCode: r.sessionCode || undefined,
      questionOrder: r.questionOrderRaw ? JSON.parse(r.questionOrderRaw) : undefined,
      questions: r.questionsRaw ? JSON.parse(r.questionsRaw) : undefined,
      answers: JSON.parse(r.answersRaw)
    }));
    return json(200, { entries });
  });
}
