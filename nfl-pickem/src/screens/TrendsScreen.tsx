import React, { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { CfTable, CfChart, ChartFactory } from '../charts';
import { Pick, User } from '../types';
import {
  GameResult,
  PLAYER_COLORS,
  SPREAD_BUCKETS,
  consensusPicks,
  fmtSpread,
  signed,
  splitStat,
  trendPicks,
} from '../leagueMath';
import { getMascotName } from '../teamAssets';

interface TrendsScreenProps {
  picks: Pick[];
  users: User[];
  currentWeek: number;
}

// Final scores for every graded week (the results CSVs the grader publishes).
async function loadResults(throughWeek: number): Promise<GameResult[]> {
  const weeks = Array.from({ length: throughWeek }, (_, index) => index + 1);
  const perWeek = await Promise.all(
    weeks.map(async (week) => {
      const response = await fetch(`${process.env.PUBLIC_URL}/results/nfl_results_week${week}.csv`);
      if (!response.ok) return [];
      const parsed = Papa.parse<any>(await response.text(), { header: true, skipEmptyLines: true });
      return parsed.data
        .filter((row) => row.game_id && row.away_score !== '' && row.home_score !== '')
        .map((row) => ({
          week,
          gameId: String(row.game_id),
          away: row.away,
          home: row.home,
          awayScore: Number(row.away_score),
          homeScore: Number(row.home_score),
        }));
    })
  );
  return perWeek.flat();
}

const pctLabel = (pct: number) => `${pct.toFixed(1)}%`;
const marginClass = (value: number) => (value > 0 ? 'pos' : value < 0 ? 'neg' : '');

function Tile({ label, stat, note }: { label: string; stat: ReturnType<typeof splitStat>; note?: string }) {
  return (
    <div className="sl-card trend-tile">
      <span className="trend-tile-label">{label}</span>
      <span className="trend-tile-num tnum">{stat.graded ? pctLabel(stat.pct) : '—'}</span>
      <span className="trend-tile-sub tnum">
        {stat.record}
        {note ? ` · ${note}` : <> · <span className={marginClass(stat.margin)}>{signed(stat.margin)}</span> pts</>}
      </span>
    </div>
  );
}

export default function TrendsScreen({ picks, users, currentWeek }: TrendsScreenProps) {
  const [results, setResults] = useState<GameResult[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadResults(currentWeek).then((rows) => {
      if (!cancelled) setResults(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [currentWeek]);

  const rows = useMemo(() => trendPicks(picks, users, results ?? []), [picks, users, results]);

  const stats = useMemo(() => {
    const consensus = consensusPicks(rows);
    const lastWeek = rows.reduce((max, row) => Math.max(max, row.week), 0);
    return {
      lastWeek,
      all: splitStat(rows),
      fav: splitStat(rows.filter((row) => row.favorite)),
      dog: splitStat(rows.filter((row) => !row.favorite)),
      home: splitStat(rows.filter((row) => row.home)),
      away: splitStat(rows.filter((row) => !row.home)),
      consensus: splitStat(consensus),
      consensusRows: consensus,
      lostClose: rows.filter((row) => row.cover < 0 && row.cover >= -1.5).length,
      wonClose: rows.filter((row) => row.cover > 0 && row.cover <= 1.5).length,
    };
  }, [rows]);

  // Cover rate by spread size, favorites vs underdogs
  const bucketRows = useMemo(
    () =>
      SPREAD_BUCKETS.map((bucket) => {
        const inBucket = rows.filter((row) => bucket.test(Math.abs(row.spread)));
        const fav = splitStat(inBucket.filter((row) => row.favorite));
        const dog = splitStat(inBucket.filter((row) => !row.favorite));
        return { category: `${bucket.label} pts`, Favorites: fav.pct, Underdogs: dog.pct, fav, dog };
      }),
    [rows]
  );

  // Share of each player's picks on favorites
  const favShareRows = useMemo(
    () =>
      users
        .map((user) => {
          const mine = rows.filter((row) => row.userId === user.id);
          const favs = mine.filter((row) => row.favorite);
          const share = mine.length ? (favs.length / mine.length) * 100 : 0;
          return {
            category: user.name,
            Favorites: share,
            Underdogs: mine.length ? 100 - share : 0,
            fav: splitStat(favs),
            dog: splitStat(mine.filter((row) => !row.favorite)),
          };
        })
        .filter((row) => row.fav.graded + row.dog.graded > 0)
        .sort((a, b) => b.Favorites - a.Favorites),
    [rows, users]
  );

  // Running cover margin per player
  const marginSeries = useMemo(() => {
    const weeks = Array.from(new Set(rows.map((row) => row.week))).sort((a, b) => a - b);
    return users.map((user, index) => {
      let running = 0;
      return {
        name: user.name,
        color: PLAYER_COLORS[index % PLAYER_COLORS.length],
        data: weeks.map((week) => {
          running += rows
            .filter((row) => row.userId === user.id && row.week === week)
            .reduce((sum, row) => sum + row.cover, 0);
          return { x: week, y: Math.round(running * 10) / 10 };
        }),
      };
    });
  }, [rows, users]);

  const swarmRows = useMemo(
    () =>
      rows.map((row) => ({
        category: row.name,
        value: row.cover,
        name: `${row.name}: ${getMascotName(row.team)} ${fmtSpread(row.spread)}, wk ${row.week}`,
        result: row.result,
        final: `${row.teamScore}–${row.oppScore} vs ${getMascotName(row.opponent)}`,
      })),
    [rows]
  );

  const weeklyRows = useMemo(() => {
    const weeks = Array.from(new Set(rows.map((row) => row.week))).sort((a, b) => a - b);
    return weeks.map((week) => {
      const stat = splitStat(rows.filter((row) => row.week === week));
      return { x: `Wk ${week}`, y: stat.pct, stat };
    });
  }, [rows]);

  const teamRows = useMemo(() => {
    const teams = Array.from(new Set(rows.map((row) => row.team)));
    return teams
      .map((team) => {
        const mine = rows.filter((row) => row.team === team);
        const stat = splitStat(mine);
        return {
          team,
          picks: mine.length,
          record: stat.record,
          margin: Math.round(stat.margin * 10) / 10,
          who: Array.from(new Set(mine.map((row) => row.name))).sort().join(', '),
        };
      })
      .sort((a, b) => b.picks - a.picks || b.margin - a.margin);
  }, [rows]);

  const extremes = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.cover - a.cover);
    const toRow = (row: (typeof rows)[number]) => ({
      player: row.name,
      week: row.week,
      pick: `${getMascotName(row.team)} ${fmtSpread(row.spread)}`,
      final: `${row.teamScore}–${row.oppScore} vs ${getMascotName(row.opponent)}`,
      margin: row.cover,
    });
    return { best: sorted.slice(0, 5).map(toRow), worst: sorted.slice(-5).reverse().map(toRow) };
  }, [rows]);

  const consensusRows = useMemo(
    () =>
      stats.consensusRows.map((row) => ({
        week: row.week,
        pick: `${getMascotName(row.team)} ${fmtSpread(row.spread)}`,
        players: row.players.length,
        result: row.result,
        margin: row.cover,
      })),
    [stats.consensusRows]
  );

  // Scores are in but picks haven't arrived from Supabase yet
  if (results === null || (results.length > 0 && picks.length === 0)) {
    return <p style={{ color: 'var(--ink-soft)', marginTop: 24 }}>Loading trends…</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="sl-card" style={{ padding: '18px 20px', marginTop: 16 }}>
        <h3 className="disp" style={{ margin: 0, fontSize: '1.1rem' }}>No graded games yet</h3>
        <p style={{ color: 'var(--ink-soft)', margin: '6px 0 0', fontSize: '0.92rem' }}>
          Trends show up once the first week is graded.
        </p>
      </div>
    );
  }

  const tip = ChartFactory.TooltipManager;
  const marginCell = (value: number) =>
    `<span class="trend-${marginClass(value) || 'flat'}">${signed(value)}</span>`;
  const resultCell = (value: string) => `<span class="rescell ${value.toLowerCase()}">${value}</span>`;
  // Win % on one side, green/red around .500; '—' when the player never picked that side
  const sidePct = (value: number | null) =>
    value === null
      ? '—'
      : `<span class="trend-${value > 50 ? 'pos' : value < 50 ? 'neg' : 'flat'}">${value.toFixed(0)}%</span>`;
  const sideRows = favShareRows.map((row) => {
    const total = row.fav.graded + row.dog.graded;
    return {
      player: row.category,
      favPicked: row.Favorites,
      favPickedLabel: `${row.fav.graded} of ${total} (${row.Favorites.toFixed(0)}%)`,
      favRecord: row.fav.record,
      favPct: row.fav.graded ? row.fav.pct : null,
      dogRecord: row.dog.record,
      dogPct: row.dog.graded ? row.dog.pct : null,
    };
  });
  const marginColumn = { key: 'margin', header: 'Margin', align: 'right', sortable: true, sortType: 'numeric', render: marginCell };

  return (
    <div className="trends">
      <p className="trend-lede">
        Through week {stats.lastWeek}, the league is <b>{stats.all.record}</b> against the spread (
        <b>{pctLabel(stats.all.pct)}</b>), with a combined cover margin of{' '}
        <b className={marginClass(stats.all.margin)}>{signed(stats.all.margin)}</b> points.
      </p>

      <div className="trend-tiles">
        <Tile label="League, all picks" stat={stats.all} />
        <Tile label="Picking favorites" stat={stats.fav} />
        <Tile label="Picking underdogs" stat={stats.dog} />
        <Tile label="Picking home teams" stat={stats.home} />
        <Tile label="Picking road teams" stat={stats.away} />
        <Tile label="Consensus (3+ agree)" stat={stats.consensus} note="once per game" />
      </div>

      <h2 className="sl-sec">Favorites vs. underdogs</h2>
      <div className="sl-card trend-card">
        <h3 className="trend-h3">How our picks covered, by size of the spread</h3>
        <p className="trend-note">
          Every league pick combined, not every NFL game: how often the favorites and underdogs we picked
          covered at each spread size. The dashed line is 50%. Hover a bar for the record.
        </p>
        <CfChart
          create={(el, config) => ChartFactory.Bar.createGrouped(el, config)}
          config={{
            data: bucketRows,
            keys: ['Favorites', 'Underdogs'],
            xMax: 100,
            legend: { interactive: false },
            valueFormat: (value: number) => `${value.toFixed(0)}%`,
            annotations: [{ type: 'xLine', value: 50 }],
            tooltipContent: (row: any) =>
              tip.rows([
                { title: `${row.category} spreads` },
                { label: 'Favorites', value: `${pctLabel(row.fav.pct)} · ${row.fav.record}` },
                { label: 'Underdogs', value: `${pctLabel(row.dog.pct)} · ${row.dog.record}` },
              ]),
          }}
        />
      </div>

      <div className="sl-card trend-card trend-table">
        <h3 className="trend-h3">Who picks favorites, and how it goes</h3>
        <p className="trend-note">
          How many of your picks were favorites, then your win % on each side. Green is above 50%.
        </p>
        <CfTable
          sortable
          columns={[
            { key: 'player', header: 'Player', className: 'primary-cell' },
            { key: 'favPicked', header: 'Favs picked', align: 'right', sortable: true, sortType: 'numeric', render: (_v: number, row: any) => row.favPickedLabel },
            { key: 'favRecord', header: 'Record', group: 'On favorites', align: 'right' },
            { key: 'favPct', header: 'Win %', group: 'On favorites', align: 'right', sortable: true, sortType: 'numeric', render: sidePct },
            { key: 'dogRecord', header: 'Record', group: 'On underdogs', align: 'right' },
            { key: 'dogPct', header: 'Win %', group: 'On underdogs', align: 'right', sortable: true, sortType: 'numeric', render: sidePct },
          ]}
          rows={sideRows}
          options={{ layout: 'fill' }}
        />
      </div>

      <h2 className="sl-sec">Points beaten and lost</h2>
      <div className="sl-card trend-card">
        <h3 className="trend-h3">Running cover margin</h3>
        <p className="trend-note">
          Every pick's points over or under its spread, added up week by week. Above zero means your
          picks have beaten the number on balance.
        </p>
        <CfChart
          create={(el, config) => ChartFactory.Line.createMulti(el, config)}
          config={{
            series: marginSeries,
            maxHeight: 460,
            seriesLabels: true,
            seriesLabelFormat: ({ series, value }: any) => `${series.name} ${signed(value)}`,
            endDots: true,
            xFormat: (week: number) => `Wk ${week}`,
            xTickValues: marginSeries[0]?.data.map((point) => point.x),
            tooltipValueFormat: (value: number) => signed(value),
            tooltipSortRows: true,
            labelFormat: (week: number) => `Through week ${week}`,
            annotations: [{ type: 'yLine', value: 0 }],
          }}
        />
      </div>

      <div className="sl-card trend-card">
        <h3 className="trend-h3">Every pick against the spread</h3>
        <p className="trend-note">
          One dot per pick, placed by how many points it beat or missed the spread by.{' '}
          <b>{stats.lostClose}</b> picks lost by 1.5 points or less; only <b>{stats.wonClose}</b> won by
          that little.
        </p>
        <CfChart
          create={(el, config) => ChartFactory.Scatter.createBeeswarm(el, config)}
          config={{
            data: swarmRows,
            colorAccessor: (row: any) =>
              row.result === 'W' ? 'var(--win)' : row.result === 'L' ? 'var(--loss)' : 'var(--push)',
            valueFormat: (value: number) => (value > 0 ? `+${value}` : `${value}`),
            annotations: [{ type: 'xLine', value: 0 }],
            tooltipContent: (row: any) =>
              tip.rows([
                { title: row.name },
                { label: 'Final', value: row.final },
                { label: 'Margin', value: signed(row.value) },
              ]),
          }}
        />
      </div>

      <div className="sl-card trend-card">
        <h3 className="trend-h3">League cover rate by week</h3>
        <p className="trend-note">All players' picks combined. Bars at or above the line were winning weeks.</p>
        <CfChart
          create={(el, config) => ChartFactory.Bar.createVertical(el, config)}
          config={{
            data: weeklyRows,
            aspectRatio: 2.6,
            yMax: 100,
            yFormat: (value: number) => `${value}%`,
            valueFormat: (_value: number, row: any) => row.stat.record,
            color: (value: number) => (value >= 50 ? 'var(--win)' : 'var(--chart-neutral)'),
            annotations: [{ type: 'yLine', value: 50 }],
            tooltipContent: (row: any) =>
              tip.rows([
                { title: `Week ${row.x.replace('Wk ', '')}` },
                { label: 'Record', value: row.stat.record },
                { label: 'Cover rate', value: pctLabel(row.stat.pct) },
                { label: 'Cover margin', value: signed(row.stat.margin) },
              ]),
          }}
        />
      </div>

      <h2 className="sl-sec">Teams</h2>
      <div className="sl-card trend-card trend-table">
        <h3 className="trend-h3">Most picked teams</h3>
        <p className="trend-note">How the league has done every time it backed each team.</p>
        <CfTable
          sortable
          columns={[
            { key: 'team', header: 'Team', className: 'primary-cell', render: (team: string) => getMascotName(team) },
            { key: 'picks', header: 'Picks', align: 'right', sortable: true, sortType: 'numeric' },
            { key: 'record', header: 'Record', align: 'right', sortable: true, sortType: 'record' },
            marginColumn,
            { key: 'who', header: 'Who', className: 'secondary-cell trend-who' },
          ]}
          rows={teamRows}
          options={{ stickyHeader: true, layout: 'fill', maxRows: 12 }}
        />
      </div>

      <div className="sl-card trend-card trend-table">
        <h3 className="trend-h3">Consensus picks</h3>
        <p className="trend-note">Every game where three or more of you took the same side.</p>
        <CfTable
          columns={[
            { key: 'week', header: 'Wk', align: 'right' },
            { key: 'pick', header: 'Pick', className: 'primary-cell' },
            { key: 'players', header: 'Players', align: 'right' },
            { key: 'result', header: 'Result', align: 'center', render: resultCell },
            marginColumn,
          ]}
          rows={consensusRows}
          options={{ layout: 'fill' }}
        />
      </div>

      <h2 className="sl-sec">Biggest covers and worst beats</h2>
      {(['best', 'worst'] as const).map((kind) => (
        <div key={kind} className="sl-card trend-card trend-table">
          <h3 className="trend-h3">{kind === 'best' ? 'Biggest covers' : 'Worst beats'}</h3>
          <CfTable
            columns={[
              { key: 'player', header: 'Player', className: 'primary-cell' },
              { key: 'week', header: 'Wk', align: 'right' },
              { key: 'pick', header: 'Pick' },
              { key: 'final', header: 'Final', className: 'secondary-cell' },
              marginColumn,
            ]}
            rows={extremes[kind]}
            options={{ layout: 'fill' }}
          />
        </div>
      ))}

      <p style={{ color: 'var(--ink-soft)', fontSize: '0.78rem', margin: '10px 2px' }}>
        Records are W–L–P; pushes count as picks made but not wins. Cover margin uses the spread each
        pick was saved at.
      </p>
    </div>
  );
}
