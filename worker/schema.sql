-- Pop-Up Panic leaderboard (Cloudflare D1). Applied in M5:
--   npx wrangler d1 execute popup-panic --local  --file worker/schema.sql
--   npx wrangler d1 execute popup-panic --remote --file worker/schema.sql   (asks the owner first)
-- Existing live DBs: apply worker/migrations/0002_alltime.sql instead.

CREATE TABLE IF NOT EXISTS scores (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  day         TEXT    NOT NULL,            -- 'YYYY-MM-DD' (UTC), a record only
  initials    TEXT    NOT NULL CHECK (length(initials) = 3),
  time_ms     INTEGER NOT NULL,
  points      INTEGER NOT NULL,
  closes      INTEGER NOT NULL,
  input_log   TEXT,                        -- JSON, kept for M5b replay checks
  ip_hash     TEXT    NOT NULL,            -- SHA-256(ip + daily salt); raw IPs never stored
  created_at  INTEGER NOT NULL             -- unix ms
);

-- All-time board: every run is a row; ranked by time, then points, then earliest.
CREATE INDEX IF NOT EXISTS scores_alltime ON scores (time_ms DESC, points DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS scores_by_initials ON scores (initials, time_ms DESC, points DESC, created_at ASC);

CREATE TABLE IF NOT EXISTS submissions (
  day      TEXT    NOT NULL,
  ip_hash  TEXT    NOT NULL,
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, ip_hash)
);
