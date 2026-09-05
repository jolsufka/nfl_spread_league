// Standings/records math shared by the screens. Everything routes through
// calcRecord (the house push rule: pushes count in the denominator only).
import { Pick, TeamPick, User } from './types';
import { calcRecord, isPlayoffWeek } from './seasonConfig';

export const gradeOf = (pick: TeamPick): 'W' | 'L' | 'P' | null => {
  if (pick.result === 'W' || pick.result === 'L' || pick.result === 'P') return pick.result;
  if (pick.correct === true) return 'W';
  if (pick.correct === false) return 'L';
  return null;
};

export const regularSeason = (picks: Pick[]) =>
  picks.filter((userWeek) => !isPlayoffWeek(userWeek.week));

export function userTeamPicks(picks: Pick[], userId: string, throughWeek?: number): TeamPick[] {
  return regularSeason(picks)
    .filter(
      (userWeek) =>
        userWeek.userId === userId &&
        (throughWeek === undefined || userWeek.week <= throughWeek)
    )
    .sort((a, b) => a.week - b.week)
    .flatMap((userWeek) => userWeek.picks);
}

export function recordString(record: { wins: number; losses: number; pushes: number }): string {
  const base = `${record.wins}–${record.losses}`;
  return record.pushes > 0 ? `${base}–${record.pushes}` : base;
}

export function streakOf(teamPicks: TeamPick[]): string {
  const graded = teamPicks.map(gradeOf).filter((grade) => grade === 'W' || grade === 'L');
  if (!graded.length) return '—';
  const last = graded[graded.length - 1];
  let run = 0;
  for (let i = graded.length - 1; i >= 0 && graded[i] === last; i--) run++;
  if (run < 2) return `${last}1`;
  return `${last === 'W' ? '🔥 ' : run >= 3 ? '🧊 ' : ''}${last}${run}`;
}

export interface StandingRow {
  rank: number;
  movement: number; // + up, - down vs one week earlier
  userId: string;
  name: string;
  wins: number;
  losses: number;
  pushes: number;
  record: string;
  winPct: number;
  last5: Array<'W' | 'L' | 'P'>;
  streak: string;
  isLeader: boolean;
  isLast: boolean;
}

function rankUsers(picks: Pick[], users: User[], throughWeek?: number) {
  return users
    .map((user) => {
      const teamPicks = userTeamPicks(picks, user.id, throughWeek);
      const record = calcRecord(teamPicks);
      return { user, teamPicks, record };
    })
    .sort(
      (a, b) =>
        b.record.wins - a.record.wins || b.record.pct - a.record.pct
    );
}

export function computeStandings(picks: Pick[], users: User[]): StandingRow[] {
  const now = rankUsers(picks, users);

  // Movement: compare to the ranking with the latest graded week removed
  const gradedWeeks = regularSeason(picks)
    .filter((userWeek) => userWeek.picks.some((pick) => gradeOf(pick) !== null))
    .map((userWeek) => userWeek.week);
  const latestGraded = gradedWeeks.length ? Math.max(...gradedWeeks) : 0;
  const before = rankUsers(picks, users, latestGraded - 1);
  const rankBefore = new Map(before.map((entry, index) => [entry.user.id, index + 1]));

  const anyGraded = now.some((entry) => entry.record.graded > 0);

  return now.map((entry, index) => {
    const graded = entry.teamPicks.filter((pick) => gradeOf(pick) !== null);
    return {
      rank: index + 1,
      movement: (rankBefore.get(entry.user.id) ?? index + 1) - (index + 1),
      userId: entry.user.id,
      name: entry.user.name,
      wins: entry.record.wins,
      losses: entry.record.losses,
      pushes: entry.record.pushes,
      record: recordString(entry.record),
      winPct: entry.record.pct,
      last5: graded.slice(-5).map((pick) => gradeOf(pick) as 'W' | 'L' | 'P'),
      streak: streakOf(entry.teamPicks),
      isLeader: anyGraded && index === 0,
      isLast: anyGraded && index === now.length - 1,
    };
  });
}

// Cumulative win% by week per user, for the trend chart.
export function cumulativeTrend(picks: Pick[], users: User[]) {
  const weeks = Array.from(
    new Set(
      regularSeason(picks)
        .filter((userWeek) => userWeek.picks.some((pick) => gradeOf(pick) !== null))
        .map((userWeek) => userWeek.week)
    )
  ).sort((a, b) => a - b);

  return users.map((user) => ({
    name: user.name,
    data: weeks
      .map((week) => {
        const record = calcRecord(userTeamPicks(picks, user.id, week));
        return record.graded > 0 ? { x: week, y: Math.round(record.pct * 10) / 10 } : null;
      })
      .filter(Boolean) as Array<{ x: number; y: number }>,
  }));
}
