-- Adds password storage to accounts. Nullable: accounts backfilled from
-- Firestore (scripts/migrate-firestore-to-d1.mjs) land with no password yet,
-- and functions/api/auth/login.js treats a NULL password_hash as "first
-- login sets the password" rather than requiring a separate reset flow.
ALTER TABLE accounts ADD COLUMN password_hash TEXT;
ALTER TABLE accounts ADD COLUMN password_salt TEXT;
