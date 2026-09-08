-- Push notification subscriptions (one row per device that opted in).
-- Saved through an RPC by signed-in claimed members; read/sent by the
-- reminder workflow with the service key.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auth_uid uuid NOT NULL,
  player_id text,
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- no anon/authenticated policies: all access via the RPC + service role

CREATE OR REPLACE FUNCTION save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_player text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'error: not signed in';
  END IF;
  SELECT player_id INTO v_player FROM members WHERE auth_uid = auth.uid();
  INSERT INTO push_subscriptions (auth_uid, player_id, endpoint, p256dh, auth)
  VALUES (auth.uid(), v_player, p_endpoint, p_p256dh, p_auth)
  ON CONFLICT (endpoint) DO UPDATE
    SET auth_uid = EXCLUDED.auth_uid,
        player_id = EXCLUDED.player_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION save_push_subscription(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION save_push_subscription(text, text, text) TO authenticated;
