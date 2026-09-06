-- Pick audit trail: every insert/update/delete on picks is logged with who
-- did it and when, via trigger — so it captures the RPC path, the legacy
-- week-1 path, and grading writes alike. The audit table is not readable
-- by the public key; the commissioner reads it in the SQL editor.

CREATE TABLE IF NOT EXISTS pick_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,          -- INSERT / UPDATE / DELETE
  actor text,                    -- claimed player, else role (anon/service_role)
  auth_uid uuid,
  user_id text,
  season integer,
  week integer,
  game_id text,
  team text,
  spread numeric,
  old_team text,
  old_spread numeric,
  result text
);
ALTER TABLE pick_audit ENABLE ROW LEVEL SECURITY;
-- no policies: invisible to anon/authenticated; service role + SQL editor only

CREATE OR REPLACE FUNCTION log_pick_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor text;
  v_uid uuid := auth.uid();
BEGIN
  SELECT player_id INTO v_actor FROM members WHERE auth_uid = v_uid;
  v_actor := coalesce(v_actor, auth.role(), 'unknown');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO pick_audit (action, actor, auth_uid, user_id, season, week, game_id, team, spread, result)
    VALUES ('INSERT', v_actor, v_uid, NEW.user_id, NEW.season, NEW.week, NEW.game_id, NEW.team, NEW.spread, NEW.result);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO pick_audit (action, actor, auth_uid, user_id, season, week, game_id, team, spread, old_team, old_spread, result)
    VALUES ('UPDATE', v_actor, v_uid, NEW.user_id, NEW.season, NEW.week, NEW.game_id, NEW.team, NEW.spread, OLD.team, OLD.spread, NEW.result);
    RETURN NEW;
  ELSE
    INSERT INTO pick_audit (action, actor, auth_uid, user_id, season, week, game_id, team, spread, result)
    VALUES ('DELETE', v_actor, v_uid, OLD.user_id, OLD.season, OLD.week, OLD.game_id, OLD.team, OLD.spread, OLD.result);
    RETURN OLD;
  END IF;
END $$;

DROP TRIGGER IF EXISTS picks_audit ON picks;
CREATE TRIGGER picks_audit
AFTER INSERT OR UPDATE OR DELETE ON picks
FOR EACH ROW EXECUTE FUNCTION log_pick_change();

-- Commissioner's view of the story per player/week, newest first:
-- SELECT at, action, actor, user_id, week, team, spread, old_team, old_spread
-- FROM pick_audit ORDER BY at DESC LIMIT 50;
