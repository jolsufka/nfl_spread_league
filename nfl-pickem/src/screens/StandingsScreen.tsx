import React, { useEffect, useMemo, useState } from 'react';
import { CfTable, CfChart, ChartFactory } from '../charts';
import { Pick, User } from '../types';
import { computeStandings, cumulativeTrend, rankHistory, regularSeason, gradeOf, PLAYER_COLORS } from '../leagueMath';
import { getMascotName } from '../teamAssets';

interface StandingsScreenProps {
  picks: Pick[];
  users: User[];
  teamAbbreviations: { [key: string]: string };
  selectedUser: string;
  season: number;
  archive?: boolean; // final-season recap: no movement arrows or recent form
  currentWeek?: number;
  games?: Array<{ id: string; kickoff_et: string }>; // current week, for lock gating
}

const formCells = (last5: Array<'W' | 'L' | 'P'>) =>
  last5.length
    ? last5
        .map((grade) => `<span class="rescell ${grade.toLowerCase()}">${grade}</span>`)
        .join(' ')
    : '<span class="rescell o">—</span>';

export default function StandingsScreen({
  picks,
  users,
  teamAbbreviations,
  selectedUser,
  season,
  archive = false,
  currentWeek,
  games = [],
}: StandingsScreenProps) {
  const standings = useMemo(() => computeStandings(picks, users), [picks, users]);
  const trendSeries = useMemo(() => cumulativeTrend(picks, users), [picks, users]);

  // Phones can't fit 18 weekly rank dots — show 4-week checkpoints instead
  const [narrow, setNarrow] = useState(
    () => window.matchMedia('(max-width: 640px)').matches
  );
  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)');
    const onChange = (event: MediaQueryListEvent) => setNarrow(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const bumpData = useMemo(() => {
    const full = rankHistory(picks, users);
    if (!narrow) return full;
    const allPeriods = Array.from(
      new Set(full.flatMap((entity) => entity.rankings.map((ranking) => ranking.period)))
    );
    const weekNum = (period: string) => parseInt(period.replace('W', ''), 10);
    const maxWeek = Math.max(...allPeriods.map(weekNum), 1);
    const keep = new Set(
      allPeriods.filter((period) => {
        const week = weekNum(period);
        return (week - 1) % 4 === 0 || week === maxWeek;
      })
    );
    return full.map((entity) => ({
      ...entity,
      rankings: entity.rankings.filter((ranking) => keep.has(ranking.period)),
    }));
  }, [picks, users, narrow]);
  const hasGraded = standings.some((row) => row.wins + row.losses + row.pushes > 0);

  const standingsRows = useMemo(
    () =>
      standings.map((row) => ({
        rank: row.rank,
        player:
          `${row.name}` +
          (row.isLeader ? ' 👑' : '') +
          (row.isLast && !archive ? ' <span class="rescell p">🤡 last</span>' : '') +
          (row.userId === selectedUser
            ? ' <span style="font-size:0.68rem;color:var(--accent);font-weight:700">YOU</span>'
            : ''),
        move:
          row.movement > 0
            ? `<span style="color:var(--win);font-weight:700">▲${row.movement}</span>`
            : row.movement < 0
            ? `<span style="color:var(--loss);font-weight:700">▼${-row.movement}</span>`
            : '<span style="color:var(--ink-soft)">—</span>',
        record: row.record,
        winPct: Math.round(row.winPct * 10) / 10,
        last5: formCells(row.last5),
        streak: row.streak,
      })),
    [standings, selectedUser, archive]
  );

  const abbr = (team: string) =>
    teamAbbreviations[team] || getMascotName(team).substring(0, 3).toUpperCase();

  // Weekly performance heatmap: wins per player per week (0-3)
  const { heatColumns, heatRows } = useMemo(() => {
    const gradedWeeks = Array.from(
      new Set(
        regularSeason(picks)
          .filter((userWeek) => userWeek.picks.some((pick) => gradeOf(pick) !== null))
          .map((userWeek) => userWeek.week)
      )
    ).sort((a, b) => a - b);

    const heatCell = (wins: number | null) => {
      if (wins === null) return '<span class="rescell o">—</span>';
      const style =
        wins >= 3
          ? 'background:var(--accent);color:var(--accent-ink)'
          : wins === 2
          ? 'background:var(--win-bg);color:var(--win)'
          : wins === 1
          ? 'background:var(--push-bg);color:var(--push)'
          : 'background:var(--loss-bg);color:var(--loss)';
      return `<span class="rescell" style="${style}">${wins}</span>`;
    };

    const columns: any[] = [
      { key: 'player', header: 'Player', className: 'primary-cell' },
      ...gradedWeeks.map((week) => ({
        key: `w${week}`,
        header: `W${week}`,
        align: 'center',
        render: (value: any) => heatCell(value === '' || value === undefined ? null : Number(value)),
      })),
      {
        key: 'total',
        header: 'Total',
        align: 'right',
        render: (value: any) => `<b class="tnum">${value}</b>`,
      },
    ];

    const rows = standings.map((standing) => {
      const row: { [key: string]: any } = { player: standing.name, total: standing.wins };
      for (const week of gradedWeeks) {
        const userWeek = regularSeason(picks).find(
          (candidate) => candidate.userId === standing.userId && candidate.week === week
        );
        const graded = userWeek?.picks.filter((pick) => gradeOf(pick) !== null) ?? [];
        row[`w${week}`] = graded.length
          ? graded.filter((pick) => gradeOf(pick) === 'W').length
          : '';
      }
      return row;
    });

    return { heatColumns: columns, heatRows: rows };
  }, [picks, standings]);

  // Season matrix: one row per player, one column per week with picks
  const { matrixColumns, matrixRows } = useMemo(() => {
    const weeks = Array.from(
      new Set(regularSeason(picks).map((userWeek) => userWeek.week))
    ).sort((a, b) => a - b);

    const columns: any[] = [
      { key: 'player', header: 'Player', className: 'primary-cell' },
      ...weeks.map((week) => ({
        key: `w${week}`,
        header: `W${week}`,
        align: 'center',
        render: (value: string) => value || '<span class="rescell o">—</span>',
      })),
    ];

    // Picks stay hidden until their game kicks off (you always see your own)
    const now = Date.now();
    const lockedIds = new Set(
      games
        .filter((game) => new Date(game.kickoff_et).getTime() <= now)
        .map((game) => String(game.id))
    );

    const rows = users.map((user) => {
      const row: { [key: string]: string } = { player: user.name };
      for (const week of weeks) {
        const userWeek = regularSeason(picks).find(
          (candidate) => candidate.userId === user.id && candidate.week === week
        );
        if (!userWeek) continue;
        row[`w${week}`] = userWeek.picks
          .map((pick) => {
            const grade = gradeOf(pick);
            const hidden =
              !archive &&
              week === currentWeek &&
              grade === null &&
              user.id !== selectedUser &&
              !lockedIds.has(String(pick.gameId));
            if (hidden) {
              return '<span class="rescell o" title="hidden until kickoff">🔒</span>';
            }
            const cls = grade ? grade.toLowerCase() : 'o';
            const label = pick.team.startsWith('O/U')
              ? pick.team.replace('O/U:', '')
              : abbr(pick.team);
            return `<span class="rescell ${cls}">${label}</span>`;
          })
          .join(' ');
      }
      return row;
    });
    return { matrixColumns: columns, matrixRows: rows };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, users, teamAbbreviations, games, currentWeek, selectedUser, archive]);

  if (!hasGraded) {
    return (
      <div>
        <div className="sl-card" style={{ padding: '18px 20px', marginTop: 16 }}>
          <h3 className="disp" style={{ margin: 0, fontSize: '1.1rem' }}>
            No results yet
          </h3>
          <p style={{ color: 'var(--ink-soft)', margin: '6px 0 0', fontSize: '0.92rem' }}>
            Standings appear after the first {season} games are graded. Until then —
            make your picks!
          </p>
        </div>
        {matrixRows.some((row) => Object.keys(row).length > 1) && (
          <>
            <h2 className="sl-sec">Picks so far</h2>
            <div className="sl-card" style={{ padding: '4px 12px' }}>
              <CfTable
                columns={matrixColumns}
                rows={matrixRows}
                options={{ stickyHeader: true, stickyFirstColumn: true, layout: 'fill' }}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className={archive ? 'sl-plain' : ''}
        style={archive ? { width: 'fit-content', maxWidth: '100%', margin: '0 auto' } : {}}
      >
        <h2 className="sl-sec">Standings</h2>
        <div className={archive ? '' : 'sl-card'} style={archive ? {} : { padding: '4px 12px' }}>
        <CfTable
          sortable
          columns={[
            { key: 'rank', header: '#', className: 'secondary-cell', sortable: true, sortType: 'numeric' },
            ...(archive ? [] : [{ key: 'move', header: '', render: (value: string) => value }]),
            { key: 'player', header: 'Player', className: 'primary-cell', render: (value: string) => value },
            { key: 'record', header: 'Record', align: 'right', sortable: true, sortType: 'record' },
            { key: 'winPct', header: 'Win %', align: 'right', sortable: true, sortType: 'numeric' },
            ...(archive
              ? []
              : [
                  { key: 'last5', header: 'Last 5', align: 'right', render: (value: string) => value },
                  { key: 'streak', header: 'Streak', align: 'right' },
                ]),
          ]}
          rows={standingsRows}
          options={{
            stickyHeader: !archive,
            layout: archive ? 'fixed' : 'fill',
            barColumns: [{ key: 'winPct' }],
          }}
        />
        </div>
      </div>

      <h2 className="sl-sec sl-breakout">Weekly performance</h2>
      <div className="sl-card sl-breakout sl-tight" style={{ padding: '4px 12px' }}>
        <CfTable
          columns={heatColumns}
          rows={heatRows}
          options={{ stickyHeader: true, stickyFirstColumn: true }}
        />
      </div>

      <h2 className={`sl-sec${archive ? ' sl-breakout' : ''}`}>Cumulative win %</h2>
      <div className={`sl-card${archive ? ' sl-breakout' : ''}`} style={{ padding: 14 }}>
        <CfChart
          create={(el, config) => ChartFactory.Line.createMulti(el, config)}
          config={{
            series: trendSeries,
            maxHeight: 520,
            seriesLabels: true,
            endDots: true,
            legend: {
              items: users.map((user) => user.name),
              colors: PLAYER_COLORS.slice(0, users.length),
              interactive: true,
            },
            yMin: 0,
            yMax: 100,
            annotations: [{ type: 'yLine', value: 50 }],
          }}
        />
      </div>

      <h2 className={`sl-sec${archive ? ' sl-breakout' : ''}`}>Rank by week</h2>
      <div className={`sl-card${archive ? ' sl-breakout' : ''}`} style={{ padding: 14 }}>
        <CfChart
          create={(el, config) => ChartFactory.Line.createBumpChart(el, config)}
          config={{
            data: bumpData,
            colors: PLAYER_COLORS.slice(0, users.length),
            maxHeight: 280,
          }}
        />
      </div>

      <h2 className={`sl-sec${archive ? ' sl-breakout' : ''}`}>Season matrix</h2>
      <div className={`sl-card${archive ? ' sl-breakout' : ''}`} style={{ padding: '4px 12px' }}>
        <CfTable
          columns={matrixColumns}
          rows={matrixRows}
          options={{ stickyHeader: true, stickyFirstColumn: true, layout: 'fill' }}
        />
      </div>
      <p style={{ color: 'var(--ink-soft)', fontSize: '0.78rem', margin: '10px 2px' }}>
        Pushes count as picks made but not wins — the 2–0 with a push is 66.7%, house rules.
      </p>
    </div>
  );
}
