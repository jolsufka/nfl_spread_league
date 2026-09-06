-- Email auth + write-path hardening (part 1 of 2)
-- Run in the Supabase SQL editor. Safe to re-run.
-- Part 2 (20260906_lockdown_after_week1.sql) revokes legacy anon writes —
-- apply it AFTER Week 1 locks so unclaimed members aren't blocked mid-week.

-- ============================================================
-- 1. games: server-side source of truth for kickoffs and current lines.
--    Written by the pipeline (service role) on every fetch/refresh.
-- ============================================================
CREATE TABLE IF NOT EXISTS games (
  season integer NOT NULL,
  week integer NOT NULL,
  id text NOT NULL,          -- matches lines CSV id / picks.game_id base
  event_id text,
  away text,
  home text,
  kickoff timestamptz NOT NULL,
  spread_away numeric,
  spread_home numeric,
  total numeric,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (season, week, id)
);
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS games_public_read ON games;
CREATE POLICY games_public_read ON games FOR SELECT TO anon, authenticated USING (true);

INSERT INTO games (season, week, id, event_id, away, home, kickoff, spread_away, spread_home, total) VALUES
  (2026, 1, '1', '8c94552d022acec4a0458d70c19d3da9', 'New England Patriots', 'Seattle Seahawks', '2026-09-09T20:20:00-04:00', 3.5, -3.5, 44.5),
  (2026, 1, '2', 'acc580d74344ea3b31bbcdd057fe6a9c', 'San Francisco 49ers', 'Los Angeles Rams', '2026-09-10T20:35:00-04:00', 3.5, -3.5, 48.5),
  (2026, 1, '3', '95c01d1bb797d6df14824b106c5a9130', 'Atlanta Falcons', 'Pittsburgh Steelers', '2026-09-13T13:00:00-04:00', 3.5, -3.5, 42.5),
  (2026, 1, '4', 'b6cfdcbafa61ce220ba87dc2d9b80c77', 'Baltimore Ravens', 'Indianapolis Colts', '2026-09-13T13:00:00-04:00', -3.5, 3.5, 48.5),
  (2026, 1, '5', '7e09efed7e12c659b82740b67ce2f9a1', 'Buffalo Bills', 'Houston Texans', '2026-09-13T13:00:00-04:00', -1.5, 1.5, 44.5),
  (2026, 1, '6', 'fc362aff0d889ec52d358307a70c32ed', 'Chicago Bears', 'Carolina Panthers', '2026-09-13T13:00:00-04:00', -2.5, 2.5, 47.5),
  (2026, 1, '7', 'ed6d24ff979f9c71979fead577b0b3f7', 'Tampa Bay Buccaneers', 'Cincinnati Bengals', '2026-09-13T13:00:00-04:00', 3.5, -3.5, 50.5),
  (2026, 1, '8', 'e55c6fe19fce094ce214c8b0e5b504e9', 'Cleveland Browns', 'Jacksonville Jaguars', '2026-09-13T13:00:00-04:00', 7.5, -7.5, 40.5),
  (2026, 1, '9', 'c1d3fcec25aaeb06ebd2244d33d338e0', 'New Orleans Saints', 'Detroit Lions', '2026-09-13T13:00:00-04:00', 7.0, -7.0, 49.5),
  (2026, 1, '10', '7dddb296a42e7a41a774b24bd1709ce1', 'New York Jets', 'Tennessee Titans', '2026-09-13T13:00:00-04:00', 1.5, -1.5, 39.5),
  (2026, 1, '11', '1edfa5ceaa1ad2cb57df1c1b908731f6', 'Arizona Cardinals', 'Los Angeles Chargers', '2026-09-13T16:25:00-04:00', 10.5, -10.5, 46.5),
  (2026, 1, '12', 'cb77efed7e711d25a72c1a2a0a1af119', 'Green Bay Packers', 'Minnesota Vikings', '2026-09-13T16:25:00-04:00', 1.5, -1.5, 46.5),
  (2026, 1, '13', 'c5d95f48a16849ab6bebc68fbbfcb74a', 'Miami Dolphins', 'Las Vegas Raiders', '2026-09-13T16:25:00-04:00', 3.5, -3.5, 40.5),
  (2026, 1, '14', '17885cb8dcade8f6c3bce14b2de805e8', 'Washington Commanders', 'Philadelphia Eagles', '2026-09-13T16:25:00-04:00', 5.5, -5.5, 44.5),
  (2026, 1, '15', '3e646c7479c57f5d9752d8c7dfe7059b', 'Dallas Cowboys', 'New York Giants', '2026-09-13T20:20:00-04:00', -2.5, 2.5, 48.5),
  (2026, 1, '16', '5ad8135dc2b5f27de0b777acd317855a', 'Denver Broncos', 'Kansas City Chiefs', '2026-09-14T20:15:00-04:00', 3.0, -3.0, 42.5)
ON CONFLICT (season, week, id) DO UPDATE SET
  spread_away = EXCLUDED.spread_away, spread_home = EXCLUDED.spread_home,
  total = EXCLUDED.total, kickoff = EXCLUDED.kickoff;

