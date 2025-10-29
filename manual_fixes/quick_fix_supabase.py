#!/usr/bin/env python3
"""
Quick fix for specific wrong picks in Supabase
"""
from supabase import create_client

# Supabase configuration  
SUPABASE_URL = "https://kqygdqshcsozgxzgvpbr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxeWdkcXNoY3NvemdzendncGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjU5MDA4ODYsImV4cCI6MjA0MTQ3Njg4Nn0.0wjJfPzHqh4PYjJgP8wF9uFhw8M8K3K7lILzlBXa-T8"

def main():
    # Initialize Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Specific corrections based on known wrong results
    corrections = [
        # LA Chargers (-6) lost to Giants - should be INCORRECT
        {"team": "Los Angeles Chargers", "week": 4, "correct": False},
        # Any other wrong ones you can identify...
    ]
    
    print("Fixing specific wrong picks in Supabase...")
    
    for correction in corrections:
        try:
            # Update all picks for this team/week combination
            result = supabase.table('picks').update({
                'correct': correction['correct']
            }).eq('team', correction['team']).eq('week', correction['week']).execute()
            
            print(f"✅ Fixed {correction['team']} Week {correction['week']}: {correction['correct']}")
            print(f"   Updated {len(result.data)} picks")
            
        except Exception as e:
            print(f"❌ Error fixing {correction['team']}: {e}")
    
    print("\nQuick fixes complete!")

if __name__ == "__main__":
    main()