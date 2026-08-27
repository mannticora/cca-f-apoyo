#!/usr/bin/env node
// One-off backfill: reads every document from the app's Firestore cca_f_kv
// collection and emits a SQL file of idempotent INSERT ... ON CONFLICT statements
// for the new D1 schema (migrations/0001_init.sql). Re-runnable safely — run once
// now, once again right before the final client cutover as a delta pass.
//
// Usage: node scripts/migrate-firestore-to-d1.mjs > migration_data.sql
// Then:  wrangler d1 execute cca-f-db --remote --file=migration_data.sql

const VALID_HISTORY_TIPOS = ["Módulo", "Examen general", "Live"];

const FIREBASE_PROJECT_ID = "inmega-curso-cca-f";
const FIREBASE_API_KEY = "AIzaSyD5_TMjD_-nIG-3hErKSLW4eRQhdxEUxWw";
const COLLECTION = "cca_f_kv";

function sqlStr(v) {
  if (v === null || v === undefined) return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlNum(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "NULL";
  return String(Number(v));
}

function parseFullKey(fullKey) {
  if (fullKey.startsWith("shared__")) {
    return { scope: "shared", key: fullKey.slice("shared__".length) };
  }
  if (fullKey.startsWith("personal__")) {
    const rest = fullKey.slice("personal__".length);
    const sep = rest.indexOf("__");
    if (sep === -1) return null;
    return { scope: "personal", owner: rest.slice(0, sep), key: rest.slice(sep + 2) };
  }
  return null;
}

async function fetchAllDocs() {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${COLLECTION}?pageSize=300&key=${FIREBASE_API_KEY}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Firestore fetch failed: " + resp.status);
  const data = await resp.json();
  return data.documents || [];
}

function docValue(doc) {
  const raw = doc.fields?.value?.stringValue;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function main() {
  const docs = await fetchAllDocs();
  const statements = [];
  let accounts = 0, history = 0, liveSessions = 0, liveParticipants = 0, skipped = 0;

  for (const doc of docs) {
    const fullKey = doc.name.split("/").pop();
    const parsed = parseFullKey(fullKey);
    const value = docValue(doc);
    if (!parsed || !value) { skipped++; continue; }
    const { scope, owner, key } = parsed;

    if (scope === "shared" && key.startsWith("account:")) {
      statements.push(
        `INSERT INTO accounts (email, name, role, created_at, last_login) VALUES (${sqlStr(value.email)}, ${sqlStr(value.name)}, ${sqlStr(value.role || "usuario")}, ${sqlNum(value.createdAt)}, ${sqlNum(value.lastLogin)}) ` +
        `ON CONFLICT(email) DO UPDATE SET name=excluded.name, role=excluded.role, last_login=excluded.last_login;`
      );
      accounts++;
    } else if (scope === "personal" && key.startsWith("history:")) {
      if (!VALID_HISTORY_TIPOS.includes(value.tipo)) {
        // Orphaned/legacy data unrelated to the current app (e.g. old "Kahoot" test
        // entries keyed by display name, not email) — not real CCA-F attempt history.
        skipped++;
        continue;
      }
      const email = owner;
      statements.push(
        `INSERT INTO history_entries (email, tipo, modulo, timestamp, total, correctas, incorrectas, pct, session_code, question_order, questions, answers) VALUES (` +
        `${sqlStr(email)}, ${sqlStr(value.tipo)}, ${sqlStr(value.modulo)}, ${sqlNum(value.timestamp)}, ${sqlNum(value.total)}, ${sqlNum(value.correctas)}, ${sqlNum(value.incorrectas)}, ${sqlNum(value.pct)}, ` +
        `${sqlStr(value.sessionCode)}, ${sqlStr(value.questionOrder ? JSON.stringify(value.questionOrder) : null)}, ${sqlStr(value.questions ? JSON.stringify(value.questions) : null)}, ${sqlStr(JSON.stringify(value.answers || []))});`
      );
      history++;
    } else if (scope === "shared" && key.startsWith("live:") && key.endsWith(":meta")) {
      const code = key.split(":")[1];
      statements.push(
        `INSERT INTO live_sessions (code, status, start_time, created_by_email, created_by_name, created_at, total_questions, total_seconds, question_order) VALUES (` +
        `${sqlStr(code)}, ${sqlStr(value.status || "waiting")}, ${sqlNum(value.startTime)}, NULL, ${sqlStr(value.createdBy)}, ${sqlNum(value.createdAt)}, ${sqlNum(value.totalQuestions)}, ${sqlNum(value.totalSeconds)}, ${sqlStr(JSON.stringify(value.questionOrder || []))}) ` +
        `ON CONFLICT(code) DO UPDATE SET status=excluded.status, start_time=excluded.start_time;`
      );
      liveSessions++;
    } else if (scope === "shared" && key.startsWith("live:") && key.includes(":participant:")) {
      const parts = key.split(":participant:");
      const code = parts[0].split(":")[1];
      const email = parts[1];
      statements.push(
        `INSERT INTO live_participants (session_code, email, name, joined_at, start_time, last_seen, answers) VALUES (` +
        `${sqlStr(code)}, ${sqlStr(email)}, ${sqlStr(value.name)}, ${sqlNum(value.joinedAt)}, ${sqlNum(value.startTime)}, ${sqlNum(value.lastSeen)}, ${sqlStr(JSON.stringify(value.answers || []))}) ` +
        `ON CONFLICT(session_code, email) DO UPDATE SET start_time=excluded.start_time, last_seen=excluded.last_seen, answers=excluded.answers;`
      );
      liveParticipants++;
    } else {
      // "session:" (ephemeral progress-tracking) docs are intentionally skipped —
      // no value in migrating stale in-progress state for exams that already ended.
      skipped++;
    }
  }

  console.error(`-- accounts=${accounts} history=${history} live_sessions=${liveSessions} live_participants=${liveParticipants} skipped=${skipped}`);
  console.log(statements.join("\n"));
}

main().catch(e => { console.error(e); process.exit(1); });
