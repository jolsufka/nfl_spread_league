#!/usr/bin/env python3
"""
Final fix for Week 13 spread calculations with correct push logic
"""

import pandas as pd

def calculate_ats_result(actual_margin, spread):
    """
    Calculate ATS result for a team given actual margin and their spread
    
    For favorite (negative spread): need to win by MORE than spread to cover
    For underdog (positive spread): can lose by LESS than spread to cover
    Push if exactly equal
    """
    if spread < 0:  # Favorite
        cover_margin = actual_margin + spread
        if abs(cover_margin) < 0.01:  # Push
            return "P"
        elif cover_margin > 0:
            return "W"
        else:
            return "L"
    else:  # Underdog or pick'em
        cover_margin = actual_margin - spread
        if abs(cover_margin) < 0.01:  # Push  
            return "P"
        elif cover_margin > 0:
            return "W"
        else:
            return "L"

# All games with correct scores and line matching
games_lines = [
    # GB @ DET: GB +2.5, DET -2.5, Score: GB 31 DET 24 (GB wins by 7)
    {"away": "Green Bay Packers", "home": "Detroit Lions", "away_score": 31, "home_score": 24, 
     "away_spread": 2.5, "home_spread": -2.5, "total": 48.5, "kickoff": "2025-11-27 13:00:00-05:00"},
    
    # KC @ DAL: KC -3.5, DAL +3.5, Score: KC 28 DAL 31 (DAL wins by 3)  
    {"away": "Kansas City Chiefs", "home": "Dallas Cowboys", "away_score": 28, "home_score": 31,
     "away_spread": -3.5, "home_spread": 3.5, "total": 52.5, "kickoff": "2025-11-27 16:30:00-05:00"},
    
    # CIN @ BAL: CIN +7, BAL -7, Score: CIN 32 BAL 14 (CIN wins by 18)
    {"away": "Cincinnati Bengals", "home": "Baltimore Ravens", "away_score": 32, "home_score": 14,
     "away_spread": 7.0, "home_spread": -7.0, "total": 51.5, "kickoff": "2025-11-27 20:20:00-05:00"},
    
    # CHI @ PHI: CHI +7, PHI -7, Score: CHI 24 PHI 15 (CHI wins by 9)
    {"away": "Chicago Bears", "home": "Philadelphia Eagles", "away_score": 24, "home_score": 15,
     "away_spread": 7.0, "home_spread": -7.0, "total": 44.5, "kickoff": "2025-11-28 15:00:00-05:00"},
    
    # ARI @ TB: ARI +3, TB -3, Score: ARI 17 TB 20 (TB wins by 3) - PUSH!
    {"away": "Arizona Cardinals", "home": "Tampa Bay Buccaneers", "away_score": 17, "home_score": 20,
     "away_spread": 3.0, "home_spread": -3.0, "total": 44.5, "kickoff": "2025-11-30 13:00:00-05:00"},
    
    # ATL @ NYJ: ATL -2.5, NYJ +2.5, Score: NYJ 27 ATL 24 (NYJ wins by 3)
    {"away": "Atlanta Falcons", "home": "New York Jets", "away_score": 24, "home_score": 27,
     "away_spread": -2.5, "home_spread": 2.5, "total": 39.5, "kickoff": "2025-11-30 13:00:00-05:00"},
    
    # LAR @ CAR: LAR -10.5, CAR +10.5, Score: LAR 28 CAR 31 (CAR wins by 3)
    {"away": "Los Angeles Rams", "home": "Carolina Panthers", "away_score": 28, "home_score": 31,
     "away_spread": -10.5, "home_spread": 10.5, "total": 44.5, "kickoff": "2025-11-30 13:00:00-05:00"},
    
    # SF @ CLE: SF -4.5, CLE +4.5, Score: SF 26 CLE 8 (SF wins by 18)
    {"away": "San Francisco 49ers", "home": "Cleveland Browns", "away_score": 26, "home_score": 8,
     "away_spread": -4.5, "home_spread": 4.5, "total": 37.5, "kickoff": "2025-11-30 13:00:00-05:00"},
    
    # HOU @ IND: HOU +4.5, IND -4.5, Score: HOU 20 IND 16 (HOU wins by 4)
    {"away": "Houston Texans", "home": "Indianapolis Colts", "away_score": 20, "home_score": 16,
     "away_spread": 4.5, "home_spread": -4.5, "total": 44.5, "kickoff": "2025-11-30 13:00:00-05:00"},
    
    # NO @ MIA: NO +6, MIA -6, Score: NO 17 MIA 21 (MIA wins by 4)  
    {"away": "New Orleans Saints", "home": "Miami Dolphins", "away_score": 17, "home_score": 21,
     "away_spread": 6.0, "home_spread": -6.0, "total": 41.5, "kickoff": "2025-11-30 13:00:00-05:00"},
    
    # MIN @ SEA: MIN +10.5, SEA -10.5, Score: MIN 0 SEA 26 (SEA wins by 26)
    {"away": "Minnesota Vikings", "home": "Seattle Seahawks", "away_score": 0, "home_score": 26,
     "away_spread": 10.5, "home_spread": -10.5, "total": 41.5, "kickoff": "2025-11-30 16:05:00-05:00"},
    
    # BUF @ PIT: BUF -3.5, PIT +3.5, Score: BUF 26 PIT 7 (BUF wins by 19)
    {"away": "Buffalo Bills", "home": "Pittsburgh Steelers", "away_score": 26, "home_score": 7,
     "away_spread": -3.5, "home_spread": 3.5, "total": 47.5, "kickoff": "2025-11-30 16:25:00-05:00"},
    
    # LV @ LAC: LV +10, LAC -10, Score: LV 14 LAC 31 (LAC wins by 17)
    {"away": "Las Vegas Raiders", "home": "Los Angeles Chargers", "away_score": 14, "home_score": 31,
     "away_spread": 10.0, "home_spread": -10.0, "total": 41.5, "kickoff": "2025-11-30 16:25:00-05:00"},
    
    # DEN @ WAS: DEN -6.5, WAS +6.5, Score: DEN 27 WAS 26 (DEN wins by 1)
    {"away": "Denver Broncos", "home": "Washington Commanders", "away_score": 27, "home_score": 26,
     "away_spread": -6.5, "home_spread": 6.5, "total": 43.5, "kickoff": "2025-11-30 20:20:00-05:00"},
    
    # NYG @ NE: NYG +7, NE -7, Score: NYG 15 NE 33 (NE wins by 18)
    {"away": "New York Giants", "home": "New England Patriots", "away_score": 15, "home_score": 33,
     "away_spread": 7.0, "home_spread": -7.0, "total": 46.5, "kickoff": "2025-12-01 20:15:00-05:00"}
]

