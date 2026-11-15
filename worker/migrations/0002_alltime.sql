-- Migration 0002: Daily mode -> all-time top 10, every run stored.
-- Must be applied by the owner (asks the owner first):
--   npx wrangler d1 execute popup-panic --remote --file worker/migrations/0002_alltime.sql

DROP INDEX IF EXISTS scores_best_per_player;
DROP INDEX IF EXISTS scores_rank;
CREATE INDEX IF NOT EXISTS scores_alltime ON scores (time_ms DESC, points DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS scores_by_initials ON scores (initials, time_ms DESC, points DESC, created_at ASC);
