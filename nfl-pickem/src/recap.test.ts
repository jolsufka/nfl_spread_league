import { GameScore, computeSuperlatives, coverMargin, latestGradedWeek } from './recap';
import { Pick, TeamPick, User } from './types';

const mkUser = (id: string, name: string): User => ({ id, name, total: 0, percentage: 0 });

const mkPick = (
  gameId: string,
  team: string,
  spread: number,
  result: 'W' | 'L' | 'P' | null
): TeamPick => ({ gameId, team, spread, result });

const mkWeek = (userId: string, week: number, picks: TeamPick[]): Pick => ({
  userId,
  week,
  picks,
  correct: 0,
});

const score = (
  gameId: string,
  away: string,
  awayScore: number,
  home: string,
  homeScore: number
): [string, GameScore] => [gameId, { gameId, away, home, awayScore, homeScore }];

const abbr = (team: string) => team;

// Week 1 fixture: Bills 27–20 Jets, Bengals 24–21 Chiefs, Eagles 30–10
// Cowboys, Packers 20–17 Lions.
const scores = new Map<string, GameScore>([
  score('1', 'Jets', 20, 'Bills', 27),
  score('2', 'Bengals', 24, 'Chiefs', 21),
  score('3', 'Cowboys', 10, 'Eagles', 30),
  score('4', 'Lions', 17, 'Packers', 20),
]);

const users = [mkUser('jacob', 'Jacob'), mkUser('cam', 'Cam'), mkUser('nathan', 'Nathan')];

const picks: Pick[] = [
  mkWeek('jacob', 1, [
    mkPick('1', 'Bills', -3.5, 'W'),
    mkPick('2', 'Chiefs', -6.5, 'L'),
    mkPick('3', 'Eagles', -7, 'W'),
  ]),
  mkWeek('cam', 1, [
    mkPick('2', 'Bengals', 3.5, 'W'),
    mkPick('1', 'Jets', 6.5, 'L'),
    mkPick('4', 'Packers', -2.5, 'W'),
  ]),
  mkWeek('nathan', 1, [
    mkPick('3', 'Cowboys', 6.5, 'L'),
    mkPick('1', 'Bills', -3.5, 'W'),
    mkPick('4', 'Lions', 3, 'P'),
  ]),
  // Week 2 exists but is ungraded — the recap must stay on week 1
  mkWeek('jacob', 2, [mkPick('1', 'Bills', -2.5, null)]),
];

const awardsByKey = (all: ReturnType<typeof computeSuperlatives>) => {
  const map: { [key: string]: (typeof all)[number] } = {};
  for (const award of all) map[award.key] = award;
  return map;
};

test('latestGradedWeek ignores ungraded weeks', () => {
  expect(latestGradedWeek(picks)).toBe(1);
  expect(latestGradedWeek([mkWeek('jacob', 2, [mkPick('1', 'Bills', -2.5, null)])])).toBeNull();
});

test('coverMargin measures against the pick’s own spread', () => {
  // Home favorite: won by 7, laid 3.5
  expect(coverMargin(mkPick('1', 'Bills', -3.5, 'W'), scores)).toBe(3.5);
  // Away dog: lost by 7, got 6.5 — the half-point bad beat
  expect(coverMargin(mkPick('1', 'Jets', 6.5, 'L'), scores)).toBe(-0.5);
  // Unknown game or an O/U pick has no margin
  expect(coverMargin(mkPick('99', 'Bills', -3.5, 'W'), scores)).toBeNull();
  expect(coverMargin(mkPick('1', 'O/U:OVER', 44.5, 'W'), scores)).toBeNull();
});

test('week 1 superlatives: winners, margins, and the push rule', () => {
  const awards = awardsByKey(computeSuperlatives(picks, users, 1, scores, abbr));

  // Sharpest: Jacob and Cam tie at 2–1; Nathan's push keeps him at 1/3
  expect(awards.sharpest.winners.map((w) => w.name).sort()).toEqual(['Cam', 'Jacob']);
  expect(awards.sharpest.winners.find((w) => w.name === 'Jacob')!.detail).toBe(
    'went 2–1 · net cover +7'
  );

  // Bad beat: Jets +6.5 lost by 7 — missed by half a point
  expect(awards.badBeat.winners).toEqual([
    { userId: 'cam', name: 'Cam', detail: 'Jets +6.5 · missed by 0.5 (20–27)' },
  ]);

  // Lone wolf: three wolves each faded one opponent (Eagles, Bengals,
  // Packers) — Jacob's Eagles pick covered by the most and takes it
  expect(awards.loneWolf.winners).toEqual([
    { userId: 'jacob', name: 'Jacob', detail: 'only one on Eagles -7, fading 1 · covered by 13' },
  ]);

  // Chalk eater: Jacob laid points all three times
  expect(awards.chalk.winners).toEqual([
    { userId: 'jacob', name: 'Jacob', detail: '3 of 3 on favorites · went 2–1' },
  ]);

  // Dog whisperer: Cam has the only underdog win; Nathan's push isn't one
  expect(awards.dog.winners).toEqual([
    { userId: 'cam', name: 'Cam', detail: '1–1 with underdogs' },
  ]);
});

