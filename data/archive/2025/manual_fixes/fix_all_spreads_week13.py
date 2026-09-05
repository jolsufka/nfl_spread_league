#!/usr/bin/env python3
"""
Recalculate ALL Week 13 spread results properly
"""

import pandas as pd

# Game results from the user's table
games_data = [
    {"away": "Green Bay Packers", "home": "Detroit Lions", "away_score": 31, "home_score": 24},
    {"away": "Kansas City Chiefs", "home": "Dallas Cowboys", "away_score": 28, "home_score": 31},
    {"away": "Cincinnati Bengals", "home": "Baltimore Ravens", "away_score": 32, "home_score": 14},
    {"away": "Chicago Bears", "home": "Philadelphia Eagles", "away_score": 24, "home_score": 15},
    {"away": "Los Angeles Rams", "home": "Carolina Panthers", "away_score": 28, "home_score": 31},
    {"away": "Arizona Cardinals", "home": "Tampa Bay Buccaneers", "away_score": 17, "home_score": 20},
    {"away": "New York Jets", "home": "Atlanta Falcons", "away_score": 27, "home_score": 24},
    {"away": "New Orleans Saints", "home": "Miami Dolphins", "away_score": 17, "home_score": 21},
    {"away": "San Francisco 49ers", "home": "Cleveland Browns", "away_score": 26, "home_score": 8},
    {"away": "Houston Texans", "home": "Indianapolis Colts", "away_score": 20, "home_score": 16},
    {"away": "Minnesota Vikings", "home": "Seattle Seahawks", "away_score": 0, "home_score": 26},
    {"away": "Buffalo Bills", "home": "Pittsburgh Steelers", "away_score": 26, "home_score": 7},
    {"away": "Las Vegas Raiders", "home": "Los Angeles Chargers", "away_score": 14, "home_score": 31},
    {"away": "Denver Broncos", "home": "Washington Commanders", "away_score": 27, "home_score": 26},
    {"away": "New York Giants", "home": "New England Patriots", "away_score": 15, "home_score": 33}
]

# Load the lines data to get spreads
lines_df = pd.read_csv("data/lines/nfl_lines_week13.csv")

print("=== WEEK 13 SPREAD ANALYSIS ===")
print("Checking every game for correct spread calculations...\n")

results = []

for game in games_data:
    # Find matching line
    line = None
    for _, row in lines_df.iterrows():
        if game['away'] == row['away'] and game['home'] == row['home']:
            line = row
            break
    
    if line is None:
        print(f"❌ No line found for {game['away']} @ {game['home']}")
        continue
    
    away_spread = line['spread_away']
    home_spread = line['spread_home'] 
    
    away_score = game['away_score']
    home_score = game['home_score']
    
    # Calculate actual margin (positive = home wins, negative = away wins)
    actual_margin = home_score - away_score
    
    # Calculate ATS results
    # For away team: did they beat their spread?
    away_ats_margin = -actual_margin - away_spread  # Flip margin for away team perspective
    # For home team: did they beat their spread?
    home_ats_margin = actual_margin - home_spread
    
    # Determine results
    if abs(away_ats_margin) < 0.01:  # Push (within rounding)
        away_ats_result = "P"
    elif away_ats_margin > 0:
        away_ats_result = "W"
    else:
        away_ats_result = "L"
        
    if abs(home_ats_margin) < 0.01:  # Push (within rounding)
        home_ats_result = "P"
    elif home_ats_margin > 0:
        home_ats_result = "W"
    else:
        home_ats_result = "L"
    
    # Calculate total
    total = line['total']
    actual_total = away_score + home_score
    over_under = "Over" if actual_total > total else "Under" if actual_total < total else "Push"
    
    print(f"🏈 {game['away']} @ {game['home']}")
    print(f"   Score: {away_score}-{home_score} (margin: {actual_margin:+d})")
    print(f"   Spread: {game['away']} {away_spread:+.1f}, {game['home']} {home_spread:+.1f}")
    print(f"   ATS: {game['away']} {away_ats_result} ({away_ats_margin:+.1f}), {game['home']} {home_ats_result} ({home_ats_margin:+.1f})")
    print(f"   Total: {actual_total} vs {total} ({over_under})")
    print()
    
    # Store result
    result = {
        'kickoff_et': line['kickoff_et'],
        'away': game['away'],
        'home': game['home'],
        'away_score': away_score,
        'home_score': home_score,
        'actual_margin': actual_margin,
        'home_spread': home_spread,
        'away_spread': away_spread,
        'home_ats_margin': home_ats_margin,
        'home_ats_result': home_ats_result,
        'away_ats_result': away_ats_result,
        'total': total,
        'actual_total': actual_total,
        'over_under': over_under
    }
    results.append(result)

# Save corrected results
results_df = pd.DataFrame(results)
results_df.to_csv("data/results/nfl_results_week13_corrected.csv", index=False)
print(f"✅ Saved corrected results to data/results/nfl_results_week13_corrected.csv")