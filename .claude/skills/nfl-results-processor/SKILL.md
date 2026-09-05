---
name: nfl-results-processor
description: Processes completed NFL games, updates pick accuracy in Supabase, and generates results files
allowed-tools: ["Bash", "Read", "Write", "Edit", "LS"]
---

# NFL Results Processing Automation

This skill grades a completed NFL week: final scores, ATS outcomes, pick grades, database updates, and results files.

## Automation Does This For You

`.github/workflows/weekly-update.yml` (Tuesdays 10am ET) grades the week that just ended before fetching new lines and deploying. This skill is for manual runs, regrades, or workflow failures. Trigger by hand with `gh workflow run weekly-update.yml` (accepts an optional `week` input).

## What This Skill Does

1. **Fetches Final Scores**: from ESPN's scoreboard API, addressable by season + week — running late never loses games (the old Odds API 3-day window limitation is gone)
2. **Computes ATS Results**: spread and over/under outcomes per game (use the spread-analysis skill for the rules)
3. **Grades Picks**: writes W/L/P to the `result` column in Supabase; the `correct` boolean is kept for compatibility
4. **Writes Files**: results CSVs to `data/results/` AND `nfl-pickem/public/results/` automatically — no cp step

There is no currentWeek bump afterward: the app derives the week from the date via `nfl-pickem/public/season.json`.

## Prerequisites

- **`SUPABASE_SERVICE_KEY` env var — required for grading.** RLS blocks the anon key from writing grades. Get the service_role key from the Supabase dashboard (Project Settings > API); it must never ship to browsers.
- Lines file for the week in `data/lines/` (no odds API key needed — ESPN scores are free)
- Picks in Supabase for the week

## Usage

```bash
SUPABASE_SERVICE_KEY=... python3 scripts/results_script.py
```
- Default: grades the week that just ended (correct for a Tuesday run)
- `--week N`: grade a specific week (late regrades are fine — ESPN is week-addressable)
- `--season YYYY`: override the season from season.json
- `--allow-partial`: grade even if some games aren't final (in-week refresh)
- `--skip-supabase`: compute CSVs only, no database writes (no service key needed)

User says any of: "Process Week X results", "Grade this week's picks", "Week X games are done, process results".

## Validation Gates

The script refuses to produce silently-wrong output. Exit codes:

| Exit | Meaning |
|------|---------|
| 0 | Success |
| 2 | Bad inputs: missing lines file, no ESPN events, lines rows with no ESPN match, or inconsistent ATS results |
| 3 | Games not final yet — rerun later, or use `--allow-partial` |
| 4 | Picks that could not be graded |
| 5 | Supabase update failed |

Any nonzero exit means DO NOT trust the outputs.

## Output Files

- `data/results/nfl_results_weekN.csv` and `nfl-pickem/public/results/nfl_results_weekN.csv` (same bytes)
- `data/picks/picks_weekN.csv`: picks exported from Supabase
- `data/pick_results/pick_results_weekN.csv`: per-pick grades

## Push Handling

- Pushes are stored explicitly as `'P'` in the `result` column; a NULL `result` means ungraded, not push
- Pushes count as picks made (denominator) but not as wins (numerator): 2-0 with 1 push = 2/3 = 66.7%

## Common Scenarios

### Monday Night Football not finished
The default run exits 3 and grades nothing. Either wait, or use `--allow-partial` to grade completed games and rerun after MNF.

### Postponed games
`--allow-partial` grades the available games; rerun once the postponed game completes.

### Tie games / exact spread margins
Pushes — graded automatically as `'P'`.
