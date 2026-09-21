import React, { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { Pick, User } from '../types';
import { calcRecord } from '../seasonConfig';
import {
  gradeOf,
  playerColorById,
  playerInkById,
  playerInitials,
  recordString,
  regularSeason,
} from '../leagueMath';
import { getMascotName } from '../teamAssets';
import { Award, GameScore, computeSuperlatives, latestGradedWeek } from '../recap';

interface WeekRecapCardProps {
  picks: Pick[];
  users: User[];
  teamAbbreviations: { [key: string]: string };
}

// Tuesday-morning superlatives for the latest graded week. Cover margins and
// scores come from the deployed results CSV; if it isn't there yet the
// awards still render, just without the margin garnish.
export default function WeekRecapCard({ picks, users, teamAbbreviations }: WeekRecapCardProps) {
  const week = useMemo(() => latestGradedWeek(picks), [picks]);
  const [scores, setScores] = useState<Map<string, GameScore>>(() => new Map());

  useEffect(() => {
    if (week === null) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `${process.env.PUBLIC_URL}/results/nfl_results_week${week}.csv`
        );
        // The dev server answers missing files with index.html — not results
        const type = response.headers.get('content-type') || '';
        if (!response.ok || type.includes('text/html')) return;
        const csvText = await response.text();
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (parsed) => {
            if (cancelled) return;
            const map = new Map<string, GameScore>();
            for (const row of parsed.data as any[]) {
              if (row.game_id === undefined || row.game_id === '') continue;
              map.set(String(row.game_id), {
                gameId: String(row.game_id),
                away: row.away,
                home: row.home,
                awayScore: Number(row.away_score),
                homeScore: Number(row.home_score),
              });
            }
            setScores(map);
          },
        });
      } catch {
        // No results file — awards render without margins
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [week]);

  const abbr = useMemo(
    () => (team: string) =>
      teamAbbreviations[team] || getMascotName(team).substring(0, 3).toUpperCase(),
    [teamAbbreviations]
  );

  const awards: Award[] = useMemo(
    () => (week === null ? [] : computeSuperlatives(picks, users, week, scores, abbr)),
    [picks, users, week, scores, abbr]
  );

  if (week === null || !awards.length) return null;

  const league = calcRecord(
    regularSeason(picks)
      .filter((userWeek) => userWeek.week === week)
      .flatMap((userWeek) => userWeek.picks)
      .filter((pick) => gradeOf(pick) !== null)
  );

  const avatar = (userId: string, name: string) => (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: playerColorById(userId),
        color: playerInkById(userId),
        fontSize: '0.56rem',
        fontWeight: 800,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        letterSpacing: '-0.02em',
      }}
    >
      {playerInitials(name)}
    </span>
  );

  return (
    <>
      <h2 className="sl-sec">Week {week} superlatives</h2>
      <div className="sl-card" style={{ padding: '4px 14px' }}>
        <div
          style={{
            padding: '10px 0',
            borderBottom: '1px solid var(--line)',
            color: 'var(--ink-soft)',
            fontSize: '0.85rem',
          }}
        >
          The league went{' '}
          <b className="tnum" style={{ color: 'var(--ink)' }}>
            {recordString(league)}
          </b>{' '}
          against the spread ({Math.round(league.pct)}%).
        </div>
        {awards.map((award, index) => (
          <div
            key={award.key}
            style={{
              display: 'flex',
              gap: 12,
              padding: '10px 0',
              borderBottom: index < awards.length - 1 ? '1px solid var(--line)' : 'none',
              alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: '1.3rem', lineHeight: 1.25 }}>{award.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="disp"
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--ink-soft)',
                }}
              >
                {award.title}
              </div>
              {award.winners.map((winner) => (
                <div
                  key={`${winner.userId}-${winner.detail}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 4,
                    flexWrap: 'wrap',
                  }}
                >
                  {avatar(winner.userId, winner.name)}
                  <span style={{ fontWeight: 650, fontSize: '0.92rem' }}>{winner.name}</span>
                  <span className="tnum" style={{ color: 'var(--ink-soft)', fontSize: '0.8rem' }}>
                    {winner.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
