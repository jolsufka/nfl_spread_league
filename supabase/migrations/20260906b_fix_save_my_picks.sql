-- Hotfix: save_my_picks failed with 'column reference "pick" is ambiguous' -
-- the plpgsql variable `pick` collided with the INSERT..SELECT alias.
-- Paste and run in the SQL editor (replaces the function in place).

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

  -- alias renamed to elem: the variable `pick` made `pick ->> ...` ambiguous here
  INSERT INTO picks (user_id, season, week, game_id, team, spread)
  SELECT v_player, p_season, p_week,
         elem ->> 'game_id', elem ->> 'team', (elem ->> 'spread')::numeric
  FROM jsonb_array_elements(p_picks) AS elem;

  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION save_my_picks(integer, integer, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION save_my_picks(integer, integer, jsonb) TO authenticated;