test('sharpest applies the house push rule: 3–0 beats 2–0–1', () => {
  const twoUsers = [mkUser('jacob', 'Jacob'), mkUser('cam', 'Cam')];
  const weekPicks = [
    mkWeek('jacob', 1, [
      mkPick('1', 'Bills', -3.5, 'W'),
      mkPick('2', 'Bengals', 3.5, 'W'),
      mkPick('4', 'Lions', 3, 'P'),
    ]),
    mkWeek('cam', 1, [
      mkPick('1', 'Bills', -3.5, 'W'),
      mkPick('2', 'Bengals', 3.5, 'W'),
      mkPick('3', 'Eagles', -7, 'W'),
    ]),
  ];
  const awards = awardsByKey(computeSuperlatives(weekPicks, twoUsers, 1, new Map(), abbr));
  expect(awards.sharpest.winners).toHaveLength(1);
  expect(awards.sharpest.winners[0].name).toBe('Cam');
});

test('degrades without a results file: no bad beat, no margin garnish', () => {
  const awards = awardsByKey(computeSuperlatives(picks, users, 1, new Map(), abbr));
  expect(awards.badBeat).toBeUndefined();
  expect(awards.sharpest.winners.find((w) => w.name === 'Jacob')!.detail).toBe('went 2–1');
  // Without margins the three one-fade wolves can't be split — all share it
  expect(awards.loneWolf.winners).toHaveLength(3);
  expect(awards.loneWolf.winners[0].detail).toBe('only one on Eagles -7, fading 1');
});

test('awards with no separation or no qualifier are skipped', () => {
  const twoUsers = [mkUser('jacob', 'Jacob'), mkUser('cam', 'Cam')];
  // Identical cards: no sharpest split, one favorite each (no chalk), and
  // the only dog pick lost (no whisperer) — but that loss was a half-point
  // bad beat they share
  const weekPicks = [
    mkWeek('jacob', 1, [mkPick('1', 'Bills', -3.5, 'W'), mkPick('1', 'Jets', 6.5, 'L')]),
    mkWeek('cam', 1, [mkPick('1', 'Bills', -3.5, 'W'), mkPick('1', 'Jets', 6.5, 'L')]),
  ];
  const awards = computeSuperlatives(weekPicks, twoUsers, 1, scores, abbr);
  expect(awards.map((award) => award.key)).toEqual(['badBeat']);
  expect(awards[0].winners).toHaveLength(2);
});

test('bad beat needs a close loss — a blowout is not a bad beat', () => {
  const twoUsers = [mkUser('jacob', 'Jacob'), mkUser('cam', 'Cam')];
  // Chiefs -6.5 lost outright by 3 (missed by 9.5); Cowboys +6.5 lost by
  // 20 (missed by 13.5). Closest loss of the week, still not close.
  const weekPicks = [
    mkWeek('jacob', 1, [mkPick('1', 'Bills', -3.5, 'W'), mkPick('2', 'Chiefs', -6.5, 'L')]),
    mkWeek('cam', 1, [mkPick('1', 'Bills', -3.5, 'W'), mkPick('3', 'Cowboys', 6.5, 'L')]),
  ];
  const awards = awardsByKey(computeSuperlatives(weekPicks, twoUsers, 1, scores, abbr));
  expect(awards.badBeat).toBeUndefined();

  // Right at the field-goal line it still counts: Lions +3 lost by 6, a
  // miss of exactly 3
  const edge = new Map<string, GameScore>([score('4', 'Lions', 14, 'Packers', 20)]);
  const edgePicks = [mkWeek('jacob', 1, [mkPick('4', 'Lions', 3, 'L')])];
  const edgeAwards = awardsByKey(computeSuperlatives(edgePicks, [twoUsers[0]], 1, edge, abbr));
  expect(edgeAwards.badBeat.winners[0].detail).toBe('Lions +3 · missed by 3 (14–20)');
});
