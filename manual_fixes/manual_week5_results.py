#!/usr/bin/env python3
import pandas as pd
import sys
import os
from supabase_integration import get_supabase_client, extract_picks_for_week

def process_manual_results():
    """Process manual Week 5 results and update Supabase."""
    
    # Read our manual results
    results_df = pd.read_csv('nfl_results_week5.csv')
    
    # Get picks from Supabase for Week 5
    picks_df = extract_picks_for_week(5)
    
    if picks_df.empty:
        print("No picks found for Week 5")
        return
    
    print(f"Found {len(picks_df)} picks for Week 5")
    
    # Initialize supabase client
    supabase = get_supabase_client()
    
    # Process each pick and determine if it was correct
    updates_made = 0
    
    for _, pick in picks_df.iterrows():
        user_id = pick['user_id']
        team = pick['team']
        game_id = pick['game_id']
        
        # Find the corresponding game result
        game_result = None
        
        # Try to match by team name in both away and home columns
        away_match = results_df[results_df['away'].str.contains(team, case=False, na=False)]
        home_match = results_df[results_df['home'].str.contains(team, case=False, na=False)]
        
        if not away_match.empty:
            game_result = away_match.iloc[0]
            team_is_away = True
        elif not home_match.empty:
            game_result = home_match.iloc[0]
            team_is_away = False
        else:
            print(f"Warning: Could not find game for team {team}")
            continue
        
        # Determine if the pick was correct based on ATS result
        if team_is_away:
            correct = game_result['away_covered']
        else:
            correct = game_result['home_covered']
        
        # Update the pick in Supabase
        try:
            response = supabase.table('picks').update({
                'correct': bool(correct)
            }).eq('user_id', user_id).eq('week', 5).eq('team', team).execute()
            
            if response.data:
                print(f"Updated {user_id} - {team}: {'WIN' if correct else 'LOSS'}")
                updates_made += 1
            else:
                print(f"Warning: Could not update pick for {user_id} - {team}")
                
        except Exception as e:
            print(f"Error updating pick for {user_id} - {team}: {e}")
    
    print(f"\nProcessing complete. Made {updates_made} updates to Supabase.")

if __name__ == "__main__":
    process_manual_results()