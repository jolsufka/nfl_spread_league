#!/usr/bin/env python3
"""Grade a completed NFL week: fetch final scores, compute ATS results,
grade every pick, and write results to Supabase and the app's data files.

Scores come from ESPN's scoreboard API, which is addressable by season +
week — unlike The Odds API's 3-day window, a late run can never lose games.

Exit codes: 0 success; 2 bad inputs; 3 games not final; 4 ungraded picks;
5 Supabase update failed. Any nonzero exit means DO NOT trust the outputs.
"""
import argparse
import sys
import time

import pandas as pd
import requests

from season import (
    load_season_config,
    current_week,
    lines_csv_paths,
    results_csv_paths,
    PICKS_DIR,
    PICK_RESULTS_DIR,
)
from supabase_integration import (
    extract_picks_for_week,
    save_picks_to_csv,
    update_pick_results,
    get_leaderboard,
)

ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"


def fetch_espn_week(week: int, year: int, seasontype: int = 2, retries: int = 3) -> list:
    """All events for a season week. seasontype 2 = regular season, 3 = postseason."""
    params = {"seasontype": seasontype, "week": week, "dates": year}
    for attempt in range(retries):
        try:
            r = requests.get(ESPN_SCOREBOARD, params=params, timeout=30)
            r.raise_for_status()
            return r.json().get("events", [])
        except requests.RequestException as e:
            if attempt == retries - 1:
                raise
            wait = 5 * (attempt + 1)
            print(f"ESPN fetch failed ({e}); retrying in {wait}s")
            time.sleep(wait)
    return []


def espn_scores(events: list) -> pd.DataFrame:
    rows = []
    for event in events:
        comp = event["competitions"][0]
        by_side = {c["homeAway"]: c for c in comp["competitors"]}
        rows.append({
            "home": by_side["home"]["team"]["displayName"],
            "away": by_side["away"]["team"]["displayName"],
            "home_score": int(by_side["home"].get("score") or 0),
            "away_score": int(by_side["away"].get("score") or 0),
            "completed": bool(event["status"]["type"]["completed"]),
        })
    return pd.DataFrame(rows)


def mascot(team: str) -> str:
    return team.split()[-1].lower()


def load_lines(week: int) -> pd.DataFrame:
    lines_path, _ = lines_csv_paths(week)
    if not lines_path.exists():
        sys.exit(f"Lines file not found: {lines_path} (exit 2)")
    df = pd.read_csv(lines_path)
    # The app assigns game ids by row order (1..N); make that explicit
    if "id" not in df.columns:
        df["id"] = [str(i + 1) for i in range(len(df))]
    df["id"] = df["id"].astype(str)
    return df


def calculate_ats(lines_df: pd.DataFrame, scores_df: pd.DataFrame):
    """Join lines to final scores and compute ATS results (spread-analysis rules).

    Returns (results_df, unmatched, not_final) — both lists must be empty
    for the grading to be trustworthy.
    """
    results, unmatched, not_final = [], [], []

    for _, line in lines_df.iterrows():
        match = scores_df[
            (scores_df["home"] == line["home"]) & (scores_df["away"] == line["away"])
        ]
        if match.empty:  # team-name drift fallback: match both mascots
            match = scores_df[
                scores_df["home"].map(mascot).eq(mascot(line["home"]))
                & scores_df["away"].map(mascot).eq(mascot(line["away"]))
            ]
        if match.empty:
            unmatched.append(f"{line['away']} @ {line['home']}")
            continue

        score = match.iloc[0]
        if not score["completed"]:
            not_final.append(f"{line['away']} @ {line['home']}")
            continue

        actual_margin = score["home_score"] - score["away_score"]
        home_spread = line["spread_home"] if pd.notna(line["spread_home"]) else 0
        away_spread = line["spread_away"] if pd.notna(line["spread_away"]) else 0

        # Home covers if actual_margin + home_spread > 0; equal is a push
        home_ats_margin = actual_margin + home_spread
        if home_ats_margin > 0:
            home_ats, away_ats = "W", "L"
        elif home_ats_margin < 0:
            home_ats, away_ats = "L", "W"
        else:
            home_ats = away_ats = "P"

        total_line = line["total"] if pd.notna(line.get("total")) else None
        actual_total = score["home_score"] + score["away_score"]
        if total_line is None:
            over_under = ""
        elif actual_total > total_line:
            over_under = "OVER"
        elif actual_total < total_line:
            over_under = "UNDER"
        else:
            over_under = "PUSH"

        results.append({
            "game_id": line["id"],
            "kickoff_et": line["kickoff_et"],
            "away": line["away"],
            "home": line["home"],
            "away_score": score["away_score"],
            "home_score": score["home_score"],
            "actual_margin": actual_margin,
            "home_spread": home_spread,
            "away_spread": away_spread,
            "home_ats_margin": home_ats_margin,
            "home_ats_result": home_ats,
            "away_ats_result": away_ats,
            "total": total_line,
            "actual_total": actual_total,
            "over_under": over_under,
        })

    return pd.DataFrame(results), unmatched, not_final


