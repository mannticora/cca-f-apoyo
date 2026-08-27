import { json, withDb } from "../_utils.js";

// Replaces the old client-side listRaw("personal__") + string-splitting hack:
// one indexed SQL query, grouped/aggregated server-side. The INNER JOIN already
// excludes accounts with zero attempts, matching the dashboard's "active students only" rule.
export async function onRequestGet(context) {
  return withDb(context.env, async (db) => {
    const { results } = await db.prepare(
      "SELECT a.email, a.name, a.role, " +
      "COUNT(h.id) AS attempts, " +
      "ROUND(AVG(h.pct)) AS avgPct, " +
      "MAX(h.pct) AS bestPct, " +
      "MAX(h.timestamp) AS lastTimestamp " +
      "FROM accounts a JOIN history_entries h ON h.email = a.email " +
      "GROUP BY a.email ORDER BY avgPct DESC"
    ).all();
    return json(200, { students: results });
  });
}
