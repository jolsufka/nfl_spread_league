#!/usr/bin/env python3
"""
Manual Week 7 Results Processing
Processes the manually provided game results and calculates ATS outcomes.
"""

import pandas as pd
from supabase_integration import extract_picks_for_week, update_pick_results, get_leaderboard

# Manual game results data
manual_results = [
    # Game, Winning Team, Winner Score, Losing Team, Loser Score
    ("Steelers @ Bengals", "Bengals", 33, "Steelers", 31),
    ("Rams vs Jaguars (London)", "Rams", 35, "Jaguars", 7),
    ("Saints @ Bears", "Bears", 26, "Saints", 14),
    ("Dolphins @ Browns", "Browns", 31, "Dolphins", 6),
    ("Patriots @ Titans", "Patriots", 31, "Titans", 13),
    ("Raiders @ Chiefs", "Chiefs", 31, "Raiders", 0),
    ("Eagles @ Vikings", "Eagles", 28, "Vikings", 22),
    ("Panthers @ Jets", "Panthers", 13, "Jets", 6),
    ("Giants @ Broncos", "Broncos", 33, "Giants", 32),
    ("Colts @ Chargers", "Colts", 38, "Chargers", 24),
    ("Commanders @ Cowboys", "Cowboys", 44, "Commanders", 22),
    ("Packers @ Cardinals", "Packers", 27, "Cardinals", 23),
    ("Falcons @ 49ers", "49ers", 20, "Falcons", 10),
    ("Texans @ Seahawks", "Seahawks", 27, "Texans", 19),
    ("Buccaneers @ Lions", "Lions", 24, "Buccaneers", 9),
]

def parse_game_matchup(game_str, winner, winner_score, loser, loser_score):
    """Parse game string to determine home/away teams and scores."""
    
    # Handle special cases
    if "London" in game_str:
        # Rams vs Jaguars (London) - treat as neutral site, use @ format
        if "Rams" in game_str:
            away, home = "Los Angeles Rams", "Jacksonville Jaguars"
        else:
            away, home = game_str.split(" vs ")[0], game_str.split(" vs ")[1].replace(" (London)", "")
    elif "@" in game_str:
        # Standard away @ home format
        away, home = game_str.split(" @ ")
    elif "vs" in game_str:
        # Handle other vs cases
        away, home = game_str.split(" vs ")
    else:
        raise ValueError(f"Cannot parse game format: {game_str}")
    
    # Determine scores based on winner/loser
    if winner == away or (away.endswith(winner) or winner.endswith(away.split()[-1])):
        away_score, home_score = winner_score, loser_score
    else:
        away_score, home_score = loser_score, winner_score
    
    return away.strip(), home.strip(), away_score, home_score

