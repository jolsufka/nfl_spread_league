# nfl_week_results.py
import os, sys, argparse, datetime as dt, pytz, requests, pandas as pd
from supabase_integration import extract_picks_for_week, save_picks_to_csv, update_pick_results, get_leaderboard

SPORT = "americanfootball_nfl"
ODDS_FORMAT = "american"

def iso_z(dt_aware):
    """Convert timezone-aware datetime to UTC ISO format."""
    return dt_aware.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def week_window_from_weeknum(week1_start_et_str: str, week: int):
    """Calculate week window from week 1 start and week number."""
    tz = pytz.timezone("America/New_York")
    w1 = tz.localize(dt.datetime.strptime(week1_start_et_str, "%Y-%m-%d %H:%M"))
    start = w1 + dt.timedelta(days=7*(week-1))
    end = start + dt.timedelta(days=7, seconds=-1)
    return start, end

def fetch_scores(api_key: str, days_from: int = 3):
    """Fetch completed game scores from The Odds API."""
    url = f"https://api.the-odds-api.com/v4/sports/{SPORT}/scores"
    params = {
        "apiKey": api_key,
        "daysFrom": days_from,
        "dateFormat": "iso"
    }
    r = requests.get(url, params=params, timeout=25)
    r.raise_for_status()
    return r.json()

def parse_game_results(scores_data):
    """Parse scores data into a structured DataFrame."""
    games = []
    tz = pytz.timezone("America/New_York")
    
    for game in scores_data:
        if not game.get("completed", False):
            continue  # Skip incomplete games
            
        scores = game.get("scores", [])
        if len(scores) != 2:
            continue  # Need exactly 2 team scores
            
        # Find home and away scores
        home_score = None
        away_score = None
        
        for score in scores:
            if score["name"] == game["home_team"]:
                home_score = score["score"]
            elif score["name"] == game["away_team"]:
                away_score = score["score"]
        
        if home_score is None or away_score is None:
            continue
            
        # Convert commence time to ET
        commence_utc = dt.datetime.fromisoformat(game["commence_time"].replace('Z', '+00:00'))
        kickoff_et = commence_utc.astimezone(tz)
        
        games.append({
            "game_id": game["id"],
            "kickoff_et": kickoff_et,
            "home": game["home_team"],
            "away": game["away_team"],
            "home_score": int(home_score),
            "away_score": int(away_score),
            "completed": True
        })
    
    return pd.DataFrame(games)

def calculate_ats_results(results_df, odds_csv):
    """Calculate ATS results by merging results with original odds."""
    if not os.path.exists(odds_csv):
        print(f"Error: Odds file {odds_csv} not found")
        return None
    
    odds_df = pd.read_csv(odds_csv)
    odds_df["kickoff_et"] = pd.to_datetime(odds_df["kickoff_et"])

    # Merge on team names and approximate kickoff time (within 1 hour)
    merged_games = []

    for _, result in results_df.iterrows():
        # Find matching game in odds data (match on teams only for simplicity)
        matches = odds_df[
            (odds_df["home"] == result["home"]) &
            (odds_df["away"] == result["away"])
        ]
        
        if matches.empty:
            print(f"Warning: No odds found for {result['away']} @ {result['home']}")
            continue
            
        odds = matches.iloc[0]
        
        # Calculate actual margin (positive = home win, negative = away win)
        actual_margin = result["home_score"] - result["away_score"]
        
        # Get spreads (home spread should be negative for favorites)
        home_spread = odds["spread_home"] if pd.notna(odds["spread_home"]) else 0
        away_spread = odds["spread_away"] if pd.notna(odds["spread_away"]) else 0
        
        # Calculate ATS results
        # Home team covers if: actual_margin + home_spread > 0
        # Away team covers if: actual_margin + home_spread < 0
        # Push if: actual_margin + home_spread == 0
        
        home_ats_margin = actual_margin + home_spread
        away_ats_margin = -actual_margin + away_spread
        
        if home_ats_margin > 0:
            home_ats_result = "W"
            away_ats_result = "L"
        elif home_ats_margin < 0:
            home_ats_result = "L"
            away_ats_result = "W"
        else:
            home_ats_result = "P"  # Push
            away_ats_result = "P"
        
        merged_games.append({
            "kickoff_et": result["kickoff_et"],
            "away": result["away"],
            "home": result["home"],
            "away_score": result["away_score"],
            "home_score": result["home_score"],
            "actual_margin": actual_margin,
            "home_spread": home_spread,
            "away_spread": away_spread,
            "home_ats_margin": home_ats_margin,
            "home_ats_result": home_ats_result,
            "away_ats_result": away_ats_result,
            "total": odds["total"] if pd.notna(odds["total"]) else None,
            "actual_total": result["home_score"] + result["away_score"],
            "over_under": "Over" if pd.notna(odds["total"]) and (result["home_score"] + result["away_score"]) > odds["total"] 
                         else "Under" if pd.notna(odds["total"]) and (result["home_score"] + result["away_score"]) < odds["total"]
                         else "Push" if pd.notna(odds["total"]) else None
        })
    
    return pd.DataFrame(merged_games)

