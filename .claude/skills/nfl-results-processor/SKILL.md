---
name: nfl-results-processor
description: Processes completed NFL games, updates pick accuracy in Supabase, and generates results files
allowed-tools: ["Bash", "Read", "Write", "Edit", "LS"]
---

# NFL Results Processing Automation

This skill automates the complete results processing workflow after NFL games are completed.

## What This Skill Does

1. **Fetches Game Results**: Uses The Odds API to get actual game scores and ATS outcomes
2. **Updates Database**: Marks picks as correct/incorrect in Supabase based on actual results
3. **Generates Reports**: Creates CSV files with game results and pick accuracy
4. **Updates React App**: Copies results files to React app for display
5. **Validates Data**: Ensures all games are processed and results are accurate

## Prerequisites

- `.api_key` file must exist in project root
- Week 1 start date: `2025-09-02 08:00` (Eastern Time)
- Current season: 2025 NFL season
- Supabase database with picks data for the week
- All games for the week must be completed

## Usage Examples

User says any of:
- "Process Week X results"
- "Update picks for Week X"
- "Grade Week X picks"
- "Week X games are done, process results"

## Workflow Steps

### 1. Validate Inputs
- Check that week number is valid (1-18)
- Verify API key file exists
- Confirm picks exist for the week in Supabase
- Check that games for the week are completed

### 2. Fetch Game Results
```bash
python3 scripts/results_script.py --api-key $(cat .api_key) --week [WEEK] --week1-start-et "2025-09-02 08:00"
```

### 3. Verify Results Files Generated
Check that these files were created:
- `data/results/nfl_results_week[WEEK].csv` - Game results with ATS outcomes
- `data/pick_results/pick_results_week[WEEK].csv` - Individual pick accuracy

### 4. Copy Results to React App
```bash
cp data/results/nfl_results_week[WEEK].csv nfl-pickem/public/
```

### 5. Validate Database Updates
- Check that Supabase picks table has `correct` field updated
- Verify pick accuracy calculations are correct
- Ensure all games for the week are processed

### 6. Generate Summary Report
Provide summary of:
- Total games processed
- Each user's correct picks for the week
- Updated season standings
- Any games that couldn't be processed

## Error Handling

- **API Key Missing**: Guide user to create `.api_key` file
- **API Request Fails**: Check API key validity and network connection
- **No Picks Found**: Verify users have submitted picks for the week
- **Incomplete Games**: List games that haven't finished yet
- **Supabase Connection Issues**: Check database connectivity and permissions
- **File Creation Errors**: Verify write permissions and disk space

## Data Validation

The skill performs these validation checks:
- All games for the week have final scores
- Pick accuracy calculations match actual game outcomes
- No duplicate entries in results files
- All users' picks are processed
- Database updates completed successfully

## Success Criteria

- Game results fetched and processed successfully
- Supabase database updated with pick accuracy
- Results CSV files generated in `data/results/` and `data/pick_results/`
- Results files copied to React app
- Summary report shows all picks processed correctly

## Output Files Generated

- `data/results/nfl_results_week[WEEK].csv`: Game outcomes with ATS results
- `data/pick_results/pick_results_week[WEEK].csv`: User pick accuracy
- `nfl-pickem/public/nfl_results_week[WEEK].csv`: Results for React app

## Important Notes

- ALWAYS use 2025 dates (not 2024!)
- Week 1 started: 2025-09-02 08:00 ET
- This is the 2025 NFL season
- Process results only after ALL games for the week are completed
- Results typically processed Sunday night or Monday morning
- Validate that previous week's setup is complete before processing
- Users expect results within 24 hours of games ending

## Common Scenarios

### Monday Night Football
If Monday Night Football hasn't finished:
- Process all completed games
- Note which game(s) are pending
- Re-run after MNF completes

### Tie Games
Handle rare tie scenarios according to sportsbook rules (typically pushes)

### Postponed Games
If games are postponed:
- Process available games
- Track postponed games separately
- Update when postponed games are completed