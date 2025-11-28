# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is an NFL spread league pick-em application with a React frontend deployed to GitHub Pages and multiple Python scripts for data management:

```
nfl_spread_league/
├── nfl-pickem/                 # React frontend application
│   ├── src/App.tsx            # Main application component
│   ├── public/                # Static assets and current week data files
│   └── package.json
├── scripts/                   # Python data management scripts
│   ├── script.py             # Fetches NFL odds data from The Odds API
│   ├── results_script.py     # Processes game results and updates pick accuracy
│   └── supabase_integration.py # Handles Supabase database operations
├── data/                     # Organized data storage
│   ├── lines/               # NFL odds/lines data (nfl_lines_week*.csv)
│   ├── results/             # Game results data (nfl_results_week*.csv)
│   ├── picks/               # User picks data (picks_week*.csv)
│   └── pick_results/        # Pick accuracy results (pick_results_week*.csv)
├── manual_fixes/            # Manual correction scripts and data
├── docs/                    # Documentation files
├── workspaces/             # VS Code workspace files
└── CLAUDE.md              # This file
```

## Common Commands

### React Frontend (nfl-pickem/)
```bash
cd nfl-pickem
npm start      # Development server on localhost:3000
npm test       # Run tests in watch mode
npm run build  # Production build
npm run deploy # Deploy to GitHub Pages
```

### Python Scripts (scripts/)
```bash
# Fetch odds for a specific week (ALWAYS use 2025 dates!)
python3 scripts/script.py --api-key $(cat .api_key) --week1-start-et "2025-09-02 08:00" --week 9 --csv data/lines/nfl_lines_week9.csv

# Process results and update pick accuracy (ALWAYS use 2025 dates!)
python3 scripts/results_script.py --api-key $(cat .api_key) --week 8 --week1-start-et "2025-09-02 08:00"

# Manual Supabase operations (if needed)
python3 scripts/supabase_integration.py

# IMPORTANT: Always use 2025 dates, not 2024! NFL season is 2025.
# Week 1 started: 2025-09-02 08:00
# Current season: 2025 NFL season
```

## Architecture

### React App Architecture
- **Components**: Comprehensive single-file architecture in `App.tsx` with:
  - `PickInterface`: Game selection interface with team logos, spread visualization, and user validation
  - `Leaderboard`: Real-time standings with percentage calculations and group performance metrics
  - `PickChart`: Matrix view of all users' picks across weeks with totals and percentages
  - `PickHistory`: Individual user pick history with result tracking
  - `InsightsBeta`: Advanced analytics (favorites vs underdogs, home/away, spread ranges, popular teams)
- **State Management**: React hooks (useState, useEffect) with Supabase integration and localStorage persistence
- **User Persistence**: Selected user saved to localStorage (`nfl-pickem-user` key) and restored on app load
- **Styling**: Tailwind CSS with responsive design, hover states, and conditional styling for game states
- **Data Sources**: 
  - Supabase database for picks storage and retrieval
  - CSV files in `public/` directory for games data (nfl_lines_week*.csv)
  - YAML file for team abbreviations (teamAbbreviations.yaml)
  - ESPN team logos via CDN links

### Database Architecture (Supabase)
- **picks table**: Stores user selections with fields:
  - `user_id`, `week`, `game_id`, `team`, `spread`, `correct` (nullable for grading)
- **Real-time updates**: App loads picks from Supabase on component mount and after saves
- **Data persistence**: All user picks saved to database immediately, with CSV exports for backup
- **User management**: Hardcoded user list in React app (Jacob, Cam, Connor, Nathan, Shane, Max, John)

### Python Scripts Architecture
- **scripts/script.py**: 
  - Fetches from The Odds API for NFL spreads, totals, and moneyline markets
  - Supports preferred sportsbooks: DraftKings, FanDuel, BetMGM, Caesars
  - Outputs structured CSV to `data/lines/` with timezone-aware ET timestamps
- **scripts/results_script.py**:
  - Processes completed games and determines pick accuracy
  - Updates Supabase `picks.correct` field based on actual outcomes
  - Exports results to `data/results/` and `data/pick_results/` for analysis