def evaluate_picks(ats_results_df, picks_csv):
    """Evaluate user picks against ATS results."""
    if not os.path.exists(picks_csv):
        print(f"Warning: Picks file {picks_csv} not found. Create this file with your picks.")
        return None
    
    picks_df = pd.read_csv(picks_csv)
    
    # Expected picks format:
    # user,team,game_date
    # John,Bills,2024-09-08
    # John,Chiefs,2024-09-09
    
    user_results = []
    
    for _, pick in picks_df.iterrows():
        user = pick["user"]
        team = pick["team"]
        
        # Find the game result for this team
        team_games = ats_results_df[
            (ats_results_df["home"] == team) | (ats_results_df["away"] == team)
        ]
        
        if team_games.empty:
            print(f"Warning: No result found for {user}'s pick: {team}")
            continue
        
        game = team_games.iloc[0]
        
        # Determine if this team covered the spread
        if game["home"] == team:
            ats_result = game["home_ats_result"]
        else:
            ats_result = game["away_ats_result"]
        
        user_results.append({
            "user": user,
            "team": team,
            "opponent": game["away"] if game["home"] == team else game["home"],
            "result": ats_result,
            "game_date": game["kickoff_et"].strftime("%Y-%m-%d")
        })
    
    return pd.DataFrame(user_results)

