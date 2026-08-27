import { json, withDb } from "../_utils.js";

export async function onRequestGet(context) {
  const email = decodeURIComponent(context.params.email || "").trim().toLowerCase();
  if (!email) return json(400, { error: "email es requerido." });

  return withDb(context.env, async (db) => {
    const row = await db.prepare(
      "SELECT email, name, role, created_at AS createdAt, last_login AS lastLogin FROM accounts WHERE email = ?"
    ).bind(email).first();
    return json(200, { account: row || null });
  });
}
