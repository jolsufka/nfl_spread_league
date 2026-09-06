-- Email auth + write-path hardening (part 2 of 2)
-- APPLY AFTER WEEK 1 LOCKS (Tue Sep 15 is a good time).
-- Removes the legacy anonymous write path: from here on, the ONLY way to
-- write picks is save_my_picks() as a signed-in, claimed member (or the
-- service role, which the grading pipeline uses).

DROP POLICY IF EXISTS picks_anon_insert_ungraded ON picks;
DROP POLICY IF EXISTS picks_anon_update_ungraded ON picks;
DROP POLICY IF EXISTS picks_anon_delete_ungraded ON picks;

-- (picks_public_read stays: standings/charts read anonymously.)
