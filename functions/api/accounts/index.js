import { json, readJson, withDb } from "../_utils.js";

export async function onRequestGet(context) {
  return withDb(context.env, async (db) => {
    const { results } = await db.prepare("SELECT email, name, role, created_at, last_login FROM accounts ORDER BY name").all();
    return json(200, { accounts: results });
  });
}

// Register or update an account. Never downgrades an existing admin's role —
// only an explicit role-change call (PATCH .../role) can do that. New accounts
// always start as "usuario"; there is no self-service way to register as admin.
export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!email || !name) return json(400, { error: "email y name son requeridos." });

  return withDb(context.env, async (db) => {
    const now = Date.now();
    const existing = await db.prepare("SELECT role, created_at FROM accounts WHERE email = ?").bind(email).first();
    const role = existing ? existing.role : "usuario";
    const createdAt = existing ? existing.created_at : now;
    await db.prepare(
      "INSERT INTO accounts (email, name, role, created_at, last_login) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(email) DO UPDATE SET name = excluded.name, last_login = excluded.last_login"
    ).bind(email, name, role, createdAt, now).run();
    return json(200, { email, name, role, createdAt, lastLogin: now });
  });
}
