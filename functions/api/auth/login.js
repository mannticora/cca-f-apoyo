import { json, readJson, withDb, hashPassword, verifyPassword } from "../_utils.js";

// Drives the single register-or-login button: creates the account if the
// email is new, sets the password on first login for accounts backfilled
// from Firestore with no password yet, otherwise verifies it. Never changes
// role — same guarantee as functions/api/accounts/index.js's POST.
//
// Admin accounts are the one exception: they log in with just name+email,
// no password at all. They already passed the Admin PIN gate to get that
// role (see verify-admin-pin.js + accounts/[email]/role.js), so this treats
// that promotion as the authentication step for admins.
export async function onRequestPost(context) {
  const body = await readJson(context.request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) return json(400, { error: "email es requerido." });

  return withDb(context.env, async (db) => {
    const existing = await db.prepare(
      "SELECT name, role, created_at, last_login, password_hash, password_salt FROM accounts WHERE email = ?"
    ).bind(email).first();
    const now = Date.now();

    if (existing && existing.role === "admin") {
      const finalName = name || existing.name;
      await db.prepare("UPDATE accounts SET name = ?, last_login = ? WHERE email = ?").bind(finalName, now, email).run();
      return json(200, { email, name: finalName, role: "admin", createdAt: existing.created_at, lastLogin: now });
    }

    if (!password) return json(400, { error: "La contraseña es requerida.", field: "password" });
    if (password.length < 6) return json(400, { error: "La contraseña debe tener al menos 6 caracteres.", field: "password" });

    if (!existing) {
      if (!name) return json(400, { error: "Escribe tu nombre para crear tu cuenta.", field: "name" });
      const { hash, salt } = await hashPassword(password);
      await db.prepare(
        "INSERT INTO accounts (email, name, role, created_at, last_login, password_hash, password_salt) " +
        "VALUES (?, ?, 'usuario', ?, ?, ?, ?)"
      ).bind(email, name, now, now, hash, salt).run();
      return json(200, { email, name, role: "usuario", createdAt: now, lastLogin: now });
    }

    const finalName = name || existing.name;

    if (!existing.password_hash) {
      const { hash, salt } = await hashPassword(password);
      await db.prepare(
        "UPDATE accounts SET name = ?, last_login = ?, password_hash = ?, password_salt = ? WHERE email = ?"
      ).bind(finalName, now, hash, salt, email).run();
      return json(200, { email, name: finalName, role: existing.role, createdAt: existing.created_at, lastLogin: now });
    }

    const ok = await verifyPassword(password, existing.password_salt, existing.password_hash);
    if (!ok) return json(401, { error: "Contraseña incorrecta." });

    await db.prepare("UPDATE accounts SET name = ?, last_login = ? WHERE email = ?").bind(finalName, now, email).run();
    return json(200, { email, name: finalName, role: existing.role, createdAt: existing.created_at, lastLogin: now });
  });
}
