#!/usr/bin/env python3
from supabase_integration import get_supabase_client

def fix_lions_picks():
    """Fix Lions picks for Week 5 - they should be marked as WIN (covered -10.5)."""
    supabase = get_supabase_client()
    
    try:
        # Update all Lions picks for Week 5 to be correct=True
        response = supabase.table('picks').update({
            'correct': True
        }).eq('week', 5).eq('team', 'Detroit Lions').execute()
        
        if response.data:
            print(f"Updated {len(response.data)} Lions picks to WIN")
            for pick in response.data:
                print(f"  - {pick['user_id']}: Detroit Lions -> WIN")
        else:
            print("No Lions picks found for Week 5")
            
        # Also update any Bengals picks for Week 5 to be correct=False  
        response2 = supabase.table('picks').update({
            'correct': False
        }).eq('week', 5).eq('team', 'Cincinnati Bengals').execute()
        
        if response2.data:
            print(f"Updated {len(response2.data)} Bengals picks to LOSS")
            for pick in response2.data:
                print(f"  - {pick['user_id']}: Cincinnati Bengals -> LOSS")
                
    except Exception as e:
        print(f"Error updating Lions picks: {e}")

if __name__ == "__main__":
    fix_lions_picks()