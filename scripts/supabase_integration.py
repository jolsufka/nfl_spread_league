# supabase_integration.py
import os
import sys
import pandas as pd
from supabase import create_client, Client
from typing import Optional, Dict, List

# Supabase configuration
SUPABASE_URL = "https://ruzznovsrwkxupdwafyy.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1enpub3ZzcndreHVwZHdhZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NjI1ODksImV4cCI6MjA3MjUzODU4OX0.FpOWJQcQ99JRwUUbpCOXlw0VSZ-lAoku2ipBb77mcRc"

def get_supabase_client() -> Client:
    """Initialize and return Supabase client."""
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def extract_picks_for_week(week: int) -> pd.DataFrame:
    """Extract all picks from Supabase for a specific week."""
    supabase = get_supabase_client()
    
    try:
        # Fetch picks for the specified week
        response = supabase.table('picks').select('*').eq('week', week).execute()
        
        if not response.data:
            print(f"No picks found for week {week}")
            return pd.DataFrame()
        
        # Convert to DataFrame
        picks_df = pd.DataFrame(response.data)
        
        # Ensure we have the expected columns
        expected_columns = ['user_id', 'week', 'game_id', 'team', 'spread', 'correct']
        for col in expected_columns:
            if col not in picks_df.columns:
                picks_df[col] = None
        
        return picks_df
        
    except Exception as e:
        print(f"Error extracting picks from Supabase: {e}")
        return pd.DataFrame()

def save_picks_to_csv(picks_df: pd.DataFrame, week: int, output_file: Optional[str] = None) -> str:
    """Save picks DataFrame to CSV in the expected format."""
    if output_file is None:
        output_file = f"data/picks/picks_week{week}.csv"
    
    if picks_df.empty:
        print(f"No picks to save for week {week}")
        return output_file
    
    # Convert to the format expected by results_script.py
    # Expected format: user,team,game_date
    # We'll need to map game_id to game_date from the odds file
    
    csv_picks = picks_df[['user_id', 'team']].copy()
    csv_picks.columns = ['user', 'team']
    
    # Add a placeholder game_date - this will be matched by team name in results_script.py
    csv_picks['game_date'] = f"2024-09-{week:02d}"  # Placeholder date
    
    csv_picks.to_csv(output_file, index=False)
    print(f"Saved {len(csv_picks)} picks to {output_file}")
    
    return output_file

def update_pick_results(week: int, pick_results_df: pd.DataFrame) -> bool:
    """Update Supabase with pick results (Win/Loss/Push)."""
    supabase = get_supabase_client()
    
    try:
        for _, result in pick_results_df.iterrows():
            # Convert result to boolean or None
            correct_value = None
            if result['result'] == 'W':
                correct_value = True
            elif result['result'] == 'L':
                correct_value = False
            # Leave as None for Push
            
            # Update the pick in Supabase
            response = supabase.table('picks').update({
                'correct': correct_value
            }).eq('user_id', result['user']).eq('week', week).eq('team', result['team']).execute()
            
            if not response.data:
                print(f"Warning: Could not update pick for {result['user']} - {result['team']}")
        
        print(f"Successfully updated pick results in Supabase for week {week}")
        return True
        
    except Exception as e:
        print(f"Error updating pick results in Supabase: {e}")
        return False

def calculate_user_stats(user_id: str) -> Dict:
    """Calculate overall stats for a user across all weeks."""
    supabase = get_supabase_client()
    
    try:
        # Get all picks for this user
        response = supabase.table('picks').select('*').eq('user_id', user_id).execute()
        
        if not response.data:
            return {"total_picks": 0, "correct_picks": 0, "percentage": 0}
        
        picks = response.data
        total_picks = len(picks)
        correct_picks = sum(1 for pick in picks if pick.get('correct') is True)
        percentage = round((correct_picks / total_picks * 100), 1) if total_picks > 0 else 0
        
        return {
            "total_picks": total_picks,
            "correct_picks": correct_picks,
            "percentage": percentage
        }
        
    except Exception as e:
        print(f"Error calculating stats for {user_id}: {e}")
        return {"total_picks": 0, "correct_picks": 0, "percentage": 0}

def get_leaderboard() -> pd.DataFrame:
    """Get current leaderboard with all user stats."""
    supabase = get_supabase_client()
    
    try:
        # Get all picks to calculate stats
        response = supabase.table('picks').select('*').execute()
        
        if not response.data:
            return pd.DataFrame(columns=['user', 'total_picks', 'correct_picks', 'percentage'])
        
        picks_df = pd.DataFrame(response.data)
        
        # Calculate stats by user
        user_stats = []
        for user_id in picks_df['user_id'].unique():
            user_picks = picks_df[picks_df['user_id'] == user_id]
            total_picks = len(user_picks)
            correct_picks = len(user_picks[user_picks['correct'] == True])
            percentage = round((correct_picks / total_picks * 100), 1) if total_picks > 0 else 0
            
            user_stats.append({
                'user': user_id,
                'total_picks': total_picks,
                'correct_picks': correct_picks,
                'percentage': percentage
            })
        
        leaderboard_df = pd.DataFrame(user_stats)
        # Sort by percentage, then by correct picks
        leaderboard_df = leaderboard_df.sort_values(['percentage', 'correct_picks'], ascending=[False, False])
        
        return leaderboard_df
        
    except Exception as e:
        print(f"Error generating leaderboard: {e}")
        return pd.DataFrame(columns=['user', 'total_picks', 'correct_picks', 'percentage'])

def main():
    """Command line interface for Supabase operations."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Supabase integration for NFL pick-em league")
    parser.add_argument("--week", type=int, required=True, help="Week number")
    parser.add_argument("--action", choices=['extract', 'leaderboard'], default='extract',
                       help="Action to perform")
    parser.add_argument("--output", help="Output CSV file (default: picks_week{N}.csv)")
    
    args = parser.parse_args()
    
    if args.action == 'extract':
        # Extract picks for the week
        picks_df = extract_picks_for_week(args.week)
        if not picks_df.empty:
            output_file = save_picks_to_csv(picks_df, args.week, args.output)
            print(f"Picks extracted and saved to {output_file}")
            
            # Display summary
            print(f"\nPick Summary for Week {args.week}:")
            print(picks_df.groupby('user_id').size().to_string())
        else:
            print(f"No picks found for week {args.week}")
    
    elif args.action == 'leaderboard':
        # Show current leaderboard
        leaderboard_df = get_leaderboard()
        if not leaderboard_df.empty:
            print("Current Leaderboard:")
            print(leaderboard_df.to_string(index=False))
        else:
            print("No picks data found")

if __name__ == "__main__":
    main()