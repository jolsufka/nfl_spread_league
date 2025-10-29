# Weekly NFL Spread League Workflow

## Pre-Week Setup (Get Odds)

For each week, fetch the odds data:

```bash
# Week 1 example
python script.py --week1-start-et "2024-09-02 08:00" --week 1
# Creates: nfl_lines_week1.csv

# Week 2 example  
python script.py --week1-start-et "2024-09-02 08:00" --week 2
# Creates: nfl_lines_week2.csv

# Alternative: specify exact dates
python script.py --start-et "2024-09-02 08:00" --csv nfl_lines_week1.csv
```

## During Week (Collect Picks)

Create a picks file for each week:

```bash
# Copy example format
cp picks_week1_example.csv picks_week1.csv
# Edit picks_week1.csv with actual user selections
```

**Picks file format:**
```csv
user,team,game_date
John,Philadelphia Eagles,2024-09-04
John,Kansas City Chiefs,2024-09-05
John,San Francisco 49ers,2024-09-07
Sarah,Baltimore Ravens,2024-09-07
Sarah,Green Bay Packers,2024-09-07
Sarah,New Orleans Saints,2024-09-07
```

## Post-Week Evaluation (Get Results)

After games complete, evaluate picks:

```bash
# Week 1 evaluation
python results_script.py --week 1
# Uses: nfl_lines_week1.csv, picks_week1.csv  
# Creates: nfl_results_week1.csv, pick_results_week1.csv

# Week 2 evaluation
python results_script.py --week 2
# Uses: nfl_lines_week2.csv, picks_week2.csv
# Creates: nfl_results_week2.csv, pick_results_week2.csv
```

## File Structure Per Week

After running both scripts for Week 1, you'll have:

```
nfl_lines_week1.csv      # Original odds data
picks_week1.csv          # User picks  
nfl_results_week1.csv    # Game results & ATS outcomes
pick_results_week1.csv   # Pick evaluation results
```

## Custom File Paths (Optional)

You can override the auto-generated filenames:

```bash
# Custom odds fetch
python script.py --week1-start-et "2024-09-02 08:00" --week 1 --csv custom_week1.csv

# Custom results evaluation
python results_script.py --week 1 --odds-csv custom_week1.csv --picks-csv my_picks.csv --results-csv my_results.csv
```

## Season-Long Tracking

Each week creates separate files, making it easy to:
- Track individual week performance
- Archive historical data
- Compare week-to-week results
- Aggregate season totals