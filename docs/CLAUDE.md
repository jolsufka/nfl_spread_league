# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is an NFL spread league pick-em application with a React frontend deployed to GitHub Pages and multiple Python scripts for data management:

1. **React Frontend** (`nfl-pickem/`): TypeScript React app deployed to GitHub Pages at https://jolsufka.github.io/nfl_spread_league
2. **Data Management Scripts** (root directory):
   - `script.py`: Fetches NFL odds data from The Odds API
   - `results_script.py`: Processes game results and updates pick accuracy
   - `supabase_integration.py`: Handles Supabase database operations

## Common Commands

### React Frontend (nfl-pickem/)
```bash
cd nfl-pickem
npm start      # Development server on localhost:3000
npm test       # Run tests in watch mode
npm run build  # Production build
npm run deploy # Deploy to GitHub Pages
```

### Python Scripts (root directory)
```bash
# Fetch odds for a specific week (ALWAYS use 2025 dates!)
python3 script.py --api-key $(cat .api_key) --week1-start-et "2025-09-02 08:00" --week 9 --csv nfl_lines_week9.csv

# Process results and update pick accuracy (ALWAYS use 2025 dates!)
python3 results_script.py --api-key $(cat .api_key) --week 8 --week1-start-et "2025-09-02 08:00"

# Manual Supabase operations (if needed)
python3 supabase_integration.py

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
  - CSV files in `public/` directory for games data (nfl_lines_week2.csv)
  - YAML file for team abbreviations (teamAbbreviations.yaml)
  - ESPN team logos via CDN links

### Database Architecture (Supabase)
- **picks table**: Stores user selections with fields:
  - `user_id`, `week`, `game_id`, `team`, `spread`, `correct` (nullable for grading)
- **Real-time updates**: App loads picks from Supabase on component mount and after saves
- **Data persistence**: All user picks saved to database immediately, with CSV exports for backup
- **User management**: Hardcoded user list in React app (Jacob, Cam, Connor, Nathan, Shane, Max, John)

### Python Scripts Architecture
- **script.py**: 
  - Fetches from The Odds API for NFL spreads, totals, and moneyline markets
  - Supports preferred sportsbooks: DraftKings, FanDuel, BetMGM, Caesars
  - Outputs structured CSV with timezone-aware ET timestamps
- **results_script.py**:
  - Processes completed games and determines pick accuracy
  - Updates Supabase `picks.correct` field based on actual outcomes
  - Exports results to CSV for analysis
- **supabase_integration.py**:
  - Centralized database operations module
  - Functions for extracting picks, updating results, generating leaderboards

### Data Flow
1. **Weekly Setup**: Use `script.py` to fetch odds → CSV in `public/` directory
2. **User Session**: User selection persisted to localStorage, restored on page load
3. **Pick Submission**: React app loads games from CSV, validates user selection, saves picks to Supabase
4. **Results Processing**: Use `results_script.py` to grade picks after games complete
5. **Analytics**: React app displays real-time analytics from graded picks with advanced insights

### Key Data Types
- **Game**: NFL game with odds data (spreads, totals, kickoff time, team logos, game locking)
- **Pick**: User's 3 game selections for a week with spread values and accuracy tracking
- **User**: League participant with calculated totals, percentages, and localStorage persistence
- **TeamPick**: Individual team selection with `correct` field for grading (null until game completes)

## Environment Setup

### React App Requirements
- Node.js and npm
- Dependencies: React 19, TypeScript, Tailwind CSS, PapaParse, Supabase client, js-yaml
- GitHub Pages deployment via gh-pages package

### Python Requirements
- Python with pandas, requests, pytz, supabase-py
- The Odds API key (set as ODDS_API_KEY environment variable)
- Supabase project with `picks` table configured

### Deployment
- **Frontend**: Auto-deployed to GitHub Pages via `npm run deploy` at https://jolsufka.github.io/nfl_spread_league
- **Database**: Hosted on Supabase with public read access for picks table
- **Static Assets**: CSV files and team data in `nfl-pickem/public/`
- **User State**: Persisted locally via browser localStorage for seamless user experience

## Key Features
- **Local User Persistence**: Selected user automatically saved and restored across sessions
- **Real-time Pick Validation**: Prevents submissions without user selection or incomplete picks
- **Game State Management**: Games lock automatically at kickoff time to prevent late picks
- **Comprehensive Analytics**: Advanced insights including favorites vs underdogs, home/away performance, and spread analysis
- **Responsive Design**: Mobile-friendly interface with touch-optimized interactions
- **Live Updates**: Real-time leaderboard and pick tracking with Supabase integration