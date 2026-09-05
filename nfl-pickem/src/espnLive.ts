// Live scores from ESPN's public scoreboard — the same source the grading
// pipeline uses. Polls only while games are actually in progress.
import { useEffect, useState } from 'react';
import { seasonConfig } from './seasonConfig';

export interface LiveGame {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  completed: boolean;
  inProgress: boolean;
  statusDetail: string; // "Q4 4:12", "Final", "Sun 1:00 PM"
}

const SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

export async function fetchLiveWeek(week: number, season: number): Promise<LiveGame[]> {
  const url = `${SCOREBOARD}?seasontype=2&week=${week}&dates=${season}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ESPN scoreboard HTTP ${response.status}`);
  const payload = await response.json();
  return (payload.events || []).map((event: any) => {
    const competition = event.competitions[0];
    const bySide: { [key: string]: any } = {};
    for (const competitor of competition.competitors) bySide[competitor.homeAway] = competitor;
    const status = event.status || {};
    const completed = Boolean(status.type?.completed);
    const state = status.type?.state; // 'pre' | 'in' | 'post'
    return {
      home: bySide.home.team.displayName,
      away: bySide.away.team.displayName,
      homeScore: parseInt(bySide.home.score || '0', 10),
      awayScore: parseInt(bySide.away.score || '0', 10),
      completed,
      inProgress: state === 'in',
      statusDetail: status.type?.shortDetail || '',
    };
  });
}

// Poll while any game is live; one fetch on mount either way.
export function useLiveScores(week: number, enabled: boolean) {
  const [games, setGames] = useState<LiveGame[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const tick = async () => {
      try {
        const liveGames = await fetchLiveWeek(week, seasonConfig.season);
        if (cancelled) return;
        setGames(liveGames);
        if (liveGames.some((game) => game.inProgress)) {
          timer = setTimeout(tick, 60_000);
        }
      } catch (error) {
        console.error('Live scores unavailable:', error);
      }
    };
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [week, enabled]);

  return games;
}

// ATS state for a spread pick given a live game.
export function atsState(
  pickedTeam: string,
  spread: number,
  game: LiveGame
): 'covering' | 'not-covering' | 'push-line' {
  const isHome = game.home === pickedTeam;
  const margin = isHome
    ? game.homeScore - game.awayScore
    : game.awayScore - game.homeScore;
  const atsMargin = margin + spread;
  if (atsMargin > 0) return 'covering';
  if (atsMargin < 0) return 'not-covering';
  return 'push-line';
}
