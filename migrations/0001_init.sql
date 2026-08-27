-- CCA-F Simulation: D1 schema (replaces the Firestore cca_f_kv collection)
-- Hybrid design: real columns for anything filtered/joined/aggregated,
-- JSON TEXT columns for large nested data that's always read back whole.

CREATE TABLE accounts (
  email       TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'usuario' CHECK (role IN ('usuario', 'admin')),
  created_at  INTEGER NOT NULL,
  last_login  INTEGER NOT NULL
);

CREATE TABLE history_entries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL REFERENCES accounts(email),
  tipo           TEXT NOT NULL CHECK (tipo IN ('Módulo', 'Examen general', 'Live')),
  modulo         TEXT,
  timestamp      INTEGER NOT NULL,
  total          INTEGER NOT NULL,
  correctas      INTEGER NOT NULL,
  incorrectas    INTEGER NOT NULL,
  pct            INTEGER NOT NULL,
  session_code   TEXT,       -- only tipo='Live'
  question_order TEXT,       -- JSON array of indices, only tipo='Live'
  questions      TEXT,       -- JSON blob (full question objects), only Módulo/Examen general
  answers        TEXT NOT NULL  -- JSON array, verbatim from JSON.stringify (holes -> null)
);
CREATE INDEX idx_history_email_ts ON history_entries(email, timestamp DESC);
CREATE INDEX idx_history_pct ON history_entries(pct);

-- Replaces the old name-keyed "session:<userName>-<ts>" Firestore docs (a real
-- identity-collision risk, since two people could share a display name) with an
-- email-keyed upsert. This also caps growth at #registered users instead of
-- growing forever, matching what the monitor actually needs: "who's taking the
-- exam right now," not a historical log (that's what history_entries is for).
CREATE TABLE progress_sessions (
  user_email  TEXT PRIMARY KEY REFERENCES accounts(email),
  user_name   TEXT NOT NULL,
  mode        TEXT NOT NULL,   -- 'general' | 'modulo'
  current_q   INTEGER NOT NULL,
  total_q     INTEGER NOT NULL,
  correct     INTEGER NOT NULL,
  finished    INTEGER NOT NULL DEFAULT 0,
  last_update INTEGER NOT NULL
);

CREATE TABLE live_sessions (
  code             TEXT PRIMARY KEY,
  status           TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'running')),
  start_time       INTEGER,
  created_by_email TEXT REFERENCES accounts(email),
  created_by_name  TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  total_questions  INTEGER NOT NULL,
  total_seconds    INTEGER NOT NULL,
  question_order   TEXT NOT NULL
);
CREATE INDEX idx_live_sessions_created_at ON live_sessions(created_at DESC);

CREATE TABLE live_participants (
  session_code TEXT NOT NULL REFERENCES live_sessions(code),
  email        TEXT NOT NULL,
  name         TEXT NOT NULL,
  joined_at    INTEGER NOT NULL,
  start_time   INTEGER,
  last_seen    INTEGER NOT NULL,
  answers      TEXT NOT NULL DEFAULT '[]',  -- pre-sized JSON array of nulls at join time
  PRIMARY KEY (session_code, email)
);
