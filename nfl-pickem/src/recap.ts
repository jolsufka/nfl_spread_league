// Weekly superlatives ("recap card") math. Records route through calcRecord
// (the house push rule), and every cover margin is measured against the
// pick's own saved spread — line movement after a pick never changes it.
import { Pick, TeamPick, User } from './types';
import { calcRecord } from './seasonConfig';
import { gradeOf, recordString, regularSeason } from './leagueMath';

export interface GameScore {
  gameId: string;
  away: string;
  home: string;
  awayScore: number;
  homeScore: number;
}

export interface AwardWinner {
  userId: string;
  name: string;
  detail: string;
}

export interface Award {
  key: 'sharpest' | 'badBeat' | 'loneWolf' | 'chalk' | 'dog';
  emoji: string;
  title: string;
  winners: AwardWinner[];
}

// The week the card recaps: latest regular-season week with official grades.
export function latestGradedWeek(picks: Pick[]): number | null {
  const weeks = regularSeason(picks)
    .filter((userWeek) => userWeek.picks.some((pick) => gradeOf(pick) !== null))
    .map((userWeek) => userWeek.week);
  return weeks.length ? Math.max(...weeks) : null;
}

const isTeamPick = (pick: TeamPick) => !pick.team.startsWith('O/U');

// Picked team's final margin plus their saved spread: positive covers,
// negative misses, zero pushes. Null when the final score is unknown.
export function coverMargin(pick: TeamPick, scores: Map<string, GameScore>): number | null {
  if (!isTeamPick(pick)) return null;
  const score = scores.get(String(pick.gameId));
  if (!score) return null;
  const isHome = score.home === pick.team;
  if (!isHome && score.away !== pick.team) return null;
  const margin = isHome
    ? score.homeScore - score.awayScore
    : score.awayScore - score.homeScore;
  return margin + pick.spread;
}

// A loss only counts as a bad beat when it missed by this much or less
export const BAD_BEAT_MAX_MISS = 3;

const fmtNum = (value: number) => `${Math.round(Math.abs(value) * 10) / 10}`;
const fmtSpread = (spread: number) => (spread > 0 ? `+${spread}` : `${spread}`);

interface Entry {
  user: User;
  graded: TeamPick[];
  record: ReturnType<typeof calcRecord>;
}

