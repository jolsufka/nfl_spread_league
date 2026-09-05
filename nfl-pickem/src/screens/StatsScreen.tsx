import React, { useMemo, useState } from 'react';
import { CfChart, ChartFactory } from '../charts';
import { Pick, User } from '../types';
import { gradeOf, userTeamPicks, recordString, streakOf } from '../leagueMath';
import { getTeamLogo } from '../teamAssets';
import { calcRecord } from '../seasonConfig';

interface StatsScreenProps {
  picks: Pick[];
  users: User[];
  selectedUser: string;
}

export default function StatsScreen({ picks, users, selectedUser }: StatsScreenProps) {
  const [profileId, setProfileId] = useState(selectedUser || users[0]?.id || '');

  const profile = useMemo(() => {
    const teamPicks = userTeamPicks(picks, profileId);
    const record = calcRecord(teamPicks);
    const graded = teamPicks.filter((pick) => gradeOf(pick) !== null);

    const byTeam = new Map<string, { wins: number; total: number }>();
    for (const pick of graded) {
      if (pick.team.startsWith('O/U')) continue;
      const entry = byTeam.get(pick.team) || { wins: 0, total: 0 };
      entry.total++;
      if (gradeOf(pick) === 'W') entry.wins++;
      byTeam.set(pick.team, entry);
    }
    const teams = Array.from(byTeam.entries()).filter(([, value]) => value.total >= 2);
    const best = teams.sort(
      (a, b) => b[1].wins / b[1].total - a[1].wins / a[1].total || b[1].total - a[1].total
    )[0];
    const worst = teams.sort(
      (a, b) => a[1].wins / a[1].total - b[1].wins / b[1].total || b[1].total - a[1].total
    )[0];

    const dogs = graded.filter((pick) => pick.spread > 0);
    const dogRecord = calcRecord(dogs);

    return {
      record,
      streak: streakOf(teamPicks),
      best,
      worst,
      dogRate: graded.length ? Math.round((dogs.length / graded.length) * 100) : 0,
      dogRecord,
    };
  }, [picks, profileId]);

  const favDogRows = useMemo(
    () =>
      users.map((user) => {
        const graded = userTeamPicks(picks, user.id).filter(
          (pick) => gradeOf(pick) !== null && !pick.team.startsWith('O/U')
        );
        const favorites = calcRecord(graded.filter((pick) => pick.spread < 0));
        const dogs = calcRecord(graded.filter((pick) => pick.spread > 0));
        return {
          category: user.name,
          favorites: Math.round(favorites.pct),
          underdogs: Math.round(dogs.pct),
        };
      }),
    [picks, users]
  );

  const netRows = useMemo(
    () =>
      users
        .map((user) => {
          const record = calcRecord(userTeamPicks(picks, user.id));
          return { category: user.name, value: record.wins - record.losses };
        })
        .sort((a, b) => b.value - a.value),
    [picks, users]
  );

  const hasData = favDogRows.some((row) => row.favorites > 0 || row.underdogs > 0);

  return (
    <div>
      <div className="sl-card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px 0' }}>
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => setProfileId(user.id)}
              className="sl-ctx"
              style={{
                fontSize: '0.8rem',
                background: user.id === profileId ? 'var(--accent)' : 'var(--chip)',
                color: user.id === profileId ? 'var(--accent-ink)' : 'var(--ink-soft)',
                border: '1px solid var(--line)',
              }}
            >
              {user.name}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px 4px' }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.1rem',
            }}
          >
            {users.find((user) => user.id === profileId)?.name[0]}
          </div>
          <div>
            <div className="disp tnum" style={{ fontSize: '1.7rem', fontWeight: 700, lineHeight: 1 }}>
              {recordString(profile.record)}
            </div>
            <div style={{ color: 'var(--ink-soft)', fontSize: '0.8rem' }}>
              {users.find((user) => user.id === profileId)?.name} · streak {profile.streak}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, padding: '10px 16px 14px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
            Best team
            <b style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink)', fontSize: '0.95rem' }}>
              {profile.best ? (
                <>
                  <img src={getTeamLogo(profile.best[0])} alt="" style={{ width: 18, height: 18 }} />
                  {profile.best[1].wins}–{profile.best[1].total - profile.best[1].wins}
                </>
              ) : ('—')}
            </b>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
            Worst team
            <b style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink)', fontSize: '0.95rem' }}>
              {profile.worst ? (
                <>
                  <img src={getTeamLogo(profile.worst[0])} alt="" style={{ width: 18, height: 18 }} />
                  {profile.worst[1].wins}–{profile.worst[1].total - profile.worst[1].wins}
                </>
              ) : ('—')}
            </b>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
            Dog rate<b style={{ display: 'block', color: 'var(--ink)', fontSize: '0.95rem' }}>{profile.dogRate}%</b>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
            Dogs record<b className="tnum" style={{ display: 'block', color: 'var(--ink)', fontSize: '0.95rem' }}>{recordString(profile.dogRecord)}</b>
          </div>
        </div>
      </div>

      {hasData ? (
        <>
          <h2 className="sl-sec">Favorites vs underdogs · win %</h2>
          <div className="sl-card" style={{ padding: 14 }}>
            <CfChart
              create={(el, config) => ChartFactory.Bar.createGrouped(el, config)}
              config={{
                data: favDogRows,
                keys: ['favorites', 'underdogs'],
                maxValue: 100,
              }}
            />
          </div>

          <h2 className="sl-sec">Above / below .500 · net wins</h2>
          <div className="sl-card" style={{ padding: 14 }}>
            <CfChart
              create={(el, config) => ChartFactory.Bar.createDiverging(el, config)}
              config={{ data: netRows }}
            />
          </div>
        </>
      ) : (
        <div className="sl-card" style={{ padding: '16px 18px', marginTop: 14 }}>
          <p style={{ color: 'var(--ink-soft)', margin: 0, fontSize: '0.92rem' }}>
            League analytics appear once games are graded.
          </p>
        </div>
      )}
    </div>
  );
}
