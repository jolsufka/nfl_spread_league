---
name: nfl-week-setup
description: Automates the complete weekly setup process for NFL spread league including fetching odds, organizing files, and deploying the app
allowed-tools: ["Bash", "Read", "Write", "Edit", "LS"]
---

# NFL Week Setup Automation

This skill automates the complete weekly setup process for the NFL spread league application.

## What This Skill Does

1. **Fetches NFL Odds**: Uses The Odds API to get spreads for the specified week
2. **Organizes Data**: Moves CSV files to proper directory structure
3. **Updates React App**: Modifies App.tsx to reference the new week's data
4. **Deploys Application**: Builds and deploys to GitHub Pages
5. **Validates Success**: Checks that deployment completed successfully

## Prerequisites

- `.api_key` file must exist in project root
- Week 1 start date: `2025-09-02 08:00` (Eastern Time)
- Current season: 2025 NFL season

## Usage Examples

User says any of:
- "Set up Week X"
- "Get Week X odds and deploy"
- "Prepare Week X for the league"
- "New week setup for Week X"

## Workflow Steps

### 1. Validate Inputs
- Check that week number is valid (1-18)
- Verify API key file exists
- Confirm week isn't already set up

### 2. Fetch Odds Data
```bash
python3 scripts/script.py --api-key $(cat .api_key) --week1-start-et "2025-09-02 08:00" --week [WEEK] --csv data/lines/nfl_lines_week[WEEK].csv
```

### 3. Copy to React App
```bash
cp data/lines/nfl_lines_week[WEEK].csv nfl-pickem/public/
```

### 4. Update React App Configuration
Edit `nfl-pickem/src/App.tsx`:
- Update `currentWeek` variable to the new week number
- Update CSV filename reference to `nfl_lines_week[WEEK].csv`

### 5. Deploy to GitHub Pages
```bash
cd nfl-pickem && npm run deploy
```

### 6. Verify Deployment
- Check that GitHub Pages deployment succeeded
- Verify new week's games are visible on the website

## Error Handling

- **API Key Missing**: Guide user to create `.api_key` file
- **API Request Fails**: Check API key validity and network connection
- **Deployment Fails**: Check npm dependencies and build errors
- **File Not Found**: Verify all required files exist before proceeding

## Success Criteria

- CSV file created in `data/lines/` directory
- CSV file copied to `nfl-pickem/public/`
- React app updated with new week number and CSV reference
- GitHub Pages deployment completed successfully
- Website shows new week's games

## Important Notes

- ALWAYS use 2025 dates (not 2024!)
- Week 1 started: 2025-09-02 08:00 ET
- This is the 2025 NFL season
- Validate that previous week's results are processed before setting up new week
- Users typically need new week available by Tuesday morning