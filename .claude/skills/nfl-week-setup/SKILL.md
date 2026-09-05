---
name: nfl-week-setup
description: Automates the complete weekly setup process for NFL spread league including fetching odds, organizing files, and deploying the app
allowed-tools: ["Bash", "Read", "Write", "Edit", "LS"]
---

# NFL Week Setup Automation

This skill covers weekly setup for the NFL spread league application.

## Automation Does This For You

`.github/workflows/weekly-update.yml` runs every Tuesday at 10am ET: it grades last week, fetches the new week's lines, commits the data, and deploys to GitHub Pages. This skill is for manual runs and overrides (workflow failure, refetching lines, off-schedule setup). Trigger the workflow by hand with `gh workflow run weekly-update.yml`.

## What This Skill Does

1. **Fetches NFL Odds**: `scripts/script.py` pulls spreads, totals, and moneylines from The Odds API for the current week
2. **Writes Both Copies**: the script writes to `data/lines/` AND `nfl-pickem/public/lines/` directly — there is no cp step
3. **Deploys**: `npm run deploy` for manual runs (scheduled runs deploy via Actions)

There is nothing to edit in App.tsx: the app computes the current week from the date using `nfl-pickem/public/season.json`.

## Prerequisites

- The Odds API key in the `ODDS_API_KEY` env var or `.keys/odds_api_key` (the old root `.api_key` file no longer exists)
- `nfl-pickem/public/season.json` configured for the season

## Usage Examples

User says any of:
- "Set up this week" / "Set up Week X"
- "Get this week's odds and deploy"
- "Refetch the lines"

## Workflow Steps

### 1. Fetch Odds Data
```bash
python3 scripts/script.py
```
- No arguments needed: the week is computed from today's date + `season.json`
- Writes `data/lines/nfl_lines_weekN.csv` and `nfl-pickem/public/lines/nfl_lines_weekN.csv`
- Refuses to overwrite an existing lines file (users picked against those spreads); `--force` to refetch anyway
- `--week N` overrides the week; `--skip-if-exists` exits 0 quietly (for scheduled runs)

### 2. Deploy (manual runs only)
```bash
cd nfl-pickem && npm run deploy
```

### 3. Verify
- Live site shows the new week's games at https://jolsufka.github.io/nfl_spread_league

## New-Season Setup

Edit `nfl-pickem/public/season.json` — the single source of truth read by both the Python scripts and the React app:
- `season`: e.g. 2026
- `week1TuesdayEt`: the Tuesday that opens Week 1's pick window (e.g. "2026-09-08")
- `mode` / `playoffRound`: "regular" during the season; playoff settings for the postseason
- `playoffRounds`: round names and lines filenames

No code changes are needed for a new season.

## Error Handling

- **No API key**: set `ODDS_API_KEY` or create `.keys/odds_api_key`
- **"Refusing to overwrite existing lines"**: week already fetched; only use `--force` if nobody has picked yet
- **"No games/odds between ..."**: check `season.json` dates — wrong week or wrong season
- **Deployment fails**: check npm dependencies and build errors

## Success Criteria

- Lines CSV present in both `data/lines/` and `nfl-pickem/public/lines/`
- Deployed site shows the new week's games (the app switches weeks automatically)

## Important Notes

- Season timing lives in `season.json` — never hardcode dates or week numbers
- Validate that the previous week's results are processed before setting up a new week
- Users typically need the new week available by Tuesday morning
