// Season configuration — single source of truth for the season year, week
// timing, and playoff rounds. The deployed app and the Python pipeline both
// read public/season.json; nothing about the calendar is hardcoded elsewhere.

export interface PlayoffRound {
  week: number;
  name: string;
  linesFile: string;
}

export interface SeasonConfig {
  season: number;
  week1TuesdayEt: string; // e.g. "2026-09-08" — the Tuesday before the opener
  regularSeasonWeeks: number;
  mode: 'regular' | 'playoffs';
  playoffRound: number | null; // 100..103 when mode === 'playoffs'
  title: string;
  playoffRounds: PlayoffRound[];
}

export const DEFAULT_CONFIG: SeasonConfig = {
  season: 2026,
  week1TuesdayEt: '2026-09-08',
  regularSeasonWeeks: 18,
  mode: 'regular',
  playoffRound: null,
  title: '2026-27 NFL Spread Pick-Em',
  playoffRounds: [
    { week: 100, name: 'Wild Card', linesFile: 'nfl_playoff_wildcard.csv' },
    { week: 101, name: 'Divisional', linesFile: 'nfl_playoff_divisional.csv' },
    { week: 102, name: 'Conference', linesFile: 'nfl_playoff_conference.csv' },
    { week: 103, name: 'Super Bowl', linesFile: 'nfl_playoff_superbowl.csv' },
  ],
};

// Populated by loadSeasonConfig() before the app's data loaders run.
export let seasonConfig: SeasonConfig = DEFAULT_CONFIG;

export async function loadSeasonConfig(): Promise<SeasonConfig> {
  try {
    const response = await fetch(`${process.env.PUBLIC_URL}/season.json`);
    if (!response.ok) throw new Error(`season.json returned HTTP ${response.status}`);
    seasonConfig = { ...DEFAULT_CONFIG, ...(await response.json()) };
  } catch (error) {
    console.error('Falling back to default season config:', error);
    seasonConfig = DEFAULT_CONFIG;
  }
  return seasonConfig;
}

// NFL weeks run Tuesday 08:00 ET → next Tuesday 08:00 ET. Clamped to
// [1, regularSeasonWeeks] so preseason shows week 1 and the offseason
// shows the final week.
export function computeCurrentWeek(
  config: SeasonConfig = seasonConfig,
  now: Date = new Date()
): number {
  const week1Start = new Date(`${config.week1TuesdayEt}T08:00:00-04:00`);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const week = Math.floor((now.getTime() - week1Start.getTime()) / msPerWeek) + 1;
  return Math.min(Math.max(week, 1), config.regularSeasonWeeks);
}

export function isPlayoffWeek(week: number): boolean {
  return week >= 100;
}

export function getPlayoffRound(
  week: number,
  config: SeasonConfig = seasonConfig
): PlayoffRound | undefined {
  return config.playoffRounds.find((round) => round.week === week);
}

export function playoffWeekName(week: number, config: SeasonConfig = seasonConfig): string {
  return getPlayoffRound(week, config)?.name ?? `Week ${week}`;
}

// House rule: pushes count as picks made (denominator) but never as correct
// picks (numerator). 2-0 with a push is 2/3 = 66.7%, not 2/2.
// Understands both the result column (W/L/P) and the legacy correct boolean.
export interface GradedRecord {
  wins: number;
  losses: number;
  pushes: number;
  graded: number; // wins + losses + pushes — the denominator
  pct: number; // 0-100
}

export function calcRecord(
  picks: Array<{ correct?: boolean | null; result?: string | null }>
): GradedRecord {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  for (const pick of picks) {
    const result =
      pick.result ??
      (pick.correct === true ? 'W' : pick.correct === false ? 'L' : null);
    if (result === 'W') wins++;
    else if (result === 'L') losses++;
    else if (result === 'P') pushes++;
  }
  const graded = wins + losses + pushes;
  return {
    wins,
    losses,
    pushes,
    graded,
    pct: graded > 0 ? (wins / graded) * 100 : 0,
  };
}
