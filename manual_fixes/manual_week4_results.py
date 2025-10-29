#!/usr/bin/env python3

import pandas as pd
from supabase_integration import update_pick_results

# Load the picks and results
picks_df = pd.read_csv("picks_week4.csv")
results_df = pd.read_csv("nfl_results_week4.csv")

# Team mapping to match picks with results (handles different naming conventions)
team_mapping = {
    "Atlanta Falcons": "Atlanta Falcons",
    "Los Angeles Rams": "Los Angeles Rams", 
    "Baltimore Ravens": "Baltimore Ravens",
    "Washington Commanders": "Washington Commanders",
    "Dallas Cowboys": "Dallas Cowboys",
    "Chicago Bears": "Chicago Bears", 
    "Los Angeles Chargers": "Los Angeles Chargers",
    "Las Vegas Raiders": "Las Vegas Raiders",
    "Tampa Bay Buccaneers": "Tampa Bay Buccaneers",
    "Philadelphia Eagles": "Philadelphia Eagles",
    "Miami Dolphins": "Miami Dolphins"
}

# Calculate pick results
pick_results = []

for _, pick in picks_df.iterrows():
    user = pick["user"]
    team = pick["team"]
    
    # Find the game this team played in
    game_result = None
    
    # Check if team was home or away
    home_games = results_df[results_df["home"] == team]
    away_games = results_df[results_df["away"] == team]
    
    if not home_games.empty:
        game_result = home_games.iloc[0]
        team_side = "home"
        team_ats_result = game_result["home_ats_result"]
    elif not away_games.empty:
        game_result = away_games.iloc[0]
        team_side = "away" 
        team_ats_result = game_result["away_ats_result"]
    else:
        print(f"Warning: No game found for {user}'s pick: {team}")
        continue
    
    # Determine if pick was correct
    correct = team_ats_result == "W"
    
    pick_results.append({
        "user": user,
        "team": team,
        "game": f"{game_result['away']} @ {game_result['home']}",
        "correct": correct,
        "ats_result": team_ats_result
    })
    
    print(f"{user}: {team} - {'✓' if correct else '✗'} ({team_ats_result})")

# Calculate user totals
user_totals = {}
for result in pick_results:
    user = result["user"]
    if user not in user_totals:
        user_totals[user] = {"correct": 0, "total": 0}
    user_totals[user]["total"] += 1
    if result["correct"]:
        user_totals[user]["correct"] += 1

print("\n=== WEEK 4 RESULTS ===")
for user, totals in user_totals.items():
    pct = totals["correct"] / totals["total"] * 100 if totals["total"] > 0 else 0
    print(f"{user}: {totals['correct']}/{totals['total']} ({pct:.1f}%)")

# Update Supabase with results
print("\nUpdating Supabase...")
results_df = pd.DataFrame([{
    "user": r["user"],
    "team": r["team"],
    "result": "W" if r["correct"] else "L"
} for r in pick_results])
update_pick_results(4, results_df)
print("✓ Supabase updated successfully")