import React, { useMemo } from 'react';
import { Game, Pick, User, WeatherData } from '../types';
import { useLiveScores, atsState, LiveGame } from '../espnLive';
import { gradeOf } from '../leagueMath';
import { getTeamLogo, getMascotName } from '../teamAssets';
import { calcRecord } from '../seasonConfig';

interface ThisWeekScreenProps {
  games: Game[];
  picks: Pick[];
  users: User[];
  selectedUser: string;
  currentWeek: number;
  weatherData: WeatherData[];
  onGoPick: () => void;
}

const fmtCountdown = (ms: number) => {
  if (ms <= 0) return 'now';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 48) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const kickoffLabel = (kickoffEt: string) =>
  new Date(kickoffEt).toLocaleDateString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

function liveFor(game: Game, live: LiveGame[]): LiveGame | undefined {
  return live.find(
    (candidate) =>
      (candidate.home === game.home && candidate.away === game.away) ||
      (getMascotName(candidate.home) === getMascotName(game.home) &&
        getMascotName(candidate.away) === getMascotName(game.away))
  );
}

export default function ThisWeekScreen({
  games,
  picks,
  users,
  selectedUser,
  currentWeek,
  weatherData,
  onGoPick,
}: ThisWeekScreenProps) {
  const now = Date.now();
  const anyStarted = games.some((game) => new Date(game.kickoff_et).getTime() <= now);
  const live = useLiveScores(currentWeek, anyStarted);

  const myWeek = picks.find(
    (userWeek) => userWeek.userId === selectedUser && userWeek.week === currentWeek
  );
  const myPicks = myWeek?.picks ?? [];

  const firstUnlocked = games
    .filter((game) => new Date(game.kickoff_et).getTime() > now)
    .sort((a, b) => +new Date(a.kickoff_et) - +new Date(b.kickoff_et))[0];

  const anyLiveNow = live.some((game) => game.inProgress);

  const myToday = useMemo(() => {
    const graded = myPicks.map(gradeOf).filter(Boolean);
    const wins = graded.filter((grade) => grade === 'W').length;
    const losses = graded.filter((grade) => grade === 'L').length;
    const pushes = graded.filter((grade) => grade === 'P').length;
    return { wins, losses, pushes };
  }, [myPicks]);

  const trackerRows = myPicks.map((pick, index) => {
    const game = games.find((candidate) => candidate.id === pick.gameId);
    if (!game) return null;
    const liveGame = liveFor(game, live);
    const isHome = game.home === pick.team;
    const opponent = isHome ? `vs ${getMascotName(game.away)}` : `@ ${getMascotName(game.home)}`;
    const started = new Date(game.kickoff_et).getTime() <= now;
    const grade = gradeOf(pick);

    let scoreBlock: React.ReactNode;
    let statusPill: React.ReactNode;

    if (liveGame && (liveGame.inProgress || liveGame.completed)) {
      const pickedScore = isHome ? liveGame.homeScore : liveGame.awayScore;
      const otherScore = isHome ? liveGame.awayScore : liveGame.homeScore;
      const margin = pickedScore - otherScore;
      scoreBlock = (
        <div className="tnum" style={{ textAlign: 'right' }}>
          <div className="disp" style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.1 }}>
            {pickedScore}–{otherScore}
          </div>
          <small style={{ color: 'var(--ink-soft)', fontSize: '0.68rem' }}>
            {margin === 0
              ? 'tied'
              : `${getMascotName(pick.team)} by ${Math.abs(margin)}`}
          </small>
        </div>
      );
      if (liveGame.completed) {
        statusPill =
          grade === 'W' ? (
            <span className="sl-pill cover">Covered ✓</span>
          ) : grade === 'L' ? (
            <span className="sl-pill nocover">Missed ✗</span>
          ) : grade === 'P' ? (
            <span className="sl-pill edge">Push</span>
          ) : (() => {
            const state = atsState(pick.team, pick.spread, liveGame);
            return state === 'covering' ? (
              <span className="sl-pill cover">Covered*</span>
            ) : state === 'not-covering' ? (
              <span className="sl-pill nocover">Missed*</span>
            ) : (
              <span className="sl-pill edge">Push*</span>
            );
          })();
      } else {
        const state = atsState(pick.team, pick.spread, liveGame);
        statusPill =
          state === 'covering' ? (
            <span className="sl-pill cover">Covering</span>
          ) : state === 'not-covering' ? (
            <span className="sl-pill nocover">Not covering</span>
          ) : (
            <span className="sl-pill edge">On the number</span>
          );
      }
    } else {
      const untilKick = new Date(game.kickoff_et).getTime() - now;
      scoreBlock = (
        <div className="tnum" style={{ textAlign: 'right' }}>
          <div className="disp" style={{ fontSize: '1.25rem', fontWeight: 700 }}>—</div>
          <small style={{ color: 'var(--ink-soft)', fontSize: '0.68rem' }}>
            in {fmtCountdown(untilKick)}
          </small>
        </div>
      );
      statusPill = started ? (
        <span className="sl-pill soon">In progress…</span>
      ) : (
        <span className="sl-pill soon">Locks {kickoffLabel(game.kickoff_et)}</span>
      );
    }

    return (
      <div
        key={index}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '11px 14px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <img src={getTeamLogo(pick.team)} alt="" style={{ width: 34, height: 34 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 650, fontSize: '0.92rem', whiteSpace: 'nowrap' }}>
            {getMascotName(pick.team)}{' '}
            <span className="tnum" style={{ color: 'var(--accent)', fontWeight: 700 }}>
              {pick.spread > 0 ? `+${pick.spread}` : pick.spread}
            </span>
          </div>
          <div
            style={{
              color: 'var(--ink-soft)',
              fontSize: '0.78rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {opponent} · {liveGame?.statusDetail || kickoffLabel(game.kickoff_et)}
          </div>
        </div>
        {scoreBlock}
        {statusPill}
      </div>
    );
  });

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '14px 16px',
          marginTop: 14,
          background: 'linear-gradient(135deg, var(--accent-soft), var(--card))',
          border: '1px solid var(--line)',
          borderRadius: 10,
        }}
      >
        <div>
          <div className="disp tnum" style={{ fontSize: '1.9rem', fontWeight: 700, lineHeight: 1 }}>
            {myPicks.length}
            <span style={{ color: 'var(--ink-soft)' }}>/3</span>
          </div>
          <div style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>
            picks in for Week {currentWeek}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 14, fontSize: '0.85rem' }}>
          {anyLiveNow ? (
            <>
              <span className="sl-pill live">Live</span>
              <div className="tnum" style={{ marginTop: 4, color: 'var(--ink-soft)' }}>
                You're{' '}
                <b style={{ color: 'var(--win)' }}>
                  {myToday.wins}–{myToday.losses}
                  {myToday.pushes ? `–${myToday.pushes}` : ''}
                </b>{' '}
                so far
              </div>
            </>
          ) : firstUnlocked ? (
            <div style={{ color: 'var(--ink-soft)' }}>
              First lock in{' '}
              <b style={{ color: 'var(--ink)' }}>
                {fmtCountdown(new Date(firstUnlocked.kickoff_et).getTime() - now)}
              </b>
              <div>{kickoffLabel(firstUnlocked.kickoff_et)}</div>
            </div>
          ) : (
            <div style={{ color: 'var(--ink-soft)' }}>Week {currentWeek} is underway</div>
          )}
        </div>
        <button
          onClick={onGoPick}
          style={{
            marginLeft: 'auto',
            background: 'var(--accent)',
            color: 'var(--accent-ink)',
            border: 'none',
            fontWeight: 700,
            padding: '9px 16px',
            borderRadius: 8,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          {myPicks.length < 3 ? 'Make picks' : 'View picks'}
        </button>
      </div>

      {selectedUser && myPicks.length > 0 && (
        <>
          <h2 className="sl-sec">Your picks{anyLiveNow ? ' · live' : ''}</h2>
          <div className="sl-card" style={{ padding: '4px 0' }}>{trackerRows}</div>
        </>
      )}

      <h2 className="sl-sec">The league this week</h2>
      <div
        className="sl-card"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 14px' }}
      >
        {users.map((user) => {
          const userWeek = picks.find(
            (candidate) => candidate.userId === user.id && candidate.week === currentWeek
          );
          const count = userWeek?.picks.length ?? 0;
          const record = calcRecord(userWeek?.picks ?? []);
          const label =
            record.graded > 0
              ? `${record.wins}–${record.losses}${record.pushes ? `–${record.pushes}` : ''}`
              : count > 0
              ? `${count} in`
              : 'no picks yet';
          return (
            <span
              key={user.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--chip)',
                borderRadius: 99,
                padding: '4px 10px 4px 5px',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {user.name[0]}
              </span>
              {user.name} <span className="tnum" style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>{label}</span>
            </span>
          );
        })}
      </div>
      <p style={{ color: 'var(--ink-soft)', fontSize: '0.78rem', margin: '10px 2px' }}>
        Picks stay hidden until each game locks. Live states update every minute on game days.
      </p>
    </div>
  );
}
