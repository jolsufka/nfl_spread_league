#!/usr/bin/env python3
"""
Manual correction script for Week 4 results with proper ATS calculations
"""
import csv
import pandas as pd
from supabase import create_client
import os

# Supabase configuration
SUPABASE_URL = "https://kqygdqshcsozgxzgvpbr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxeWdkcXNoY3NvemdzendncGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU5MDA4ODYsImV4cCI6MjA0MTQ3Njg4Nn0.0wjJfPzHqh4PYjJgP8wF9uFhw8M8K3K7lILzlBXa-T8"

def main():
    # Initialize Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Load corrected results
    results_df = pd.read_csv('nfl_results_week4.csv')
    
    # Get all Week 4 picks from database
    picks_response = supabase.table('picks').select('*').eq('week', 4).execute()
    picks = picks_response.data
    
    print(f"Found {len(picks)} picks for Week 4")
    
    # Update each pick's correctness
    for pick in picks:
        user_id = pick['user_id']
        team = pick['team']
        spread = pick['spread']
        
        # Find the corresponding game result
        game_result = None
        
        # Check if team is away team
        away_match = results_df[results_df['away'] == team]
        if not away_match.empty:
            game_result = away_match.iloc[0]
            team_spread = game_result['away_spread']
            team_ats_result = game_result['away_ats_result']
        else:
            # Check if team is home team
            home_match = results_df[results_df['home'] == team]
            if not home_match.empty:
                game_result = home_match.iloc[0]
                team_spread = game_result['home_spread']
                team_ats_result = game_result['home_ats_result']
        
        if game_result is not None:
            # Determine if pick was correct
            is_correct = team_ats_result == 'W'
            
            # Update the pick in database
            update_response = supabase.table('picks').update({
                'correct': is_correct
            }).eq('user_id', user_id).eq('week', 4).eq('team', team).execute()
            
            print(f"Updated {user_id}: {team} {spread} -> {'✓' if is_correct else '✗'}")
        else:
            print(f"WARNING: Could not find game for {team}")
    
    print("\nWeek 4 corrections complete!")
    
    # Calculate final standings
    print("\n=== WEEK 4 FINAL STANDINGS ===")
    standings = {}
    
    for pick in picks:
        user_id = pick['user_id']
        correct = pick.get('correct')
        
        if user_id not in standings:
            standings[user_id] = {'total': 0, 'correct': 0}
        
        standings[user_id]['total'] += 1
        if correct:
            standings[user_id]['correct'] += 1
    
    # Sort by percentage
    sorted_standings = sorted(standings.items(), key=lambda x: x[1]['correct']/x[1]['total'] if x[1]['total'] > 0 else 0, reverse=True)
    
    for user_id, stats in sorted_standings:
        percentage = (stats['correct'] / stats['total'] * 100) if stats['total'] > 0 else 0
        print(f"{user_id}: {stats['correct']}/{stats['total']} ({percentage:.1f}%)")

if __name__ == "__main__":
    main()