# supabase_integration.py
import os
import pandas as pd
from supabase import create_client, Client
from typing import Optional, Dict

# Supabase configuration.
# The URL and anon key are public (they ship in the browser bundle); the
# service key is NOT and must come from the environment. Grading requires it:
# RLS blocks the anon key from touching graded rows or writing results.
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://ruzznovsrwkxupdwafyy.supabase.co")
SUPABASE_ANON_KEY = os.environ.get(
    "SUPABASE_ANON_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1enpub3ZzcndreHVwZHdhZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NjI1ODksImV4cCI6MjA3MjUzODU4OX0.FpOWJQcQ99JRwUUbpCOXlw0VSZ-lAoku2ipBb77mcRc",
)
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

DEFAULT_SEASON = 2026


def get_supabase_client(write: bool = False) -> Client:
    """Return a Supabase client. write=True requires SUPABASE_SERVICE_KEY."""
    if write:
        if not SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "SUPABASE_SERVICE_KEY is not set. Grading writes are blocked by RLS "
                "for the anon key. Get the service_role key from the Supabase dashboard "
                "(Project Settings > API) and export SUPABASE_SERVICE_KEY."
            )
        return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def extract_picks_for_week(week: int, season: int = DEFAULT_SEASON) -> pd.DataFrame:
    """Extract all picks for a week of the given season. Raises on query failure."""
    supabase = get_supabase_client()
    response = (
        supabase.table("picks")
        .select("*")
        .eq("season", season)
        .eq("week", week)
        .execute()
    )
    if not response.data:
        print(f"No picks found for season {season}, week {week}")
        return pd.DataFrame()

    picks_df = pd.DataFrame(response.data)
    for col in ["user_id", "week", "season", "game_id", "team", "spread", "correct", "result"]:
        if col not in picks_df.columns:
            picks_df[col] = None
    return picks_df


def save_picks_to_csv(picks_df: pd.DataFrame, week: int, output_file: Optional[str] = None,
                      season: int = DEFAULT_SEASON) -> str:
    """Save picks to CSV with the full schema (no placeholder columns)."""
    if output_file is None:
        output_file = f"data/picks/picks_week{week}.csv"

    if picks_df.empty:
        print(f"No picks to save for week {week}")
        return output_file

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    columns = ["user_id", "season", "week", "game_id", "team", "spread", "correct", "result"]
    picks_df[columns].to_csv(output_file, index=False)
    print(f"Saved {len(picks_df)} picks to {output_file}")
    return output_file


def update_pick_results(week: int, pick_results_df: pd.DataFrame,
                        season: int = DEFAULT_SEASON) -> bool:
    """Write graded results (W/L/P) to Supabase using the service key.

    pick_results_df needs columns: user, team, result — and ideally game_id,
    which makes the match exact. Returns False if any pick failed to update.
    """
    supabase = get_supabase_client(write=True)
    failures = 0

    for _, row in pick_results_df.iterrows():
        result = row["result"]
        if result not in ("W", "L", "P"):
            print(f"Warning: unknown result '{result}' for {row['user']} - {row['team']}")
            failures += 1
            continue

        correct_value = {"W": True, "L": False, "P": None}[result]
        query = (
            supabase.table("picks")
            .update({"correct": correct_value, "result": result})
            .eq("season", season)
            .eq("user_id", row["user"])
            .eq("week", week)
        )
        if "game_id" in row.index and pd.notna(row.get("game_id")):
            query = query.eq("game_id", row["game_id"])
        else:
            query = query.eq("team", row["team"])

        response = query.execute()
        if not response.data:
            print(f"FAILED to update: {row['user']} - {row['team']} (no matching row)")
            failures += 1

    if failures:
        print(f"{failures} pick(s) failed to update for season {season}, week {week}")
        return False
    print(f"Successfully updated pick results in Supabase for season {season}, week {week}")
    return True


def calculate_user_stats(user_id: str, season: int = DEFAULT_SEASON) -> Dict:
    """Overall stats for a user. Pushes count in the denominator, not the numerator."""
    supabase = get_supabase_client()
    response = (
        supabase.table("picks").select("*").eq("season", season).eq("user_id", user_id).execute()
    )
    if not response.data:
        return {"total_picks": 0, "correct_picks": 0, "percentage": 0}

    picks = response.data
    total_picks = len(picks)
    correct_picks = sum(1 for pick in picks if pick.get("correct") is True)
    percentage = round((correct_picks / total_picks * 100), 1) if total_picks else 0
    return {"total_picks": total_picks, "correct_picks": correct_picks, "percentage": percentage}


def get_leaderboard(season: int = DEFAULT_SEASON) -> pd.DataFrame:
    """Leaderboard for a season. Pushes count in the denominator, not the numerator."""
    supabase = get_supabase_client()
    response = supabase.table("picks").select("*").eq("season", season).execute()
    if not response.data:
        return pd.DataFrame(columns=["user", "total_picks", "correct_picks", "percentage"])

    picks_df = pd.DataFrame(response.data)
    user_stats = []
    for user_id in picks_df["user_id"].unique():
        user_picks = picks_df[picks_df["user_id"] == user_id]
        total_picks = len(user_picks)
        correct_picks = len(user_picks[user_picks["correct"] == True])  # noqa: E712
        percentage = round((correct_picks / total_picks * 100), 1) if total_picks else 0
        user_stats.append({
            "user": user_id,
            "total_picks": total_picks,
            "correct_picks": correct_picks,
            "percentage": percentage,
        })

    leaderboard_df = pd.DataFrame(user_stats)
    return leaderboard_df.sort_values(["percentage", "correct_picks"], ascending=[False, False])


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Supabase integration for NFL pick-em league")
    parser.add_argument("--week", type=int, required=True, help="Week number")
    parser.add_argument("--season", type=int, default=DEFAULT_SEASON, help="Season year")
    parser.add_argument("--action", choices=["extract", "leaderboard"], default="extract")
    parser.add_argument("--output", help="Output CSV file (default: picks_week{N}.csv)")
    args = parser.parse_args()

    if args.action == "extract":
        picks_df = extract_picks_for_week(args.week, args.season)
        if not picks_df.empty:
            output_file = save_picks_to_csv(picks_df, args.week, args.output, args.season)
            print(f"Picks extracted and saved to {output_file}")
            print(f"\nPick Summary for Week {args.week}:")
            print(picks_df.groupby("user_id").size().to_string())
    elif args.action == "leaderboard":
        leaderboard_df = get_leaderboard(args.season)
        if not leaderboard_df.empty:
            print("Current Leaderboard:")
            print(leaderboard_df.to_string(index=False))
        else:
            print("No picks data found")


if __name__ == "__main__":
    main()
