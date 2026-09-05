# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

NFL spread league pick-em: React frontend on GitHub Pages, Python data pipeline, Supabase storage. **The weekly workflow is automated via GitHub Actions** — manual script runs are for overrides and debugging.

```
nfl_spread_league/
├── nfl-pickem/                 # React frontend
│   ├── src/App.tsx            # Main application component
│   ├── src/seasonConfig.ts    # Season config loader + week computation + calcRecord()
│   ├── public/season.json     # ★ SINGLE SOURCE OF TRUTH: season year, week-1 date, mode
│   ├── public/lines/          # Current season lines CSVs (served to app)
│   └── public/results/        # Current season results CSVs (served to app)
├── scripts/
│   ├── season.py             # Shared config/path/week helpers (reads season.json)
│   ├── script.py             # Fetch lines from The Odds API
│   ├── results_script.py     # Grade a week from ESPN scores (validation gates)
│   ├── supabase_integration.py # DB operations (service key for writes)
│   └── weather_script.py     # Weather forecasts for outdoor stadiums
├── .github/workflows/
│   ├── weekly-update.yml     # Tue 10am ET: grade last week, fetch lines, deploy
│   └── weather-refresh.yml   # Thu/Sat/Sun: weather refresh + deploy
├── supabase/migrations/       # SQL migrations (run in dashboard SQL editor)
├── data/                      # Current season pipeline outputs
│   ├── lines/ results/ picks/ pick_results/ weather/
│   └── archive/2025/          # Complete 2025 season (incl. full Supabase backup)
├── .keys/                     # Local API keys (gitignored; CI uses secrets)
└── requirements.txt
```

## Season Configuration (start here)

`nfl-pickem/public/season.json` drives everything: the app computes the current
week from `week1TuesdayEt` (no hand-edited `currentWeek`!), scripts derive their
week windows from it, and playoff rounds/files are defined in it. To advance to
playoffs: set `mode: "playoffs"` and `playoffRound: 100` (Wild Card) and deploy.

**Season rollover checklist** (each September):
1. Archive prior season: `git mv` the `data/{lines,results,picks,pick_results}` CSVs to `data/archive/<year>/`, purge `nfl-pickem/public/{lines,results}` of old-season files
2. Update `season.json`: season year, `week1TuesdayEt` (Tuesday before opener), `mode: "regular"`, `playoffRound: null`, title
3. Export prior season picks from Supabase to the archive (full-table backup)
4. First lines fetch: `python3 scripts/script.py`

## Common Commands

All scripts figure out the week/season from season.json — no arguments needed
for the normal flow. Run from anywhere (paths resolve from the repo root).

```bash
# Fetch current week's lines (writes data/lines/ AND nfl-pickem/public/lines/)
python3 scripts/script.py
#   --week N to override, --force to refetch existing lines (careful: users picked against them)

# Grade the week that just ended from ESPN scores (needs SUPABASE_SERVICE_KEY)
SUPABASE_SERVICE_KEY=... python3 scripts/results_script.py
#   --week N to override, --skip-supabase for CSV-only, --allow-partial mid-week

# Refresh weather for the current week's outdoor games
python3 scripts/weather_script.py

# React app
cd nfl-pickem
npm start           # Dev server on localhost:3000
npx tsc --noEmit    # Type check (there is no npm run lint/typecheck)
npm run build       # Production build
npm run deploy      # Manual deploy to GitHub Pages (Actions normally does this)
```

API keys: `ODDS_API_KEY` / `WEATHER_API_KEY` env vars, falling back to
`.keys/odds_api_key` / `.keys/weather_api_key` files. In GitHub Actions they are
repo secrets, along with `SUPABASE_SERVICE_KEY`.

## Automation (GitHub Actions)

- **weekly-update.yml** — Tuesdays 14:00 UTC: grades the completed week
  (ESPN scoreboard, week-addressable — no 3-day window), fetches the new week's
  lines, commits data, builds, deploys. Manual run: Actions tab → Run workflow
  (optional week input).
- **weather-refresh.yml** — Thu/Sat/Sun 14:00 UTC: weather + deploy if changed.
- Grading has **validation gates** that fail the job loudly (nonzero exit)
  instead of publishing bad data: unmatched games (exit 2), games not final
  (exit 3), ungraded picks (exit 4), Supabase update failure (exit 5).
  A red X on the Actions tab means DO NOT trust that run's outputs.

## Database (Supabase)

- **picks table**: `user_id, season, week, game_id, team, spread, correct, result, created_at`
  - `season` (int): all queries are season-scoped; 2025 history is preserved alongside 2026
  - `result` (text): `'W'`/`'L'`/`'P'` — `'P'` is a push; `NULL` means not graded yet.
    This replaces the old ambiguity where NULL meant push-or-pending.
  - `correct` (bool) kept in sync for compatibility (`NULL` for pushes)
- **RLS** (see `supabase/migrations/20260905_season_2026_foundation.sql`):
  the anon key (shipped in the browser bundle) can read everything but only
  insert/update/delete UNGRADED picks of the current era. Graded history is
  immutable to the public. **Grading writes require the service_role key**
  (env `SUPABASE_SERVICE_KEY`; never commit it, never ship it to the browser).
- Playoff pick encoding: `game_id` suffixes `-ou`, `-h1`, `-h1-ou`; props store
  `PROP:<selection>:<display>` in team. Decoded in `loadPicks` (App.tsx).

## CRITICAL: Push Handling Rule

- **Pushes (`result = 'P'`) count as picks made (denominator) but NOT as correct picks (numerator)**
- **2-0 with 1 push = 2/3 = 66.7%, not 100%**
- All percentages in the app go through `calcRecord()` in `src/seasonConfig.ts` — use it, never hand-roll
- Use the `spread-analysis` skill (`.claude/skills/spread-analysis/SKILL.md`) for ATS math

## Architecture Notes

- **App.tsx** (single file): `PickInterface`, playoff interfaces (incl. Super Bowl
  props/half-lines), `Leaderboard`, `PickChart`, `PickHistory`, `InsightsBeta`,
  `NFLTrends`, `CumulativeTrendChart`. Shared helpers (`getTeamLogo`,
  `getMascotName`) live at module scope; season helpers in `seasonConfig.ts`.
- Lines CSVs carry `id` (row order, matches app game ids) and `event_id`
  (The Odds API id). Results CSVs carry `game_id` matching lines `id`.
- User list is hardcoded in App.tsx (`users` state) AND CumulativeTrendChart's
  `userColors` — adding a league member means touching both.
- localStorage key `nfl-pickem-user` persists the selected user.
- Old one-off fix scripts live in `data/archive/2025/manual_fixes/` — they are
  historical, point at dead paths/projects, and must not be run.

## Claude Code Skills

- **spread-analysis**: ATS math and push rules — use for any grading questions
- **nfl-week-setup**: manual/override weekly setup flow
- **nfl-results-processor**: manual/override grading flow
- **nfl-deploy**: build + deploy with validation

## Important Instructions

- season.json is the only place the season/week calendar lives — never hardcode dates or week numbers in code or docs
- Scripts write to BOTH `data/` and `nfl-pickem/public/` — never hand-copy CSVs between them
- NEVER create files unless necessary; prefer editing existing files
- NEVER proactively create documentation files unless explicitly requested
