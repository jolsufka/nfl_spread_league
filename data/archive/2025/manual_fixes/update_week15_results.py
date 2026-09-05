#!/usr/bin/env python3
"""Update Week 15 picks in Supabase with results from CSV file."""

import pandas as pd
from supabase import create_client

# Supabase configuration
SUPABASE_URL = "https://ruzznovsrwkxupdwafyy.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1enpub3ZzcndreHVwZHdhZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NjI1ODksImV4cCI6MjA3MjUzODU4OX0.FpOWJQcQ99JRwUUbpCOXlw0VSZ-lAoku2ipBb77mcRc"

def main():
    # Initialize Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    # Load results CSV
    results_df = pd.read_csv('data/results/nfl_results_week15.csv')

    # Get all picks for week 15
    response = supabase.table('picks').select('*').eq('week', 15).execute()
    picks = response.data

    if not picks:
        print("No picks found for Week 15")
        return

    print(f"Found {len(picks)} picks for Week 15")

    # Update each pick with result
    updates_made = 0
    for pick in picks:
        user_id = pick['user_id']
        team = pick['team']

        # Find this team in the results
        # Check both away and home columns
        away_match = results_df[results_df['away'] == team]
        home_match = results_df[results_df['home'] == team]

        covered = None
        if not away_match.empty:
            covered = bool(away_match.iloc[0]['away_covered'])
        elif not home_match.empty:
            covered = bool(home_match.iloc[0]['home_covered'])
        else:
            print(f"Warning: Could not find team '{team}' in results")
            continue

        # Update the pick in Supabase
        update_response = supabase.table('picks').update({
            'correct': covered
        }).eq('user_id', user_id).eq('week', 15).eq('team', team).execute()

        if update_response.data:
            result_str = "COVERED" if covered else "DID NOT COVER"
            print(f"Updated {user_id} - {team}: {result_str}")
            updates_made += 1
        else:
            print(f"Failed to update {user_id} - {team}")

    print(f"\nCompleted! Updated {updates_made} picks for Week 15")

if __name__ == "__main__":
    main()
