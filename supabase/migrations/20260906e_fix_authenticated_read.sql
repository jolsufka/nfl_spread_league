-- Hotfix: read policies were granted to anon only, so SIGNED-IN users
-- (role: authenticated) couldn't read picks at all — the app looked empty
-- exactly and only for logged-in members. Grant read to both roles.

DROP POLICY IF EXISTS picks_public_read ON picks;
CREATE POLICY picks_public_read ON picks
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS users_public_read ON users;
CREATE POLICY users_public_read ON users
  FOR SELECT TO anon, authenticated USING (true);