def grade_picks(picks_df: pd.DataFrame, results_df: pd.DataFrame) -> pd.DataFrame:
    """Grade each pick against the results. Joins on game_id, falls back to
    team name. Understands spread picks and O/U picks ('-ou' game_id suffix)."""
    graded = []
    by_game_id = {str(r["game_id"]): r for _, r in results_df.iterrows()}

    for _, pick in picks_df.iterrows():
        game_id = str(pick["game_id"])
        team = pick["team"]
        result = None

        if game_id.endswith("-ou") or team.startswith("O/U:"):
            game = by_game_id.get(game_id.replace("-ou", ""))
            if game is not None and game["over_under"]:
                selection = team.replace("O/U:", "").strip().upper()
                if game["over_under"] == "PUSH":
                    result = "P"
                else:
                    result = "W" if game["over_under"] == selection else "L"
        else:
            game = by_game_id.get(game_id)
            if game is None:  # legacy picks: match by team name
                match = results_df[(results_df["home"] == team) | (results_df["away"] == team)]
                game = match.iloc[0] if not match.empty else None
            if game is not None:
                side = "home_ats_result" if game["home"] == team else "away_ats_result"
                result = game[side]

        graded.append({
            "user": pick["user_id"],
            "game_id": pick["game_id"],
            "team": team,
            "result": result,
            "game_date": str(game["kickoff_et"])[:10] if game is not None else "",
        })

    return pd.DataFrame(graded)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    config = load_season_config()
    ap.add_argument("--week", type=int, default=None,
                    help="Week to grade (default: the week that just ended)")
    ap.add_argument("--season", type=int, default=config["season"])
    ap.add_argument("--allow-partial", action="store_true",
                    help="Grade even if some games aren't final (in-week refresh)")
    ap.add_argument("--skip-supabase", action="store_true",
                    help="Compute CSVs only; don't write grades to Supabase")
    args = ap.parse_args()

    # Default: grade the week BEFORE the current one (Tuesday runs grade last week)
    week = args.week if args.week is not None else max(1, current_week(config) - 1)
    print(f"Grading season {args.season}, week {week}")

    lines_df = load_lines(week)
    events = fetch_espn_week(week, args.season)
    if not events:
        sys.exit(f"ESPN returned no events for {args.season} week {week} (exit 2)")
    scores_df = espn_scores(events)

    results_df, unmatched, not_final = calculate_ats(lines_df, scores_df)

    # ---- Validation gates ----
    if unmatched:
        print("GATE FAILED - lines rows with no ESPN match:")
        for game in unmatched:
            print(f"  {game}")
        sys.exit(2)
    if not_final and not args.allow_partial:
        print("GATE FAILED - games not final yet (rerun later or --allow-partial):")
        for game in not_final:
            print(f"  {game}")
        sys.exit(3)

    bad_rows = results_df[
        (results_df["home_ats_result"] == "P") != (results_df["away_ats_result"] == "P")
    ]
    if len(bad_rows):
        print("GATE FAILED - inconsistent ATS results:")
        print(bad_rows.to_string(index=False))
        sys.exit(2)

    # ---- Write results CSVs (archive + deployed copy, same bytes) ----
    results_path, public_results_path = results_csv_paths(week)
    for path in (results_path, public_results_path):
        path.parent.mkdir(parents=True, exist_ok=True)
        results_df.to_csv(path, index=False)
    print(f"\nResults written: {results_path} and {public_results_path}")
    print(results_df[["away", "home", "away_score", "home_score",
                      "home_ats_result", "away_ats_result", "over_under"]].to_string(index=False))

    # ---- Grade picks ----
    picks_df = extract_picks_for_week(week, args.season)
    if picks_df.empty:
        print(f"No picks for season {args.season} week {week}; done.")
        return

    save_picks_to_csv(picks_df, week, str(PICKS_DIR / f"picks_week{week}.csv"), args.season)
    pick_results_df = grade_picks(picks_df, results_df)

    ungraded = pick_results_df[pick_results_df["result"].isna()]
    if len(ungraded) and not args.allow_partial:
        print("GATE FAILED - picks that could not be graded:")
        print(ungraded.to_string(index=False))
        sys.exit(4)

    graded_df = pick_results_df[pick_results_df["result"].notna()]
    PICK_RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    pick_results_path = PICK_RESULTS_DIR / f"pick_results_week{week}.csv"
    pick_results_df.to_csv(pick_results_path, index=False)
    print(f"\nPick results written: {pick_results_path}")

    print("\nPer-user records this week:")
    for user, group in graded_df.groupby("user"):
        wins = (group["result"] == "W").sum()
        losses = (group["result"] == "L").sum()
        pushes = (group["result"] == "P").sum()
        print(f"  {user}: {wins}-{losses}" + (f"-{pushes} (P)" if pushes else ""))

    # ---- Write grades to Supabase ----
    if args.skip_supabase:
        print("\n--skip-supabase: not writing grades to the database")
        return
    if not update_pick_results(week, graded_df, args.season):
        sys.exit(5)

    print("\nSeason leaderboard:")
    print(get_leaderboard(args.season).to_string(index=False))


if __name__ == "__main__":
    main()
