#!/usr/bin/env python3

import pandas as pd
import sys
import os

# Add the scripts directory to the path to import supabase_integration
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'scripts'))
from supabase_integration import update_pick_results, get_leaderboard

def evaluate_picks_from_results():
    """Evaluate picks using existing results CSV file"""
    
    # Read the results file that already has Lions vs Cowboys added
    results_df = pd.read_csv('data/results/nfl_results_week14.csv')
    picks_df = pd.read_csv('data/picks/picks_week14.csv')
    
    print(f"Found {len(results_df)} completed games in results file")
    print(f"Found {len(picks_df)} picks to evaluate")
    
    user_results = []
    
    for _, pick in picks_df.iterrows():
        user = pick["user"]
        team = pick["team"]
        
        # Find the game result for this team
        team_games = results_df[
            (results_df["home"] == team) | (results_df["away"] == team)
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
            "game_date": pd.to_datetime(game["kickoff_et"]).strftime("%Y-%m-%d")
        })
        
        print(f"{user} picked {team}: {ats_result}")
    
    if not user_results:
        print("No pick results to process")
        return
    
    results_df_final = pd.DataFrame(user_results)
    
    # Show results summary
    print("\n=== PICK RESULTS ===")
    for user in results_df_final["user"].unique():
        user_picks = results_df_final[results_df_final["user"] == user]
        wins = len(user_picks[user_picks["result"] == "W"])
        losses = len(user_picks[user_picks["result"] == "L"])
        pushes = len(user_picks[user_picks["result"] == "P"])
        print(f"{user}: {wins}-{losses}-{pushes}")
    
    # Save pick results
    picks_results_csv = "data/pick_results/pick_results_week14.csv"
    results_df_final.to_csv(picks_results_csv, index=False)
    print(f"\nPick results saved to: {picks_results_csv}")
    
    # Update Supabase
    print("\nUpdating Supabase with pick results...")
    if update_pick_results(14, results_df_final):
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
    evaluate_picks_from_results()