export function computeSuperlatives(
  picks: Pick[],
  users: User[],
  week: number,
  scores: Map<string, GameScore>,
  abbr: (team: string) => string
): Award[] {
  const entries: Entry[] = users
    .map((user) => {
      const userWeek = regularSeason(picks).find(
        (candidate) => candidate.userId === user.id && candidate.week === week
      );
      const graded = (userWeek?.picks ?? []).filter((pick) => gradeOf(pick) !== null);
      return { user, graded, record: calcRecord(graded) };
    })
    .filter((entry) => entry.graded.length > 0);
  if (!entries.length) return [];

  const awards: Award[] = [];

  // 🎯 Sharpest — best record of the week (wins first, then the push rule
  // via pct). Skipped when the whole league ties: no separation, no award.
  const byRecord = [...entries].sort(
    (a, b) => b.record.wins - a.record.wins || b.record.pct - a.record.pct
  );
  const top = byRecord[0].record;
  const sharpest = entries.filter(
    (entry) => entry.record.wins === top.wins && entry.record.pct === top.pct
  );
  if (sharpest.length < entries.length || entries.length === 1) {
    awards.push({
      key: 'sharpest',
      emoji: '🎯',
      title: 'Sharpest',
      winners: sharpest.map((entry) => {
        const margins = entry.graded
          .map((pick) => coverMargin(pick, scores))
          .filter((margin): margin is number => margin !== null);
        const net =
          margins.length && margins.length === entry.graded.filter(isTeamPick).length
            ? margins.reduce((sum, margin) => sum + margin, 0)
            : null;
        return {
          userId: entry.user.id,
          name: entry.user.name,
          detail:
            `went ${recordString(entry.record)}` +
            (net !== null ? ` · net cover ${net < 0 ? '−' : '+'}${fmtNum(net)}` : ''),
        };
      }),
    });
  }

  // 💔 Bad beat — the closest loss of the week, and only if it was actually
  // close: a field goal or less. A week of blowouts has no bad beat.
  // (Needs final scores.)
  const beats: Array<{ entry: Entry; pick: TeamPick; margin: number }> = [];
  for (const entry of entries)
    for (const pick of entry.graded) {
      if (gradeOf(pick) !== 'L') continue;
      const margin = coverMargin(pick, scores);
      if (margin !== null && margin < 0 && -margin <= BAD_BEAT_MAX_MISS)
        beats.push({ entry, pick, margin });
    }
  if (beats.length) {
    const closest = Math.max(...beats.map((beat) => beat.margin));
    awards.push({
      key: 'badBeat',
      emoji: '💔',
      title: 'Bad beat',
      winners: beats
        .filter((beat) => beat.margin === closest)
        .map(({ entry, pick, margin }) => {
          const score = scores.get(String(pick.gameId))!;
          const isHome = score.home === pick.team;
          const scoreText = isHome
            ? `${score.homeScore}–${score.awayScore}`
            : `${score.awayScore}–${score.homeScore}`;
          return {
            userId: entry.user.id,
            name: entry.user.name,
            detail: `${abbr(pick.team)} ${fmtSpread(pick.spread)} · missed by ${fmtNum(margin)} (${scoreText})`,
          };
        }),
    });
  }

  // 🐺 Lone wolf — the only one on that side, and it hit. The wolf who faded
  // the most opposite-side picks wins; cover margin breaks remaining ties.
  const wolves: Array<{ entry: Entry; pick: TeamPick; faded: number; margin: number | null }> = [];
  for (const entry of entries)
    for (const pick of entry.graded) {
      if (!isTeamPick(pick) || gradeOf(pick) !== 'W') continue;
      let same = 0;
      let faded = 0;
      for (const other of entries)
        for (const otherPick of other.graded) {
          if (String(otherPick.gameId) !== String(pick.gameId) || !isTeamPick(otherPick))
            continue;
          if (otherPick.team === pick.team) same++;
          else faded++;
        }
      if (same === 1) wolves.push({ entry, pick, faded, margin: coverMargin(pick, scores) });
    }
  if (wolves.length) {
    wolves.sort((a, b) => b.faded - a.faded || (b.margin ?? 0) - (a.margin ?? 0));
    const alpha = wolves[0];
    awards.push({
      key: 'loneWolf',
      emoji: '🐺',
      title: 'Lone wolf',
      winners: wolves
        .filter((wolf) => wolf.faded === alpha.faded && (wolf.margin ?? 0) === (alpha.margin ?? 0))
        .map(({ entry, pick, faded, margin }) => ({
          userId: entry.user.id,
          name: entry.user.name,
          detail:
            `only one on ${abbr(pick.team)} ${fmtSpread(pick.spread)}` +
            (faded > 0 ? `, fading ${faded}` : '') +
            (margin !== null ? ` · covered by ${fmtNum(margin)}` : ''),
        })),
    });
  }

  // 🐑 Chalk eater — most favorites on the card (needs real separation)
  const favEntries = entries.map((entry) => ({
    entry,
    favs: entry.graded.filter((pick) => isTeamPick(pick) && pick.spread < 0),
  }));
  const favCounts = favEntries.map((candidate) => candidate.favs.length);
  const maxFavs = Math.max(...favCounts);
  if (maxFavs >= 2 && maxFavs !== Math.min(...favCounts)) {
    awards.push({
      key: 'chalk',
      emoji: '🐑',
      title: 'Chalk eater',
      winners: favEntries
        .filter((candidate) => candidate.favs.length === maxFavs)
        .map(({ entry, favs }) => ({
          userId: entry.user.id,
          name: entry.user.name,
          detail: `${favs.length} of ${entry.graded.length} on favorites · went ${recordString(calcRecord(favs))}`,
        })),
    });
  }

  // 🐶 Dog whisperer — best underdog record; a dog win is required to qualify
  const dogEntries = entries.map((entry) => {
    const dogs = entry.graded.filter((pick) => isTeamPick(pick) && pick.spread > 0);
    return { entry, record: calcRecord(dogs) };
  });
  const bestDog = [...dogEntries].sort(
    (a, b) => b.record.wins - a.record.wins || b.record.pct - a.record.pct
  )[0];
  if (bestDog && bestDog.record.wins > 0) {
    awards.push({
      key: 'dog',
      emoji: '🐶',
      title: 'Dog whisperer',
      winners: dogEntries
        .filter(
          (candidate) =>
            candidate.record.wins === bestDog.record.wins &&
            candidate.record.pct === bestDog.record.pct
        )
        .map(({ entry, record }) => ({
          userId: entry.user.id,
          name: entry.user.name,
          detail: `${recordString(record)} with underdogs`,
        })),
    });
  }

  return awards;
}