-- ============================================================
-- 2. members: auth identity -> league player, claimed on first login.
--    First come, first claimed; re-claims are rejected. Fix mistakes by
--    NULLing auth_uid for a row here in the SQL editor.
-- ============================================================
CREATE TABLE IF NOT EXISTS members (
  player_id text PRIMARY KEY,
  auth_uid uuid UNIQUE,
  email text,
  claimed_at timestamptz
);
INSERT INTO members (player_id) VALUES
  ('jacob'), ('cam'), ('connor'), ('nathan'), ('shane'), ('max'), ('john')
ON CONFLICT DO NOTHING;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS members_public_read ON members;
CREATE POLICY members_public_read ON members FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION claim_player(p_player_id text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN 'error: not signed in';
  END IF;
  IF EXISTS (SELECT 1 FROM members WHERE auth_uid = uid) THEN
    RETURN 'error: you already claimed a player';
  END IF;
  UPDATE members
  SET auth_uid = uid, email = auth.jwt() ->> 'email', claimed_at = now()
  WHERE player_id = p_player_id AND auth_uid IS NULL;
  IF NOT FOUND THEN
    RETURN 'error: that player is already claimed';
  END IF;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION claim_player(text) FROM public;
GRANT EXECUTE ON FUNCTION claim_player(text) TO authenticated;

-- ============================================================
-- 3. save_my_picks: the hardened write path. Checks, in one atomic call:
--    - caller is signed in and has claimed a player (identity)
--    - every pick's game exists and hasn't kicked off (server-side lock)
--    - every submitted line matches the current published line +/- 1.5
--      (no fabricated numbers; tolerance covers a refresh landing between
--      page load and save)
--    - no duplicate games; locked existing picks are kept; total <= 3
-- ============================================================
CREATE OR REPLACE FUNCTION save_my_picks(p_season integer, p_week integer, p_picks jsonb)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_player text;
  pick jsonb;
  v_game games%ROWTYPE;
  v_gid text;
  v_team text;
  v_spread numeric;
  v_line numeric;
  v_base text;
  v_locked_count integer;
  v_seen text[] := '{}';
BEGIN
  SELECT player_id INTO v_player FROM members WHERE auth_uid = auth.uid();
  IF v_player IS NULL THEN
    RETURN 'error: sign in and claim your name first';
  END IF;
  IF p_picks IS NULL OR jsonb_typeof(p_picks) <> 'array' THEN
    RETURN 'error: bad payload';
  END IF;

  FOR pick IN SELECT * FROM jsonb_array_elements(p_picks) LOOP
    v_gid := pick ->> 'game_id';
    v_team := pick ->> 'team';
    v_spread := (pick ->> 'spread')::numeric;
    v_base := regexp_replace(v_gid, '-(ou|h1|h1-ou)$', '');

    IF v_base = ANY (v_seen) THEN
      RETURN 'error: duplicate game ' || v_base;
    END IF;
    v_seen := v_seen || v_base;

    SELECT * INTO v_game FROM games
    WHERE season = p_season AND week = p_week AND id = v_base;
    IF NOT FOUND THEN
      RETURN 'error: unknown game ' || v_gid;
    END IF;
    IF now() >= v_game.kickoff THEN
      RETURN 'error: ' || v_game.away || ' @ ' || v_game.home || ' is locked';
    END IF;

    IF v_gid LIKE '%-ou' THEN
      IF v_game.total IS NULL OR abs(v_spread - v_game.total) > 1.5 THEN
        RETURN 'error: stale total on ' || v_gid || ' - refresh and repick';
      END IF;
    ELSE
      IF v_team = v_game.home THEN v_line := v_game.spread_home;
      ELSIF v_team = v_game.away THEN v_line := v_game.spread_away;
      ELSE RETURN 'error: ' || v_team || ' is not in game ' || v_gid;
      END IF;
      IF v_line IS NULL OR abs(v_spread - v_line) > 1.5 THEN
        RETURN 'error: stale line on ' || v_team || ' - refresh and repick';
      END IF;
    END IF;
  END LOOP;

  -- keep picks whose games already kicked off; replace the rest
  SELECT count(*) INTO v_locked_count FROM picks p
  WHERE p.season = p_season AND p.week = p_week AND p.user_id = v_player
    AND EXISTS (
      SELECT 1 FROM games g
      WHERE g.season = p_season AND g.week = p_week
        AND g.id = regexp_replace(p.game_id, '-(ou|h1|h1-ou)$', '')
        AND now() >= g.kickoff
    );
  IF v_locked_count + jsonb_array_length(p_picks) > 3 THEN
    RETURN 'error: too many picks (' || v_locked_count || ' already locked)';
  END IF;

  DELETE FROM picks p
  WHERE p.season = p_season AND p.week = p_week AND p.user_id = v_player
    AND NOT EXISTS (
      SELECT 1 FROM games g
      WHERE g.season = p_season AND g.week = p_week
        AND g.id = regexp_replace(p.game_id, '-(ou|h1|h1-ou)$', '')
        AND now() >= g.kickoff
    );

  INSERT INTO picks (user_id, season, week, game_id, team, spread)
  SELECT v_player, p_season, p_week,
         elem ->> 'game_id', elem ->> 'team', (elem ->> 'spread')::numeric
  FROM jsonb_array_elements(p_picks) AS elem;

  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION save_my_picks(integer, integer, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION save_my_picks(integer, integer, jsonb) TO authenticated;