def calculate_ats_with_manual_results():
    """Calculate ATS results using manual game results and CSV odds."""
    
    # Load odds data
    try:
        odds_df = pd.read_csv('/Users/jacob/nfl_spread_league/nfl-pickem/public/nfl_lines_week7.csv')
    except FileNotFoundError:
        print("Error: Could not find nfl_lines_week7.csv")
        return None
    
    print("=== MANUAL WEEK 7 RESULTS & ATS ANALYSIS ===\n")
    
    ats_results = []
    
    for game_str, winner, winner_score, loser, loser_score in manual_results:
        try:
            away, home, away_score, home_score = parse_game_matchup(
                game_str, winner, winner_score, loser, loser_score
            )
            
            print(f"{away} {away_score} @ {home} {home_score}")
            
            # Find matching game in odds data
            # Try different team name variations
            possible_away_names = [away, away.replace("Los Angeles ", "").replace("New York ", "").replace("New England ", "")]
            possible_home_names = [home, home.replace("Los Angeles ", "").replace("New York ", "").replace("New England ", "")]
            
            match_found = False
            for away_name in possible_away_names:
                for home_name in possible_home_names:
                    matches = odds_df[
                        (odds_df["home"].str.contains(home_name.split()[-1], case=False, na=False)) & 
                        (odds_df["away"].str.contains(away_name.split()[-1], case=False, na=False))
                    ]
                    
                    if not matches.empty:
                        match_found = True
                        odds = matches.iloc[0]
                        break
                if match_found:
                    break
            
            if not match_found:
                print(f"  WARNING: No odds found for {away} @ {home}")
                continue
            
            # Get spreads from CSV
            home_spread = odds["spread_home"] if pd.notna(odds["spread_home"]) else 0
            away_spread = odds["spread_away"] if pd.notna(odds["spread_away"]) else 0
            
            # Calculate actual margin (positive = home win, negative = away win)
            actual_margin = home_score - away_score
            
            # Calculate ATS results
            # Home team covers if: actual_margin + home_spread > 0
            home_ats_margin = actual_margin + home_spread
            
            if home_ats_margin > 0:
                home_ats = "W"
                away_ats = "L"
            elif home_ats_margin < 0:
                home_ats = "L"
                away_ats = "W"
            else:
                home_ats = "P"  # Push
                away_ats = "P"
            
            print(f"  Spread: {odds['home']} {home_spread:+.1f}")
            print(f"  ATS: {odds['home']} {home_ats}, {odds['away']} {away_ats}")
            
            # Handle totals if available
            total_result = ""
            if pd.notna(odds["total"]):
                actual_total = away_score + home_score
                if actual_total > odds["total"]:
                    total_result = f"Over {odds['total']:.1f}"
                elif actual_total < odds["total"]:
                    total_result = f"Under {odds['total']:.1f}"
                else:
                    total_result = f"Push {odds['total']:.1f}"
                print(f"  Total: {actual_total} ({total_result})")
            
            print()
            
            # Store results
            ats_results.append({
                "away": odds["away"],
                "home": odds["home"],
                "away_score": away_score,
                "home_score": home_score,
                "away_ats_result": away_ats,
                "home_ats_result": home_ats,
                "home_spread": home_spread,
                "away_spread": away_spread
            })
            
        except Exception as e:
            print(f"Error processing {game_str}: {e}")
            continue
    
    return pd.DataFrame(ats_results)

def evaluate_picks_against_results(ats_results_df):
    """Evaluate user picks against the calculated ATS results."""
    
    # Get picks from Supabase
    picks_df = extract_picks_for_week(7)
    if picks_df.empty:
        print("No picks found for week 7")
        return None
    
    print("=== EVALUATING PICKS ===\n")
    print(f"Picks DataFrame columns: {picks_df.columns.tolist()}")
    print(f"Sample picks data:\n{picks_df.head()}")
    
    user_results = []
    
    for _, pick in picks_df.iterrows():
        # Check which column contains user info
        if 'user' in pick:
            user = pick["user"]
        elif 'user_id' in pick:
            user = pick["user_id"]
        else:
            print(f"Available columns: {pick.index.tolist()}")
            continue
            
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
            "result": ats_result
        })
        
        print(f"{user}: {team} vs {game['away'] if game['home'] == team else game['home']} = {ats_result}")
    
    return pd.DataFrame(user_results)

def main():
    """Main function to process manual results."""
    
    # Calculate ATS results
    ats_results = calculate_ats_with_manual_results()
    if ats_results is None:
        return
    
    # Evaluate picks
    user_results = evaluate_picks_against_results(ats_results)
    if user_results is None:
        return
    
    # Show pick summary
    print("\n=== PICK RESULTS SUMMARY ===")
    for user in user_results["user"].unique():
        user_picks = user_results[user_results["user"] == user]
        wins = len(user_picks[user_picks["result"] == "W"])
        losses = len(user_picks[user_picks["result"] == "L"])
        pushes = len(user_picks[user_picks["result"] == "P"])
        print(f"{user}: {wins}-{losses}-{pushes}")
    
    # Update Supabase
    print("\n=== UPDATING SUPABASE ===")
    if update_pick_results(7, user_results):
        print("✓ Successfully updated Supabase with Week 7 results")
        
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
    
    # Save results for reference
    ats_results.to_csv('manual_week7_ats_results.csv', index=False)
    user_results.to_csv('manual_week7_pick_results.csv', index=False)
    print(f"\nResults saved to manual_week7_ats_results.csv and manual_week7_pick_results.csv")

if __name__ == "__main__":
    main()