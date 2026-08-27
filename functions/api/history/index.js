import { json, readJson, withDb } from "../_utils.js";

const VALID_TIPOS = ["Módulo", "Examen general", "Live"];

export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !VALID_TIPOS.includes(body.tipo)) {
    return json(400, { error: "email y tipo válido son requeridos." });
  }

  return withDb(context.env, async (db) => {
    await db.prepare(
      "INSERT INTO history_entries (email, tipo, modulo, timestamp, total, correctas, incorrectas, pct, session_code, question_order, questions, answers) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      email,
      body.tipo,
      body.modulo || null,
      body.timestamp || Date.now(),
      body.total || 0,
      body.correctas || 0,
      body.incorrectas || 0,
      body.pct || 0,
      body.sessionCode || null,
      body.questionOrder ? JSON.stringify(body.questionOrder) : null,
      body.questions ? JSON.stringify(body.questions) : null,
      JSON.stringify(body.answers || [])
    ).run();
    return json(200, { ok: true });
  });
}