def main():
    ap = argparse.ArgumentParser(description="Fetch NFL game results and evaluate ATS picks.")
    ap.add_argument("--api-key", default=os.getenv("ODDS_API_KEY"),
                    help="The Odds API key (or set ODDS_API_KEY).")
    ap.add_argument("--week1-start-et", default="2024-09-02 08:00",
                    help='NFL Week 1 start ET (e.g., "2024-09-02 08:00")')
    ap.add_argument("--week", type=int, required=True,
                    help="NFL week number to get results for")
    ap.add_argument("--odds-csv", 
                    help="Path to the original odds CSV file (if not specified, uses nfl_lines_week{N}.csv)")
    ap.add_argument("--picks-csv", 
                    help="Path to picks CSV file (if not specified, extracts from Supabase)")
    ap.add_argument("--use-supabase", action="store_true", default=True,
                    help="Extract picks from Supabase (default: True)")
    ap.add_argument("--update-supabase", action="store_true", default=True,
                    help="Update pick results back to Supabase (default: True)")
    ap.add_argument("--results-csv", 
                    help="Output path for results CSV (if not specified, uses nfl_results_week{N}.csv)")
    ap.add_argument("--days-from", type=int, default=3,
                    help="Number of past days to fetch completed games (1-3)")
    
    args = ap.parse_args()
    
    if not args.api_key:
        sys.exit("Missing API key. Use --api-key or set ODDS_API_KEY.")
    
    # Auto-generate filenames if not provided
    if not args.odds_csv:
        args.odds_csv = f"data/lines/nfl_lines_week{args.week}.csv"
    if not args.results_csv:
        args.results_csv = f"data/results/nfl_results_week{args.week}.csv"
    
    print(f"Fetching results for Week {args.week}...")
    print(f"Using odds file: {args.odds_csv}")
    
    # Handle picks: either from Supabase or CSV file
    if args.use_supabase and not args.picks_csv:
        print("Extracting picks from Supabase...")
        picks_df = extract_picks_for_week(args.week)
        if not picks_df.empty:
            args.picks_csv = save_picks_to_csv(picks_df, args.week)
            print(f"Picks extracted to: {args.picks_csv}")
        else:
            print("No picks found in Supabase for this week")
            return
    elif not args.picks_csv:
        args.picks_csv = f"data/picks/picks_week{args.week}.csv"
    
    print(f"Using picks file: {args.picks_csv}")
    
    # Fetch game scores
    scores_data = fetch_scores(args.api_key, args.days_from)
    results_df = parse_game_results(scores_data)
    
    if results_df.empty:
        print("No completed games found in the specified time window.")
        return
    
    print(f"Found {len(results_df)} completed games")
    
    # Calculate ATS results
    ats_results = calculate_ats_results(results_df, args.odds_csv)
    
    if ats_results is None or ats_results.empty:
        print("Could not calculate ATS results.")
        return
    
    # Display results
    print("\n=== GAME RESULTS & ATS ===")
    for _, game in ats_results.iterrows():
        print(f"{game['away']} {game['away_score']} @ {game['home']} {game['home_score']}")
        print(f"  Spread: {game['home']} {game['home_spread']:+.1f}")
        print(f"  ATS: {game['home']} {game['home_ats_result']}, {game['away']} {game['away_ats_result']}")
        if game['over_under']:
            print(f"  Total: {game['actual_total']:.0f} ({game['over_under']} {game['total']:.1f})")
        print()
    
    # Save results
    ats_results.to_csv(args.results_csv, index=False)
    print(f"Results saved to: {args.results_csv}")
    
    # Evaluate picks if provided
    if args.picks_csv:
        user_results = evaluate_picks(ats_results, args.picks_csv)
        if user_results is not None:
            print("\n=== PICK RESULTS ===")
            for user in user_results["user"].unique():
                user_picks = user_results[user_results["user"] == user]
                wins = len(user_picks[user_picks["result"] == "W"])
                losses = len(user_picks[user_picks["result"] == "L"])
                pushes = len(user_picks[user_picks["result"] == "P"])
                print(f"{user}: {wins}-{losses}-{pushes}")
                
                for _, pick in user_picks.iterrows():
                    print(f"  {pick['team']} vs {pick['opponent']}: {pick['result']}")
            
            # Save pick results
            picks_results_csv = f"data/pick_results/pick_results_week{args.week}.csv"
            user_results.to_csv(picks_results_csv, index=False)
            print(f"Pick results saved to: {picks_results_csv}")
            
            # Update Supabase with results if enabled
            if args.update_supabase:
                print("\nUpdating Supabase with pick results...")
                if update_pick_results(args.week, user_results):
                    print("✓ Supabase updated successfully")
                    
                    # Show updated leaderboard
                    print("\n=== UPDATED LEADERBOARD ===")
                    leaderboard = get_leaderboard()
                    if not leaderboard.empty:
                        for _, row in leaderboard.iterrows():
                            print(f"{row['user']}: {row['correct_picks']}/{row['total_picks']} ({row['percentage']}%)")
                    else:
                        print("Could not retrieve leaderboard")
                else:
                    print("✗ Failed to update Supabase")

if __name__ == "__main__":
    main()