- **scripts/supabase_integration.py**:
  - Centralized database operations module
  - Functions for extracting picks, updating results, generating leaderboards
  - Exports picks to `data/picks/` directory

### Data Flow
1. **Weekly Setup**: Use `scripts/script.py` to fetch odds → CSV in `data/lines/` → copy to `nfl-pickem/public/`
2. **User Session**: User selection persisted to localStorage, restored on page load
3. **Pick Submission**: React app loads games from CSV, validates user selection, saves picks to Supabase
4. **Results Processing**: Use `scripts/results_script.py` to grade picks after games complete
5. **Analytics**: React app displays real-time analytics from graded picks with advanced insights

### Key Data Types
- **Game**: NFL game with odds data (spreads, totals, kickoff time, team logos, game locking)
- **Pick**: User's 3 game selections for a week with spread values and accuracy tracking
- **User**: League participant with calculated totals, percentages, and localStorage persistence
- **TeamPick**: Individual team selection with `correct` field for grading (null until game completes)

## File Organization

### Data Files
- **`data/lines/`**: Original odds data from The Odds API (nfl_lines_week*.csv)
- **`data/results/`**: Game results with ATS outcomes (nfl_results_week*.csv)
- **`data/picks/`**: User selections exported from Supabase (picks_week*.csv)
- **`data/pick_results/`**: Pick accuracy results (pick_results_week*.csv)

### Script Files
- **`scripts/`**: All Python data management scripts
- **`manual_fixes/`**: One-off correction scripts and manual data files
- **`docs/`**: Documentation files (*.md)
- **`workspaces/`**: VS Code workspace configurations

## Environment Setup

### React App Requirements
- Node.js and npm
- Dependencies: React 19, TypeScript, Tailwind CSS, PapaParse, Supabase client, js-yaml
- GitHub Pages deployment via gh-pages package

### Python Requirements
- Python with pandas, requests, pytz, supabase-py
- The Odds API key (set as ODDS_API_KEY environment variable or .api_key file)
- Supabase project with `picks` table configured

### Deployment
- **Frontend**: Auto-deployed to GitHub Pages via `npm run deploy` at https://jolsufka.github.io/nfl_spread_league
- **Database**: Hosted on Supabase with public read access for picks table
- **Static Assets**: CSV files in organized folders and team data in `nfl-pickem/public/`
  - `nfl-pickem/public/lines/`: NFL odds/lines CSV files
  - `nfl-pickem/public/results/`: NFL game results CSV files
- **User State**: Persisted locally via browser localStorage for seamless user experience

## Weekly Workflow

1. **Fetch Odds**: `python3 scripts/script.py --api-key $(cat .api_key) --week1-start-et "2025-09-02 08:00" --week N`
2. **Copy to App**: `cp data/lines/nfl_lines_weekN.csv nfl-pickem/public/lines/`
3. **Update App**: Change `currentWeek` and CSV filename in `App.tsx`
4. **Deploy**: `cd nfl-pickem && npm run deploy`
5. **Process Results**: `python3 scripts/results_script.py --api-key $(cat .api_key) --week N --week1-start-et "2025-09-02 08:00"`
6. **Copy Results**: `cp data/results/nfl_results_weekN.csv nfl-pickem/public/results/`

## Key Features
- **Local User Persistence**: Selected user automatically saved and restored across sessions
- **Real-time Pick Validation**: Prevents submissions without user selection or incomplete picks
- **Game State Management**: Games lock automatically at kickoff time to prevent late picks
- **Comprehensive Analytics**: Advanced insights including favorites vs underdogs, home/away performance, and spread analysis
- **Responsive Design**: Mobile-friendly interface with touch-optimized interactions
- **Live Updates**: Real-time leaderboard and pick tracking with Supabase integration
- **Organized Data Structure**: Clean separation of data types in organized folders

# Important Instructions
- ALWAYS use 2025 dates when running scripts (not 2024!)
- NEVER create files unless absolutely necessary for achieving goals
- ALWAYS prefer editing existing files to creating new ones
- NEVER proactively create documentation files unless explicitly requested
- Scripts now output to organized `data/` folders - update any hardcoded paths accordingly