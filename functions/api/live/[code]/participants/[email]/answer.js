import { json, readJson, withDb } from "../../../../_utils.js";

// Atomic single-index update via SQLite's JSON1 functions — no read-modify-write,
// which is what the old client-side "full answers array overwrite" pattern needed
// (and why showLiveResults() had to trust in-memory state instead of re-reading
// storage, to dodge that race). Pre-sized answers arrays (see participants/[email].js
// POST) mean every index already exists, so json_set here always replaces cleanly.
export async function onRequestPatch(context) {
  const code = decodeURIComponent(context.params.code || "").trim().toUpperCase();
  const email = decodeURIComponent(context.params.email || "").trim().toLowerCase();
  const body = await readJson(context.request);
  const index = Number.isInteger(body.index) ? body.index : null;
  if (!code || !email || index === null) return json(400, { error: "code, email e index son requeridos." });

  const answer = JSON.stringify({ qNum: body.qNum, selectedIdx: body.selectedIdx, correct: !!body.correct });

  return withDb(context.env, async (db) => {
    const path = "$[" + index + "]";
    const result = await db.prepare(
      "UPDATE live_participants SET answers = json_set(answers, ?, json(?)), last_seen = ? WHERE session_code = ? AND email = ?"
    ).bind(path, answer, Date.now(), code, email).run();
    if (!result.meta || result.meta.changes === 0) return json(404, { error: "Participante no encontrado." });
    return json(200, { ok: true });
  });
}
