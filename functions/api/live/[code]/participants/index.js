import { json, withDb } from "../../../_utils.js";

export async function onRequestGet(context) {
  const code = decodeURIComponent(context.params.code || "").trim().toUpperCase();
  if (!code) return json(400, { error: "code es requerido." });

  return withDb(context.env, async (db) => {
    const { results } = await db.prepare(
      "SELECT email, name, joined_at AS joinedAt, start_time AS startTime, last_seen AS lastSeen, answers AS answersRaw " +
      "FROM live_participants WHERE session_code = ?"
    ).bind(code).all();
    const participants = results.map(r => {
      const { answersRaw, ...rest } = r;
      return { ...rest, answers: JSON.parse(answersRaw) };
    });
    return json(200, { participants });
  });
}
