import React, { useEffect, useMemo, useState } from 'react';
import { Game, Pick, TeamPick, User, WeatherData } from '../types';
import { getTeamLogo, getMascotName } from '../teamAssets';

interface PicksScreenProps {
  games: Game[];
  users: User[];
  selectedUser: string;
  currentWeek: number;
  currentPicks: TeamPick[];
  weatherData: WeatherData[];
  picks: Pick[];
  teamAbbreviations?: { [key: string]: string };
  onSavePicks: (picks: TeamPick[]) => Promise<boolean | undefined> | void;
  onSelectUser: (userId: string) => void;
}

const isGameLocked = (game: Game) => new Date(game.kickoff_et).getTime() <= Date.now();

const kickoffShort = (kickoffEt: string) =>
  new Date(kickoffEt).toLocaleDateString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

const slotLabel = (kickoffEt: string) => {
  const date = new Date(kickoffEt);
  const day = date.toLocaleDateString('en-US', { weekday: 'long' });
  const hour = date.getHours();
  if (day === 'Sunday') return hour < 15 ? 'Sunday early' : hour < 19 ? 'Sunday late' : 'Sunday night';
  return `${day}${hour >= 19 ? ' night' : ''}`;
};

// Compact weather chip from the forecast summary (home team keyed)
const weatherChip = (summary: string | undefined): string => {
  if (!summary || summary.startsWith('Forecast not yet')) return '';
  const parts: string[] = [];
  const temp = summary.match(/(\d+)°F/);
  if (temp) {
    const degrees = parseInt(temp[1], 10);
    parts.push(`${degrees < 32 ? '🥶 ' : degrees > 84 ? '☀️ ' : ''}${degrees}°`);
  }
  const rain = summary.match(/(\d+)% chance rain/);
  if (rain) parts.push(`🌧 ${rain[1]}%`);
  if (/snow/i.test(summary)) parts.push('❄️');
  const wind = summary.match(/Windy \((\d+)mph/);
  if (wind) parts.push(`💨 ${wind[1]}`);
  return parts.join(' · ');
};

export default function PicksScreen({
  games,
  users,
  selectedUser,
  currentWeek,
  currentPicks,
  weatherData,
  teamAbbreviations = {},
  onSavePicks,
  onSelectUser,
}: PicksScreenProps) {
  const [selectedPicks, setSelectedPicks] = useState<TeamPick[]>(currentPicks);
  const [justSaved, setJustSaved] = useState(false);
  const [celebratePicks, setCelebratePicks] = useState<TeamPick[] | null>(null);

  useEffect(() => {
    setSelectedPicks(currentPicks);
    setJustSaved(false);
  }, [currentPicks, selectedUser]);

  const handleTeamToggle = (gameId: string, team: string, spread: number) => {
    const game = games.find((candidate) => candidate.id === gameId);
    if (!game || isGameLocked(game)) return;
    setJustSaved(false);

    setSelectedPicks((previous) => {
      const sameIndex = previous.findIndex(
        (pick) => pick.gameId === gameId && pick.team === team
      );
      if (sameIndex >= 0) return previous.filter((_, index) => index !== sameIndex);

      const otherIndex = previous.findIndex(
        (pick) => pick.gameId === gameId && pick.team !== team
      );
      if (otherIndex >= 0) {
        const next = [...previous];
        next[otherIndex] = { gameId, team, spread };
        return next;
      }
      if (previous.length < 3) return [...previous, { gameId, team, spread }];
      return previous;
    });
  };

  const picksModified = useMemo(() => {
    if (selectedPicks.length !== currentPicks.length) return true;
    return selectedPicks.some((pick) => {
      const original = currentPicks.find((candidate) => candidate.gameId === pick.gameId);
      return !original || original.team !== pick.team || original.spread !== pick.spread;
    });
  }, [selectedPicks, currentPicks]);

  const canSave = Boolean(selectedUser) && selectedPicks.length === 3 && picksModified;

  const grouped = useMemo(() => {
    const bySlot = new Map<string, Game[]>();
    for (const game of [...games].sort(
      (a, b) => +new Date(a.kickoff_et) - +new Date(b.kickoff_et)
    )) {
      const label = slotLabel(game.kickoff_et);
      bySlot.set(label, [...(bySlot.get(label) || []), game]);
    }
    return Array.from(bySlot.entries());
  }, [games]);

  const sideButton = (game: Game, team: string, spread: number) => {
    const picked = selectedPicks.some(
      (pick) => pick.gameId === game.id && pick.team === team
    );
    const locked = isGameLocked(game);
    const opening = team === game.away ? game.opening_spread_away : game.opening_spread_home;
    const moved = opening !== undefined && !Number.isNaN(opening) && opening !== spread;
    return (
      <button
        className="pick-side"
        onClick={() => handleTeamToggle(game.id, team, spread)}
        disabled={locked}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: `1.5px solid ${picked ? 'var(--accent)' : 'var(--line)'}`,
          borderRadius: 8,
          padding: '7px 10px',
          cursor: locked ? 'default' : 'pointer',
          background: picked ? 'var(--accent-soft)' : 'none',
          color: 'var(--ink)',
          fontSize: '0.88rem',
          fontWeight: 600,
          opacity: locked && !picked ? 0.45 : 1,
          minWidth: 0,
        }}
      >
        <img src={getTeamLogo(team)} alt="" style={{ width: 24, height: 24, flexShrink: 0 }} />
        <span className="team-full" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {getMascotName(team)}
        </span>
        <span className="team-abbr">
          {teamAbbreviations[team] || getMascotName(team).substring(0, 3).toUpperCase()}
        </span>
        <span
          className="tnum"
          style={{
            marginLeft: 'auto',
            fontWeight: 700,
            color: picked ? 'var(--accent)' : 'var(--ink-soft)',
            textAlign: 'right',
            lineHeight: 1.15,
          }}
        >
          {spread > 0 ? `+${spread}` : spread}
          {moved && (
            <small
              style={{
                display: 'block',
                fontWeight: 500,
                fontSize: '0.62rem',
                color: 'var(--push)',
              }}
            >
              open {opening! > 0 ? `+${opening}` : opening}
            </small>
          )}
        </span>
      </button>
    );
  };

  const fetchedAt = games.find((game) => game.fetched_at)?.fetched_at;
  const linesAge = (() => {
    if (!fetchedAt) return null;
    const then = new Date(fetchedAt);
    if (Number.isNaN(then.getTime())) return null;
    const hours = Math.floor((Date.now() - then.getTime()) / 3_600_000);
    return hours < 1 ? 'just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
  })();

  return (
    <div>
      {linesAge && (
        <p style={{ color: 'var(--ink-soft)', fontSize: '0.78rem', margin: '12px 2px 0' }}>
          Lines updated {linesAge} · odds move during the week, and your number locks
          in when you save — shop wisely
        </p>
      )}
      {!selectedUser && (
        <div className="sl-card" style={{ padding: '12px 16px', marginTop: 14 }}>
          <div style={{ fontWeight: 650, marginBottom: 8 }}>Who are you?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => onSelectUser(user.id)}
                className="sl-ctx"
                style={{ fontSize: '0.85rem' }}
              >
                {user.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sl-card" style={{
        position: 'sticky', top: 8, zIndex: 20, display: 'flex', alignItems: 'center',
        gap: 10, padding: '10px 12px', margin: '14px 0',
      }}>
        {[0, 1, 2].map((slotIndex) => {
          const pick = selectedPicks[slotIndex];
          return (
            <div
              key={slotIndex}
              style={{
                flex: 1,
                border: `1.5px ${pick ? 'solid var(--accent)' : 'dashed var(--line)'}`,
                borderRadius: 8,
                padding: '5px 8px',
                fontSize: '0.78rem',
                color: pick ? 'var(--ink)' : 'var(--ink-soft)',
                background: pick ? 'var(--accent-soft)' : 'none',
                fontWeight: pick ? 650 : 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 36,
                minWidth: 0,
              }}
            >
              {pick ? (
                <>
                  <img src={getTeamLogo(pick.team)} alt="" style={{ width: 20, height: 20 }} />
                  <span className="tnum" style={{ whiteSpace: 'nowrap' }}>
                    {pick.spread > 0 ? `+${pick.spread}` : pick.spread}
                  </span>
                </>
              ) : (
                `Pick ${slotIndex + 1}`
              )}
            </div>
          );
        })}
        <button
          onClick={async () => {
            if (canSave) {
              const snapshot = [...selectedPicks];
              const ok = await onSavePicks(snapshot);
              if (ok) {
                setCelebratePicks(snapshot);
                setJustSaved(true);
              }
            }
          }}
          disabled={!canSave}
          style={{
            background: justSaved && !picksModified ? 'var(--win-bg)' : 'var(--accent)',
            color: justSaved && !picksModified ? 'var(--win)' : 'var(--accent-ink)',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            padding: '10px 14px',
            fontSize: '0.82rem',
            cursor: canSave ? 'pointer' : 'default',
            opacity: canSave || (justSaved && !picksModified) ? 1 : 0.45,
            whiteSpace: 'nowrap',
          }}
        >
          {justSaved && !picksModified
            ? 'Saved ✓'
            : currentPicks.length > 0
            ? 'Update picks'
            : 'Save picks'}
        </button>
      </div>

      {celebratePicks && (
        <div
          onClick={() => setCelebratePicks(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'var(--paper)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 26,
            padding: 20,
          }}
        >
          <div className="disp" style={{ fontSize: '0.85rem', letterSpacing: '0.2em', color: 'var(--accent)', fontWeight: 700 }}>
            WEEK {currentWeek} · PICKS ARE IN
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {celebratePicks.map((pick, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <img src={getTeamLogo(pick.team)} alt="" style={{ width: 72, height: 72 }} />
                <div>
                  <div className="disp" style={{ fontSize: '1.7rem', fontWeight: 700, lineHeight: 1.1 }}>
                    {getMascotName(pick.team)}
                  </div>
                  <div className="tnum" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--accent)' }}>
                    {pick.spread > 0 ? `+${pick.spread}` : pick.spread}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ color: 'var(--ink-soft)', fontSize: '0.85rem' }}>
            Locked to your numbers. Good luck. 🍀
          </div>
          <button
            onClick={() => setCelebratePicks(null)}
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              padding: '12px 34px',
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      )}

      {grouped.map(([label, slotGames]) => (
        <React.Fragment key={label}>
          <h2 className="sl-sec">{label}</h2>
          <div className="sl-card">
            {slotGames.map((game) => {
              const weather = weatherData.find((row) => row.team === game.home);
              const chip = weatherChip(weather?.weather_summary);
              const locked = isGameLocked(game);
              return (
                <div
                  key={game.id}
                  className="pick-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '11px 14px',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  {sideButton(game, game.away, game.spread_away)}
                  {sideButton(game, game.home, game.spread_home)}
                  <div
                    className="pick-meta"
                    style={{
                      width: 92,
                      textAlign: 'center',
                      fontSize: '0.7rem',
                      color: 'var(--ink-soft)',
                      lineHeight: 1.35,
                      flexShrink: 0,
                    }}
                  >
                    <b style={{ color: 'var(--ink)', display: 'block', fontSize: '0.74rem' }}>
                      {locked ? '🔒 locked' : kickoffShort(game.kickoff_et)}
                    </b>
                    <span style={{ display: 'block' }}>O/U {game.total}</span>
                    {chip && <span style={{ display: 'block' }}>{chip}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
