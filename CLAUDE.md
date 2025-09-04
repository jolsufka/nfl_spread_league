# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is an NFL spread league pick-em application with two main components:

1. **React Frontend** (`nfl-pickem/`): TypeScript React app for users to submit picks and view leaderboard
2. **Python Odds Fetcher** (`script.py`): Fetches NFL odds data from The Odds API

## Common Commands

### React Frontend (nfl-pickem/)
```bash
cd nfl-pickem
npm start      # Development server on localhost:3000
npm test       # Run tests in watch mode
npm run build  # Production build
```

### Python Odds Script (root directory)
```bash
# Fetch odds for a specific week window
python script.py --api-key YOUR_KEY --start-et "2025-09-02 08:00" --csv nfl_lines_week.csv

# Fetch odds using week number approach
python script.py --api-key YOUR_KEY --week1-start-et "2025-09-02 08:00" --week 1 --csv nfl_lines_week.csv
```

## Architecture

### React App Architecture
- **Components**: Single-file components in `App.tsx` (PickInterface, Leaderboard)
- **State Management**: Local React state (useState)
- **Styling**: Tailwind CSS with @tailwindcss/forms plugin
- **Data Flow**: Currently uses mock data, designed to integrate with CSV from Python script

### Python Script Architecture  
- Fetches from The Odds API for NFL spreads, totals, and moneyline markets
- Supports preferred sportsbooks: DraftKings, FanDuel, BetMGM, Caesars
- Outputs structured CSV with kickoff times, spreads, totals, and moneylines
- Uses timezone-aware datetime handling (Eastern Time)

### Data Integration Pattern
The Python script generates CSV files that the React app is designed to consume. The React app currently uses mock data matching the CSV schema:
- `kickoff_et`: Game start time in ET
- `away`/`home`: Team names  
- `spread_away`/`spread_home`: Point spreads
- `total`: Over/under total points
- Various book-specific columns

### Key Data Types
- **Game**: NFL game with odds data (spreads, totals, kickoff time)
- **Pick**: User's 3 game selections for a given week
- **User**: League participant with running totals

## Environment Setup

### React App Requirements
- Node.js and npm
- Dependencies include React 19, TypeScript, Tailwind CSS, PapaParse

### Python Script Requirements  
- Python with pandas, requests, pytz
- The Odds API key (set as ODDS_API_KEY environment variable)