print("=== FINAL WEEK 13 SPREAD VERIFICATION ===\n")

results = []
for game in games_lines:
    away_score = game['away_score']
    home_score = game['home_score']
    actual_margin = home_score - away_score  # Positive = home wins
    
    # Calculate ATS results
    away_margin_vs_spread = -actual_margin  # Away team's perspective
    home_margin_vs_spread = actual_margin   # Home team's perspective
    
    away_ats_result = calculate_ats_result(away_margin_vs_spread, game['away_spread'])
    home_ats_result = calculate_ats_result(home_margin_vs_spread, game['home_spread'])
    
    # Calculate ATS margins for display
    away_ats_margin = away_margin_vs_spread - game['away_spread']
    home_ats_margin = home_margin_vs_spread - game['home_spread']
    
    # Total calculation
    actual_total = away_score + home_score
    if actual_total > game['total']:
        over_under = "Over"
    elif actual_total < game['total']:
        over_under = "Under"  
    else:
        over_under = "Push"
    
    print(f"🏈 {game['away']} @ {game['home']}")
    print(f"   Score: {away_score}-{home_score} (margin: {actual_margin:+d})")
    print(f"   Spread: {game['away']} {game['away_spread']:+.1f}, {game['home']} {game['home_spread']:+.1f}")
    print(f"   ATS: {game['away']} {away_ats_result} ({away_ats_margin:+.1f}), {game['home']} {home_ats_result} ({home_ats_margin:+.1f})")
    print(f"   Total: {actual_total} vs {game['total']} ({over_under})")
    print()
    
    # Store result  
    result = {
        'kickoff_et': game['kickoff'],
        'away': game['away'],
        'home': game['home'], 
        'away_score': away_score,
        'home_score': home_score,
        'actual_margin': actual_margin,
        'home_spread': game['home_spread'],
        'away_spread': game['away_spread'],
        'home_ats_margin': home_ats_margin,
        'home_ats_result': home_ats_result,
        'away_ats_result': away_ats_result,
        'total': game['total'],
        'actual_total': actual_total,
        'over_under': over_under
    }
    results.append(result)

# Save final results
results_df = pd.DataFrame(results)
results_df.to_csv("data/results/nfl_results_week13.csv", index=False)
print(f"✅ Saved final corrected results to data/results/nfl_results_week13.csv")