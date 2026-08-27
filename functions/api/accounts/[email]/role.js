import { json, readJson, withDb } from "../../_utils.js";

export async function onRequestPatch(context) {
  const email = decodeURIComponent(context.params.email || "").trim().toLowerCase();
  const body = await readJson(context.request);
  const role = body.role;
  if (!email || (role !== "admin" && role !== "usuario")) {
    return json(400, { error: "email valido y role ('admin'|'usuario') son requeridos." });
  }

  return withDb(context.env, async (db) => {
    const result = await db.prepare("UPDATE accounts SET role = ? WHERE email = ?").bind(role, email).run();
    if (!result.meta || result.meta.changes === 0) return json(404, { error: "Cuenta no encontrada." });
    return json(200, { email, role });
  });
}
