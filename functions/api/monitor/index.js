import { json, readJson, withDb } from "../_utils.js";

export async function onRequestGet(context) {
  return withDb(context.env, async (db) => {
    const { results } = await db.prepare(
      "SELECT user_name AS name, mode, current_q AS current, total_q AS total, correct, finished, last_update AS lastUpdate " +
      "FROM progress_sessions ORDER BY last_update DESC"
    ).all();
    return json(200, { sessions: results.map(r => ({ ...r, finished: !!r.finished })) });
  });
}

// Upsert by email — latest state per user, not an ever-growing log (full attempt
// history already lives in history_entries).
export async function onRequestPut(context) {
  const body = await readJson(context.request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return json(400, { error: "email es requerido." });

  return withDb(context.env, async (db) => {
    await db.prepare(
      "INSERT INTO progress_sessions (user_email, user_name, mode, current_q, total_q, correct, finished, last_update) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(user_email) DO UPDATE SET user_name=excluded.user_name, mode=excluded.mode, " +
      "current_q=excluded.current_q, total_q=excluded.total_q, correct=excluded.correct, " +
      "finished=excluded.finished, last_update=excluded.last_update"
    ).bind(
      email, body.name || "Anonymous", body.mode || "general",
      body.current || 0, body.total || 0, body.correct || 0,
      body.finished ? 1 : 0, Date.now()
    ).run();
    return json(200, { ok: true });
  });
}
