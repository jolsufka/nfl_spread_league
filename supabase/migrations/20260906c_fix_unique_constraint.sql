-- Hotfix: the legacy unique constraint (user_id, week, game_id) predates the
-- season column, so 2026 picks collide with a player's own 2025 picks in the
-- same week/game slot. Rebuild it season-aware.

ALTER TABLE picks DROP CONSTRAINT IF EXISTS picks_user_id_week_game_id_key;
ALTER TABLE picks ADD CONSTRAINT picks_user_season_week_game_key
  UNIQUE (user_id, season, week, game_id);
