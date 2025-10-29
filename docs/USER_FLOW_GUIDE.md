# NFL Spread League - User Flow Guide

## Overview
A web app where 6 friends pick 3 NFL teams against the spread each week, competing to see who has the best record over the season.

---

## User Journey

### Week Setup (Admin - You)

1. **Monday Morning**: Run Python script to get new week's games
   ```bash
   python script.py --api-key YOUR_KEY --week 2 --csv nfl_lines_week.csv
   git add nfl_lines_week.csv
   git commit -m "Week 2 games available"
   git push
   ```

2. **App Updates**: New games automatically appear on website within minutes

3. **Notify League**: Text/email the group that new week is live

---

## User Experience

### Making Picks (Tuesday - Sunday Morning)

1. **Visit Website**: `jolsufka.github.io/nfl_spread_league`

2. **Select User**: Choose your name from dropdown
   ```
   Select User: [Jacob ▼]
   ```

3. **Make Picks Tab**: See all 16 NFL games for the week
   ```
   Cowboys @ Eagles     Wed, Sep 4, 8:20 PM
   
   ☐ Cowboys +7.5     (underdog - get 7.5 points)
   ☐ Eagles -7.5      (favorite - give 7.5 points)
   ```

4. **Select 3 Teams**: Click checkboxes to pick exactly 3 teams
   - ✅ Can pick either team from any matchup
   - ✅ Can pick favorites or underdogs  
   - ❌ Cannot pick both teams from same game
   - ❌ Must pick exactly 3 (no more, no less)

5. **Visual Feedback**: 
   - Selected teams highlighted in blue
   - Counter shows "2/3 selected"
   - Button disabled until 3 picks made

6. **Submit Picks**: Click "Save Picks (3/3)" button
   - Confirmation message appears
   - Picks immediately saved to database
   - Can change picks anytime before games start

### Viewing Everyone's Picks

#### Pick Chart Tab (Overview)
```
User   | Total | %   | W1        | W2        | W3 |
-------|-------|-----|-----------|-----------|----| 
Jacob  | 5     | 83% | COW+7.5✅  | KC-3✅    | -  |
       |       |     | KC-3❌     | DAL+2✅   |    |
       |       |     | ARI-6.5✅  | PHI-7❌   |    |
       |       |     | 2/3       | 2/3      |    |
-------|-------|-----|-----------|-----------|----| 
Cam    | 3     | 50% | PHI-7.5❌  | BUF+3✅   | -  |
       |       |     | LAC+3✅    | NE-6❌    |    |
       |       |     | ATL-4❌    | MIA+1✅   |    |
       |       |     | 1/3       | 2/3      |    |
```

**Features:**
- See everyone's picks and results at a glance
- Green ✅ for correct picks, Red ❌ for incorrect
- Running totals and win percentages
- Current week highlighted in blue
- Scrolls horizontally for many weeks

#### Pick History Tab (Individual Deep Dive)
Select any user to see their detailed history:

```
Jacob's Pick History

Week 1:
Pick 1: Cowboys @ Eagles (+7.5) ✅
Pick 2: Chiefs @ Chargers (-3) ❌  
Pick 3: Cardinals @ Saints (-6.5) ✅
Correct: 2/3

Week 2:  
Pick 1: Chiefs @ Bengals (-3) ✅
Pick 2: Cowboys @ Giants (+2) ✅
Pick 3: Eagles @ Commanders (-7) ❌
Correct: 2/3
```

**Features:**
- Full team names with opponent context
- Color-coded results (green/red)
- Week-by-week breakdown
- Shows just mascot names (Cowboys vs Eagles, not Dallas Cowboys vs Philadelphia Eagles)

#### Leaderboard Tab (Season Standings)
```
Name    | Total Correct | Win %
--------|---------------|------
Nathan  | 8            | 89%
Jacob   | 5            | 83%  
Shane   | 4            | 67%
Cam     | 3            | 50%
Con     | 2            | 33%
Max     | 1            | 17%
```

---

## Weekly Rhythm

### Tuesday - Saturday: Pick Submission Period
- **Tuesday morning**: New games appear
- **All week**: Users submit/change picks
- **Saturday**: Last chance to submit (games start Sunday)
- **Real-time**: See who has submitted picks in Pick Chart

### Sunday: Game Day
- **Games play**: No more pick changes allowed
- **During games**: Picks are locked, watch games play out
- **Sunday night**: Admin updates results in database

### Monday: Results & New Week
- **Monday morning**: 
  - All users see updated W/L records
  - Running totals automatically calculated  
  - New week's games loaded
  - Cycle repeats

---

## User Interface Features

### Mobile Friendly
- Responsive design works on phones/tablets
- Easy team logo recognition
- Touch-friendly pick selection

### Visual Feedback
- **Team logos** next to each selection
- **Spread highlighting** with clear favorite/underdog
- **Game times** in local timezone
- **Progress indicators** (2/3 picks made)

### Error Prevention  
- Can't submit without exactly 3 picks
- Can't pick both teams from same game
- Clear visual feedback on selections
- Confirmation messages

### Social Features
- See who has submitted picks already
- Compare picks with friends in real-time
- Running trash talk based on weekly results
- Season-long leaderboard competition

---

## Admin Tasks (You)

### Weekly (5 minutes)
1. Run Python odds script
2. Commit CSV to GitHub  
3. Notify group new week is live

### After Games (10 minutes)
1. Check game results
2. Update pick results in Supabase admin panel
3. Users automatically see updated standings

### Season Setup (One Time)
1. Initialize user names in database
2. Set league rules/scoring
3. Configure any automated notifications

---

## Season Flow

### Week 1-17: Regular Season
- Standard weekly picks
- Building season-long records
- Regular leaderboard updates

### Week 18+: Playoffs (Optional)
- Could add playoff picking
- Championship predictions
- Super Bowl prop bets

### Season End
- Export final standings
- Crown champion 🏆  
- Plan next year's league