#!/usr/bin/env python3
"""
Final Week 13 pick update with correct push handling
Pushes count as picks made but are neither wins nor losses for percentage calculations
"""

import pandas as pd
import os
import sys
from supabase import create_client, Client

# Supabase configuration
SUPABASE_URL = "https://ruzznovsrwkxupdwafyy.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1enpub3ZzcndreHVwZHdhZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NjI1ODksImV4cCI6MjA3MjUzODU4OX0.FpOWJQcQ99JRwUUbpCOXlw0VSZ-lAoku2ipBb77mcRc"

def get_supabase_client() -> Client:
    """Initialize and return Supabase client."""
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def update_week13_final():
    """Final update of Week 13 picks with correct push handling"""
    
    # Load results data
    results_file = "data/results/nfl_results_week13.csv"
    if not os.path.exists(results_file):
        print(f"Results file not found: {results_file}")
        return
    
    results_df = pd.read_csv(results_file)
    print(f"Loaded {len(results_df)} game results")
    
    # Get Supabase client
    supabase = get_supabase_client()
    
    # Get all Week 13 picks from Supabase
    try:
        picks_response = supabase.table("picks").select("*").eq("week", 13).execute()
        picks = picks_response.data
        print(f"Found {len(picks)} picks for Week 13")
    except Exception as e:
        print(f"Error fetching picks: {e}")
        return
    
    # Process each pick
    updates = []
    for pick in picks:
        user_id = pick['user_id']
        team = pick['team']
        game_id = pick['game_id']
        
        # Find the corresponding game result
        game_result = None
        for _, row in results_df.iterrows():
            if team in [row['away'], row['home']]:
                game_result = row
                break
        
        if game_result is None:
            print(f"Warning: No result found for {user_id}'s pick: {team}")
            continue
        
        # Determine if the pick was correct, handling pushes
        if team == game_result['away']:
            ats_result = game_result['away_ats_result']
        else:  # team == game_result['home']
            ats_result = game_result['home_ats_result']
        
        # Map ATS result to correct field
        if ats_result == 'W':
            correct = True
        elif ats_result == 'L':
            correct = False
        elif ats_result == 'P':  # Push - not counted as win or loss
            correct = None
        else:
            print(f"Unknown ATS result: {ats_result}")
            continue
        
        # Update the pick in Supabase
        try:
            update_data = {"correct": correct}
            result = supabase.table("picks").update(update_data).eq("user_id", user_id).eq("week", 13).eq("game_id", game_id).execute()
            
            result_str = 'W' if correct == True else 'L' if correct == False else 'P'
            print(f"Updated {user_id} - {team}: {result_str}")
            updates.append({
                'user': user_id,
                'team': team,
                'correct': correct
            })
        except Exception as e:
            print(f"Error updating {user_id} - {team}: {e}")
    
    print(f"\nSuccessfully updated {len(updates)} picks")
    
    # Generate summary - pushes count toward total picks but not win/loss record
    user_results = {}
    for update in updates:
        user = update['user']
        if user not in user_results:
            user_results[user] = {'correct': 0, 'incorrect': 0, 'pushes': 0, 'total_picks': 0}
        
        user_results[user]['total_picks'] += 1
        
        if update['correct'] == True:
            user_results[user]['correct'] += 1
        elif update['correct'] == False:
            user_results[user]['incorrect'] += 1
        else:  # Push
            user_results[user]['pushes'] += 1
    
    print("\nWeek 13 Final Results:")
    for user, results in sorted(user_results.items()):
        win_loss_total = results['correct'] + results['incorrect']  # Pushes don't count for percentage
        pct = (results['correct'] / win_loss_total * 100) if win_loss_total > 0 else 0
        
        picks_str = f"{results['total_picks']} picks"
        record_str = f"{results['correct']}-{results['incorrect']}"
        if results['pushes'] > 0:
            record_str += f"-{results['pushes']}"
            
        print(f"{user}: {record_str} ({picks_str}, {pct:.1f}%)")

if __name__ == "__main__":
    update_week13_final()