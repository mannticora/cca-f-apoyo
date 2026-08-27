import { json, withDb } from "../_utils.js";

export async function onRequestGet(context) {
  return withDb(context.env, async (db) => {
    const { results } = await db.prepare(
      "SELECT code, status, total_questions AS totalQuestions, created_by_name AS createdBy, created_at AS createdAt " +
      "FROM live_sessions ORDER BY created_at DESC LIMIT 8"
    ).all();
    return json(200, { sessions: results });
  });
}
