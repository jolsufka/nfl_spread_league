-- Season 2026 foundation migration
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query > paste > Run).
-- Safe to re-run: every statement is idempotent.

-- ============================================================
-- 1. Season dimension
--    All existing rows are the 2025 season; new rows default to 2026.
-- ============================================================
ALTER TABLE picks ADD COLUMN IF NOT EXISTS season integer;
UPDATE picks SET season = 2025 WHERE season IS NULL;
ALTER TABLE picks ALTER COLUMN season SET NOT NULL;
ALTER TABLE picks ALTER COLUMN season SET DEFAULT 2026;

CREATE INDEX IF NOT EXISTS picks_season_week_idx ON picks (season, week);

-- ============================================================
-- 2. Explicit result column: W / L / P (push), NULL = not graded yet.
--    Removes the "NULL means push OR pending" ambiguity.
--    2025 grading is complete, so every 2025 NULL is a push by definition.
-- ============================================================
ALTER TABLE picks ADD COLUMN IF NOT EXISTS result text;
ALTER TABLE picks DROP CONSTRAINT IF EXISTS picks_result_check;
ALTER TABLE picks ADD CONSTRAINT picks_result_check CHECK (result IN ('W','L','P') OR result IS NULL);
UPDATE picks
SET result = CASE
  WHEN correct IS TRUE  THEN 'W'
  WHEN correct IS FALSE THEN 'L'
  ELSE 'P'
END
WHERE season = 2025 AND result IS NULL;

-- ============================================================
-- 3. Row Level Security lockdown
--    Before: FOR ALL TO anon USING (true)  -- anyone could edit/delete everything
--    After:  anon may read everything, and may only create/modify/remove
--            UNGRADED picks in the current era. Graded history is immutable
--            to the public key. Grading happens with the service-role key
--            (bypasses RLS), never shipped to browsers.
-- ============================================================
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on picks" ON picks;
DROP POLICY IF EXISTS "picks_public_read" ON picks;
DROP POLICY IF EXISTS "picks_anon_insert_ungraded" ON picks;
DROP POLICY IF EXISTS "picks_anon_update_ungraded" ON picks;
DROP POLICY IF EXISTS "picks_anon_delete_ungraded" ON picks;

CREATE POLICY "picks_public_read" ON picks
  FOR SELECT TO anon USING (true);

CREATE POLICY "picks_anon_insert_ungraded" ON picks
  FOR INSERT TO anon
  WITH CHECK (correct IS NULL AND result IS NULL AND season >= 2026);

CREATE POLICY "picks_anon_update_ungraded" ON picks
  FOR UPDATE TO anon
  USING (correct IS NULL AND result IS NULL AND season >= 2026)
  WITH CHECK (correct IS NULL AND result IS NULL AND season >= 2026);

CREATE POLICY "picks_anon_delete_ungraded" ON picks
  FOR DELETE TO anon
  USING (correct IS NULL AND result IS NULL AND season >= 2026);

-- users table: public read only; changes require service role
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations on users" ON users;
DROP POLICY IF EXISTS "users_public_read" ON users;
CREATE POLICY "users_public_read" ON users
  FOR SELECT TO anon USING (true);

-- ============================================================
-- Verification (run after; expect: 517 rows season 2025, 0 with NULL result)
-- ============================================================
-- SELECT season, count(*) FROM picks GROUP BY season;
-- SELECT count(*) FROM picks WHERE season = 2025 AND result IS NULL;
