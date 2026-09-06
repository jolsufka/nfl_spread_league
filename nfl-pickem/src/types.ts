// Shared domain types for the Spread League app.

export interface Game {
  id: string;
  kickoff_et: string;
  away: string;
  home: string;
  spread_away: number;
  spread_home: number;
  total: number;
  spreads_book?: string;
  // live-lines metadata (present after the first refresh)
  opening_spread_away?: number;
  opening_spread_home?: number;
  fetched_at?: string;
  // First half lines (Super Bowl only)
  spread_h1_away?: number;
  spread_h1_home?: number;
  total_h1?: number;
}

export interface WeatherData {
  team: string;
  stadium: string;
  city: string;
  state: string;
  weather_summary: string;
  forecast_time: string;
}

export interface TeamPick {
  gameId: string;
  team: string;
  spread: number;
  correct?: boolean | null;
  result?: 'W' | 'L' | 'P' | null;
  pickType?: 'spread' | 'total' | 'spread_h1' | 'total_h1' | 'prop1' | 'prop2';
  propId?: string;
  propSelection?: 'OVER' | 'UNDER' | 'YES';
}

export interface Pick {
  userId: string;
  week: number;
  picks: TeamPick[];
  correct: number;
}

export interface User {
  id: string;
  name: string;
  total: number;
  percentage: number;
}
