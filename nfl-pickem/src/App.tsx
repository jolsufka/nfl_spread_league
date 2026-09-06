import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from './supabase';
import * as yaml from 'js-yaml';
import {
  seasonConfig,
  loadSeasonConfig,
  computeCurrentWeek,
  getPlayoffRound,
  playoffWeekName,
  calcRecord,
} from './seasonConfig';
import { Game, WeatherData, TeamPick, Pick, User } from './types';
import { getTeamLogo, getMascotName } from './teamAssets';
import { startChartThemeSync } from './charts';
import ThisWeekScreen from './screens/ThisWeekScreen';
import PicksScreen from './screens/PicksScreen';
import StandingsScreen from './screens/StandingsScreen';
import StatsScreen from './screens/StatsScreen';
import './theme.css';

type ViewKey = 'week' | 'picks' | 'standings' | 'stats';

const NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: string }> = [
  { key: 'week', label: 'This Week', icon: '🏈' },
  { key: 'picks', label: 'Picks', icon: '☑️' },
  { key: 'standings', label: 'Standings', icon: '🏆' },
  { key: 'stats', label: 'Stats', icon: '📊' },
];

const initialTheme = (): 'light' | 'dark' => {
  const saved = localStorage.getItem('nfl-pickem-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Hash routing (GitHub Pages friendly): #/week, #/standings, #/2025/standings
const VIEW_KEYS: ViewKey[] = ['week', 'picks', 'standings', 'stats'];

const parseHash = (): { season: number | null; view: ViewKey | null } => {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  let season: number | null = null;
  let view: ViewKey | null = null;
  for (const part of parts) {
    if (/^\d{4}$/.test(part)) season = parseInt(part, 10);
    else if (VIEW_KEYS.includes(part as ViewKey)) view = part as ViewKey;
  }
  return { season, view };
};

const buildHash = (view: ViewKey, season: number, currentSeason: number) =>
  season === currentSeason ? `#/${view}` : `#/${season}/${view}`;

// ---- Auth: magic-link sign-in + one-time player claim ----

function CodeEntry({ email }: { email: string }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const verify = async () => {
    if (code.trim().length < 6) return;
    setChecking(true);
    setError('');
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });
    setChecking(false);
    if (verifyError) setError(verifyError.message);
    // success: onAuthStateChange takes over
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        inputMode="numeric"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && verify()}
        placeholder="123456"
        maxLength={10}
        style={{
          width: 110,
          padding: '7px 10px',
          borderRadius: 8,
          border: '1px solid var(--line)',
          background: 'var(--paper)',
          color: 'var(--ink)',
          fontSize: '0.95rem',
          letterSpacing: '0.15em',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      <button
        onClick={verify}
        disabled={checking}
        style={{
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          padding: '8px 14px',
          fontSize: '0.82rem',
          cursor: 'pointer',
        }}
      >
        {checking ? 'Checking…' : 'Verify code'}
      </button>
      {error && <span style={{ color: 'var(--loss)', fontSize: '0.8rem' }}>{error}</span>}
    </div>
  );
}

function SignInCard({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const send = async () => {
    if (!email.includes('@')) return;
    setStatus('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('sent');
    }
  };

  return (
    <div className="sl-card" style={{ padding: '12px 16px', marginTop: 12 }}>
      {status === 'sent' ? (
        <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            📬 Check <b>{email}</b> — tap the link, or type the 6-digit code from the email:
          </div>
          <CodeEntry email={email} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 650, fontSize: '0.88rem' }}>Sign in:</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && send()}
            placeholder="your@email.com"
            style={{
              flex: 1,
              minWidth: 180,
              padding: '7px 10px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--paper)',
              color: 'var(--ink)',
              fontSize: '0.88rem',
            }}
          />
          <button
            onClick={send}
            disabled={status === 'sending'}
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              padding: '8px 14px',
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            {status === 'sending' ? 'Sending…' : 'Email me a link'}
          </button>
          <button className="sl-ctx" onClick={onClose}>Cancel</button>
          {status === 'error' && (
            <span style={{ color: 'var(--loss)', fontSize: '0.8rem', width: '100%' }}>{message}</span>
          )}
        </div>
      )}
    </div>
  );
}

function ClaimCard({ users, onClaimed }: { users: User[]; onClaimed: (playerId: string) => void }) {
  const [unclaimed, setUnclaimed] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('members')
      .select('player_id, auth_uid')
      .then(({ data }: any) => {
        if (data) setUnclaimed(data.filter((row: any) => !row.auth_uid).map((row: any) => row.player_id));
      });
  }, []);

  const claim = async (playerId: string) => {
    const { data, error: rpcError } = await supabase.rpc('claim_player', { p_player_id: playerId });
    if (rpcError || (typeof data === 'string' && data.startsWith('error'))) {
      setError(rpcError?.message || String(data).replace('error: ', ''));
      return;
    }
    onClaimed(playerId);
  };

  return (
    <div className="sl-card" style={{ padding: '12px 16px', marginTop: 12 }}>
      <div style={{ fontWeight: 650, marginBottom: 8, fontSize: '0.9rem' }}>
        One last step — which one are you? <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(one claim, permanent)</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {users
          .filter((user) => unclaimed.includes(user.id))
          .map((user) => (
            <button key={user.id} className="sl-ctx" onClick={() => claim(user.id)} style={{ fontSize: '0.85rem' }}>
              {user.name}
            </button>
          ))}
      </div>
      {error && <div style={{ color: 'var(--loss)', fontSize: '0.8rem', marginTop: 6 }}>{error}</div>}
    </div>
  );
}

interface PropBet {
  id: string;
  market: string;
  player: string;
  type: 'over_under' | 'yes_no';
  line: number | null;
  price?: number; // for yes/no props
  over_price?: number; // for o/u props
  under_price?: number; // for o/u props
  display: string;
}


function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [users] = useState<User[]>([
    { id: 'jacob', name: 'Jacob', total: 0, percentage: 0 },
    { id: 'cam', name: 'Cam', total: 0, percentage: 0 },
    { id: 'connor', name: 'Connor', total: 0, percentage: 0 },
    { id: 'nathan', name: 'Nathan', total: 0, percentage: 0 },
    { id: 'shane', name: 'Shane', total: 0, percentage: 0 },
    { id: 'max', name: 'Max', total: 0, percentage: 0 },
    { id: 'john', name: 'John', total: 0, percentage: 0 },
  ]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [currentWeek, setCurrentWeek] = useState(() => computeCurrentWeek());
  const [selectedUser, setSelectedUser] = useState<string>(
    () => localStorage.getItem('nfl-pickem-user') || ''
  );
  const [view, setView] = useState<ViewKey>(() => parseHash().view ?? 'week');
  const [viewSeason, setViewSeason] = useState<number>(
    () => parseHash().season ?? seasonConfig.season
  );
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
  const [mode, setMode] = useState<'regular' | 'playoffs'>('regular');
  const [playoffGames, setPlayoffGames] = useState<Game[]>([]);
  const [playoffWeek, setPlayoffWeek] = useState(100);
  const [teamAbbreviations, setTeamAbbreviations] = useState<{ [key: string]: string }>({});
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [session, setSession] = useState<any>(null);
  const [authedPlayer, setAuthedPlayer] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState('');

  // Surface auth errors that arrive in the redirect URL (expired/consumed
  // links etc.) instead of silently ignoring them
  useEffect(() => {
    const raw = window.location.hash + window.location.search;
    const match = raw.match(/error_description=([^&]+)/) || raw.match(/error_code=([^&]+)/);
    if (match) {
      setAuthNotice(decodeURIComponent(match[1]).replace(/\+/g, ' '));
      setSignInOpen(true);
      window.location.hash = '#/picks';
    }
  }, []);

  // Auth session + claimed-player resolution
  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event: any, newSession: any) => {
      setSession(newSession);
      // Once the magic-link tokens are consumed, clean them out of the URL
      if (event === 'SIGNED_IN' && /access_token|type=/.test(window.location.hash)) {
        window.location.hash = '#/picks';
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setAuthedPlayer(null);
      return;
    }
    supabase
      .from('members')
      .select('player_id')
      .eq('auth_uid', session.user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.player_id) {
          setAuthedPlayer(data.player_id);
          setSelectedUser(data.player_id);
          localStorage.setItem('nfl-pickem-user', data.player_id);
        } else {
          setAuthedPlayer(null);
        }
      });
  }, [session]);

  // Theme drives the app AND chart-factory via the data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nfl-pickem-theme', theme);
  }, [theme]);

  useEffect(() => {
    startChartThemeSync();
    const init = async () => {
      const config = await loadSeasonConfig();
      const week = computeCurrentWeek(config);
      setCurrentWeek(week);
      setMode(config.mode);
      setViewSeason(parseHash().season ?? config.season);
      const round = config.playoffRound ?? config.playoffRounds[0]?.week ?? 100;
      setPlayoffWeek(round);

      loadGames(week);
      if (config.mode === 'playoffs') {
        loadPlayoffGames(round);
      }
      loadTeamAbbreviations();
      loadWeatherData();
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Picks load per viewed season (2026 live, or an archived season)
  useEffect(() => {
    loadPicks(viewSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSeason]);

  // URL <-> state: tabs and seasons live in the hash (#/standings, #/2025/standings)
  useEffect(() => {
    // Magic-link logins land with auth tokens in the hash — never overwrite
    // those before the Supabase client has consumed them
    if (/access_token|refresh_token|error_code|type=/.test(window.location.hash)) return;
    const desired = buildHash(view, viewSeason, seasonConfig.season);
    if (window.location.hash !== desired) window.location.hash = desired;
  }, [view, viewSeason]);

  useEffect(() => {
    const onHashChange = () => {
      const { season, view: hashView } = parseHash();
      setViewSeason(season ?? seasonConfig.season);
      if (hashView) setView(hashView);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const loadGames = async (week: number) => {
    try {
      // Lines file is derived from the week — no hand-edited filenames
      const response = await fetch(`${process.env.PUBLIC_URL}/lines/nfl_lines_week${week}.csv`);
      if (!response.ok) {
        throw new Error(`Lines CSV for week ${week} returned HTTP ${response.status}`);
      }
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        complete: (results) => {
          const csvGames: Game[] = results.data.map((row: any, index: number) => ({
            // The CSV's id column is authoritative: it stays stable across
            // line refreshes (picks reference games by this id)
            id: row.id ? String(row.id) : `${index + 1}`,
            kickoff_et: row.kickoff_et,
            away: row.away,
            home: row.home,
            spread_away: parseFloat(row.spread_away),
            spread_home: parseFloat(row.spread_home),
            total: parseFloat(row.total),
            spreads_book: row.spreads_book,
            opening_spread_away: row.opening_spread_away ? parseFloat(row.opening_spread_away) : undefined,
            opening_spread_home: row.opening_spread_home ? parseFloat(row.opening_spread_home) : undefined,
            fetched_at: row.fetched_at
          })).filter(game => game.away && game.home); // Filter out empty rows

          setGames(csvGames);
        },
        error: (error: any) => {
          console.error('Error parsing CSV:', error);
          setGames([]);
        }
      });
    } catch (error) {
      console.error('Error loading CSV file:', error);
      setGames([]);
    }
  };

  const loadPlayoffGames = async (week: number) => {
    try {
      // Round → lines file mapping lives in season.json
      const round = getPlayoffRound(week);
      if (!round) {
        console.error(`No playoff round configured for week ${week}`);
        setPlayoffGames([]);
        return;
      }
      const response = await fetch(`${process.env.PUBLIC_URL}/lines/${round.linesFile}`);
      if (!response.ok) {
        throw new Error(`${round.linesFile} returned HTTP ${response.status}`);
      }
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        complete: (results) => {
          const csvGames: Game[] = results.data.map((row: any, index: number) => ({
            id: `playoff-${index + 1}`,
            kickoff_et: row.kickoff_et,
            away: row.away,
            home: row.home,
            spread_away: parseFloat(row.spread_away),
            spread_home: parseFloat(row.spread_home),
            total: parseFloat(row.total),
            spreads_book: row.spreads_book,
            // First half lines (Super Bowl only)
            spread_h1_away: row.spread_h1_away ? parseFloat(row.spread_h1_away) : undefined,
            spread_h1_home: row.spread_h1_home ? parseFloat(row.spread_h1_home) : undefined,
            total_h1: row.total_h1 ? parseFloat(row.total_h1) : undefined
          })).filter(game => game.away && game.home);

          setPlayoffGames(csvGames);
        },
        error: (error: any) => {
          console.error('Error parsing playoff CSV:', error);
          setPlayoffGames([]);
        }
      });
    } catch (error) {
      console.error('Error loading playoff CSV file:', error);
      setPlayoffGames([]);
    }
  };

  const loadTeamAbbreviations = async () => {
    try {
      const response = await fetch(`${process.env.PUBLIC_URL}/teamAbbreviations.yaml`);
      if (!response.ok) {
        console.error('Failed to load team abbreviations');
        return;
      }
      const yamlText = await response.text();
      const data = yaml.load(yamlText) as { teams: {[key: string]: string} };
      setTeamAbbreviations(data.teams);
    } catch (error) {
      console.error('Error loading team abbreviations:', error);
    }
  };

  const loadWeatherData = async () => {
    try {
      const response = await fetch(`${process.env.PUBLIC_URL}/weather_forecast.csv`);
      if (!response.ok) {
        console.error('Failed to load weather data');
        return;
      }
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        complete: (results) => {
          const weatherRecords: WeatherData[] = results.data
            .filter((row: any) => row.team && row.weather_summary) // Filter out empty rows
            .map((row: any) => ({
              team: row.team,
              stadium: row.stadium,
              city: row.city,
              state: row.state,
              weather_summary: row.weather_summary,
              forecast_time: row.forecast_time
            }));
          
          setWeatherData(weatherRecords);
        },
        error: (error: any) => {
          console.error('Error parsing weather CSV:', error);
        }
      });
    } catch (error) {
      console.error('Error loading weather data:', error);
    }
  };

  const loadPicks = async (season: number = seasonConfig.season) => {
    try {
      const { data, error } = await supabase
        .from('picks')
        .select('*')
        .eq('season', season)
        .order('week', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group picks by user and week
      const groupedPicks = data.reduce((acc: any, pick: any) => {
        const key = `${pick.user_id}-${pick.week}`;
        if (!acc[key]) {
          acc[key] = {
            userId: pick.user_id,
            week: pick.week,
            picks: [],
            correct: 0
          };
        }

        // Parse pick type from game_id and team format:
        // Props: team starts with "PROP:" and game_id is the prop ID
        // total_h1: game_id ends with "-h1-ou" and team starts with "O/U:"
        // spread_h1: game_id ends with "-h1" (but not "-h1-ou")
        // total: game_id ends with "-ou" (but not "-h1-ou") and team starts with "O/U:"
        // spread: default
        let pickType: 'spread' | 'total' | 'spread_h1' | 'total_h1' | 'prop1' | 'prop2' = 'spread';
        let team = pick.team;
        let gameId = pick.game_id;
        let propId: string | undefined;
        let propSelection: 'OVER' | 'UNDER' | 'YES' | undefined;

        if (pick.team.startsWith('PROP:')) {
          // Parse prop pick: "PROP:OVER:displayText" or "PROP:YES:displayText"
          const parts = pick.team.split(':');
          propSelection = parts[1] as 'OVER' | 'UNDER' | 'YES';
          team = parts.slice(2).join(':'); // Rejoin in case display text has colons
          propId = pick.game_id;
          // Determine if prop1 or prop2 based on existing picks
          const existingPropPicks = acc[key].picks.filter((p: any) => p.pickType === 'prop1' || p.pickType === 'prop2');
          pickType = existingPropPicks.length === 0 ? 'prop1' : 'prop2';
        } else if (pick.game_id.endsWith('-h1-ou')) {
          pickType = 'total_h1';
          team = pick.team.startsWith('O/U:') ? pick.team.substring(4) : pick.team;
          gameId = pick.game_id.replace('-h1-ou', '');
        } else if (pick.game_id.endsWith('-h1')) {
          pickType = 'spread_h1';
          gameId = pick.game_id.replace('-h1', '');
        } else if (pick.game_id.endsWith('-ou')) {
          pickType = 'total';
          team = pick.team.startsWith('O/U:') ? pick.team.substring(4) : pick.team;
          gameId = pick.game_id.replace('-ou', '');
        }

        acc[key].picks.push({
          gameId: gameId,
          team: team,
          spread: pick.spread,
          correct: pick.correct,
          result: pick.result,
          pickType: pickType,
          propId: propId,
          propSelection: propSelection
        });

        if (pick.correct === true) {
          acc[key].correct++;
        }

        return acc;
      }, {});

      const picksArray = Object.values(groupedPicks);
      setPicks(picksArray as Pick[]);

    } catch (error) {
      console.error('Error loading picks:', error);
      setPicks([]);
    }
  };

  const savePicks = async (userId: string, week: number, selectedPicks: TeamPick[]) => {
    // Signed-in members save through the hardened RPC: the database verifies
    // identity, kickoff locks, and current lines — the client is untrusted.
    if (session && authedPlayer) {
      try {
        const payload = selectedPicks.map((pick) => {
          let game_id = pick.gameId;
          let team = pick.team;
          switch (pick.pickType) {
            case 'total': game_id = `${pick.gameId}-ou`; break;
            case 'spread_h1': game_id = `${pick.gameId}-h1`; break;
            case 'total_h1': game_id = `${pick.gameId}-h1-ou`; break;
            case 'prop1':
            case 'prop2':
              game_id = pick.propId || pick.gameId;
              team = pick.propSelection && pick.propSelection !== 'YES'
                ? `PROP:${pick.propSelection}:${pick.team}`
                : `PROP:YES:${pick.team}`;
              break;
            default: break;
          }
          return { game_id, team, spread: pick.spread };
        });
        const { data, error } = await supabase.rpc('save_my_picks', {
          p_season: seasonConfig.season,
          p_week: week,
          p_picks: payload,
        });
        if (error) throw error;
        if (typeof data === 'string' && data.startsWith('error')) {
          alert(`Could not save: ${data.replace('error: ', '')}`);
          return;
        }
        await loadPicks();
      } catch (error: any) {
        console.error('Error saving picks:', error);
        alert(`Error saving picks: ${error.message || 'please try again'}`);
      }
      return;
    }

    try {
      // Note the ids of the picks being replaced. New picks are inserted BEFORE
      // the old ones are deleted so a failed insert can never wipe existing picks.
      const { data: existingRows, error: fetchError } = await supabase
        .from('picks')
        .select('id')
        .eq('user_id', userId)
        .eq('week', week)
        .eq('season', seasonConfig.season);
      if (fetchError) throw fetchError;

      // Insert the new picks
      // game_id format based on pickType:
      //   spread: gameId (e.g., "playoff-1")
      //   total: gameId-ou (e.g., "playoff-1-ou")
      //   spread_h1: gameId-h1 (e.g., "playoff-1-h1")
      //   total_h1: gameId-h1-ou (e.g., "playoff-1-h1-ou")
      //   prop1/prop2: propId (e.g., "player_rush_yds_kenneth_walker_iii")
      // team format:
      //   spread/spread_h1: team name
      //   total/total_h1: "O/U:OVER" or "O/U:UNDER"
      //   props (yes/no): prop display text
      //   props (o/u): "PROP:OVER:propDisplay" or "PROP:UNDER:propDisplay"
      const pickRecords = selectedPicks.map(pick => {
        let game_id = pick.gameId;
        let team = pick.team;

        switch (pick.pickType) {
          case 'total':
            game_id = `${pick.gameId}-ou`;
            // team already has O/U: prefix from handleTotalPick
            break;
          case 'spread_h1':
            game_id = `${pick.gameId}-h1`;
            break;
          case 'total_h1':
            game_id = `${pick.gameId}-h1-ou`;
            // team already has O/U: prefix from handleTotalPick
            break;
          case 'prop1':
          case 'prop2':
            game_id = pick.propId || pick.gameId;
            if (pick.propSelection && pick.propSelection !== 'YES') {
              team = `PROP:${pick.propSelection}:${pick.team}`;
            } else {
              team = `PROP:YES:${pick.team}`;
            }
            break;
          default:
            // spread - use as-is
            break;
        }

        return {
          user_id: userId,
          week: week,
          season: seasonConfig.season,
          game_id: game_id,
          team: team,
          spread: pick.spread,
          correct: null // Will be set later when games finish
        };
      });

      const { error } = await supabase
        .from('picks')
        .insert(pickRecords);

      if (error) throw error;

      // Remove the replaced picks now that the new ones are safely stored
      if (existingRows && existingRows.length > 0) {
        const { error: deleteError } = await supabase
          .from('picks')
          .delete()
          .in('id', existingRows.map(row => row.id));
        if (deleteError) throw deleteError;
      }

      // Reload picks to update UI
      await loadPicks();

      alert('Picks saved successfully!');

    } catch (error) {
      console.error('Error saving picks:', error);
      alert('Error saving picks. Please try again.');
    }
  };

  const getCurrentUserPicks = () => {
    return picks.find(p => p.userId === selectedUser && p.week === currentWeek);
  };

  const getCurrentUserPlayoffPicks = () => {
    return picks.find(p => p.userId === selectedUser && p.week === playoffWeek);
  };

  const selectUser = (userId: string) => {
    setSelectedUser(userId);
    localStorage.setItem('nfl-pickem-user', userId);
  };

  const isCurrentSeason = viewSeason === seasonConfig.season;
  const activeGames = mode === 'playoffs' ? playoffGames : games;
  const activeWeek = mode === 'playoffs' ? playoffWeek : currentWeek;
  const navItems = isCurrentSeason
    ? NAV_ITEMS
    : [{ key: 'standings' as ViewKey, label: 'Summary', icon: '🏆' }];
  const effectiveView: ViewKey = navItems.some((item) => item.key === view)
    ? view
    : 'standings';

  const headerWeekLabel = isCurrentSeason
    ? mode === 'playoffs'
      ? playoffWeekName(playoffWeek).toUpperCase()
      : `WEEK ${currentWeek}`
    : 'FINAL';

  const navButtons = (variant: 'top' | 'bottom') =>
    navItems.map((item) => (
      <button
        key={item.key}
        className={effectiveView === item.key ? 'on' : ''}
        onClick={() => setView(item.key)}
      >
        {variant === 'bottom' && <span className="ico">{item.icon}</span>}
        {item.label}
      </button>
    ));

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 14px' }}>
      <header
        style={{
          background: 'var(--paper)',
          borderBottom: '1px solid var(--line)',
          margin: '0 -14px 26px',
          padding: '0 14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '30px 0 16px' }}>
          <div className="disp" style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>
            Spread League
            <small
              style={{
                display: 'block',
                fontSize: '0.62rem',
                letterSpacing: '0.18em',
                color: 'var(--accent)',
                fontWeight: 700,
              }}
            >
              {viewSeason} · {headerWeekLabel}
            </small>
          </div>
          <div style={{ flex: 1 }} />
          <span className="sl-ctx">
            <select
              value={viewSeason}
              onChange={(event) => setViewSeason(parseInt(event.target.value, 10))}
              aria-label="Season"
            >
              <option value={seasonConfig.season}>Season {seasonConfig.season}</option>
              <option value={2025}>Season 2025</option>
            </select>
          </span>
          <button
            className="sl-ctx"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {session ? (
            <span
              title={`${session.user.email}${authedPlayer ? '' : ' — unclaimed'} · click to sign out`}
              onClick={() => {
                if (window.confirm('Sign out?')) supabase.auth.signOut();
              }}
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: authedPlayer ? 'var(--accent)' : 'var(--push)',
                color: 'var(--accent-ink)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {(users.find((user) => user.id === authedPlayer)?.name[0]) ?? '?'}
            </span>
          ) : (
            <>
              <button className="sl-ctx" onClick={() => setSignInOpen(!signInOpen)}>
                Sign in
              </button>
              {selectedUser && (
                <span
                  title={users.find((user) => user.id === selectedUser)?.name}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    background: 'var(--chip)',
                    color: 'var(--ink-soft)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                  }}
                >
                  {users.find((user) => user.id === selectedUser)?.name[0]}
                </span>
              )}
            </>
          )}
        </div>
        <nav className="sl-topnav" style={{ display: 'flex', gap: 6, paddingBottom: 16 }}>
          {navButtons('top')}
        </nav>
      </header>

      {authNotice && !session && (
        <div
          className="sl-card"
          style={{
            marginTop: 12,
            padding: '10px 14px',
            fontSize: '0.85rem',
            color: 'var(--loss)',
            background: 'var(--loss-bg)',
          }}
        >
          Sign-in link problem: <b>{authNotice}</b>. Links are one-time and some email
          apps pre-open them — request a fresh one and use the 6-digit code instead.
        </div>
      )}
      {signInOpen && !session && <SignInCard onClose={() => setSignInOpen(false)} />}
      {session && !authedPlayer && (
        <ClaimCard
          users={users}
          onClaimed={(playerId) => {
            setAuthedPlayer(playerId);
            setSelectedUser(playerId);
            localStorage.setItem('nfl-pickem-user', playerId);
          }}
        />
      )}

      {!isCurrentSeason && (
        <div
          style={{
            marginTop: 12,
            fontSize: '0.82rem',
            color: 'var(--ink-soft)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          📜 Viewing the <b style={{ color: 'var(--ink)' }}>{viewSeason} season archive</b>
          <button
            className="sl-ctx"
            style={{ marginLeft: 'auto' }}
            onClick={() => setViewSeason(seasonConfig.season)}
          >
            Back to {seasonConfig.season}
          </button>
        </div>
      )}

      {effectiveView === 'week' && (
        <ThisWeekScreen
          games={activeGames}
          picks={picks}
          users={users}
          selectedUser={selectedUser}
          currentWeek={activeWeek}
          weatherData={weatherData}
          onGoPick={() => setView('picks')}
        />
      )}

      {effectiveView === 'picks' &&
        (mode === 'regular' ? (
          <PicksScreen
            games={games}
            users={users}
            selectedUser={selectedUser}
            currentWeek={currentWeek}
            currentPicks={getCurrentUserPicks()?.picks || []}
            weatherData={weatherData}
            picks={picks}
            onSavePicks={(teamPicks) => savePicks(selectedUser, currentWeek, teamPicks)}
            onSelectUser={selectUser}
          />
        ) : (
          <div style={{ marginTop: 14 }}>
            {!selectedUser && (
              <div className="sl-card" style={{ padding: '12px 16px', marginBottom: 14 }}>
                <div style={{ fontWeight: 650, marginBottom: 8 }}>Who are you?</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {users.map((user) => (
                    <button key={user.id} onClick={() => selectUser(user.id)} className="sl-ctx">
                      {user.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {playoffWeek === 103 && playoffGames.length > 0 ? (
              <SuperBowlPickInterface
                game={playoffGames[0]}
                currentPicks={getCurrentUserPlayoffPicks()?.picks || []}
                onSavePicks={(teamPicks: TeamPick[]) =>
                  savePicks(selectedUser, playoffWeek, teamPicks)
                }
                selectedUser={selectedUser}
                users={users}
              />
            ) : (
              <PlayoffPickInterface
                games={playoffGames}
                currentPicks={getCurrentUserPlayoffPicks()?.picks || []}
                onSavePicks={(teamPicks: TeamPick[]) =>
                  savePicks(selectedUser, playoffWeek, teamPicks)
                }
                selectedUser={selectedUser}
                users={users}
              />
            )}
          </div>
        ))}

      {effectiveView === 'standings' && (
        <>
          <StandingsScreen
            picks={picks}
            users={users}
            teamAbbreviations={teamAbbreviations}
            selectedUser={selectedUser}
            season={viewSeason}
            archive={!isCurrentSeason}
          />
          {isCurrentSeason && mode === 'playoffs' && (
            <>
              <h2 className="sl-sec">Playoffs</h2>
              <PlayoffLeaderboard picks={picks} users={users} playoffWeek={playoffWeek} />
              <PlayoffPickChart
                picks={picks}
                users={users}
                currentPlayoffWeek={playoffWeek}
                teamAbbreviations={teamAbbreviations}
              />
            </>
          )}
        </>
      )}

      {effectiveView === 'stats' && (
        <StatsScreen picks={picks} users={users} selectedUser={selectedUser} />
      )}

      <nav className="sl-bottomnav">{navButtons('bottom')}</nav>
    </div>
  );
}

interface PlayoffPickInterfaceProps {
  games: Game[];
  currentPicks: TeamPick[];
  onSavePicks: (picks: TeamPick[]) => void;
  selectedUser: string;
  users: User[];
}

interface PlayoffPickChartProps {
  picks: Pick[];
  users: User[];
  currentPlayoffWeek: number;
  teamAbbreviations: {[key: string]: string};
}

interface PlayoffLeaderboardProps {
  picks: Pick[];
  users: User[];
  playoffWeek: number;
}

function PlayoffLeaderboard({ picks, users, playoffWeek }: PlayoffLeaderboardProps) {
  // Get all playoff picks (week >= 100)
  const playoffPicks = picks.filter(p => p.week >= 100 && p.week <= playoffWeek);

  const getUserTotalCorrect = (userId: string) => {
    return playoffPicks.filter(p => p.userId === userId).reduce((sum, pick) => {
      return sum + pick.picks.filter(teamPick => teamPick.correct === true).length;
    }, 0);
  };

  const getUserTotalPicks = (userId: string) => {
    // Graded picks including pushes — pushes count in the denominator
    return playoffPicks.filter(p => p.userId === userId).reduce((sum, pick) => {
      return sum + calcRecord(pick.picks).graded;
    }, 0);
  };

  const getUserPercentage = (userId: string) => {
    const total = getUserTotalPicks(userId);
    if (total === 0) return 0;
    return Math.round((getUserTotalCorrect(userId) / total) * 100);
  };

  // Create leaderboard data with calculated stats
  const sortedData = users.map(user => ({
    id: user.id,
    name: user.name,
    totalCorrect: getUserTotalCorrect(user.id),
    totalPicks: getUserTotalPicks(user.id),
    percentage: getUserPercentage(user.id)
  })).sort((a, b) => {
    // Sort by total correct first, then by percentage
    if (b.totalCorrect !== a.totalCorrect) {
      return b.totalCorrect - a.totalCorrect;
    }
    return b.percentage - a.percentage;
  });

  // Add standard competition ranking (1224 ranking)
  const leaderboardData: Array<typeof sortedData[0] & { rank: number }> = [];
  for (let i = 0; i < sortedData.length; i++) {
    let rank = 1;
    if (i > 0) {
      const prevUser = leaderboardData[i - 1];
      const currentUser = sortedData[i];

      // If total correct is the same as previous user, use same rank
      if (prevUser.totalCorrect === currentUser.totalCorrect) {
        rank = prevUser.rank;
      } else {
        rank = i + 1;
      }
    }
    leaderboardData.push({ ...sortedData[i], rank });
  }

  // Group stats
  const groupStats = {
    totalCorrect: leaderboardData.reduce((sum, user) => sum + user.totalCorrect, 0),
    totalPicks: leaderboardData.reduce((sum, user) => sum + user.totalPicks, 0)
  };
  const groupPercentage = groupStats.totalPicks > 0 ? Math.round((groupStats.totalCorrect / groupStats.totalPicks) * 100) : 0;

  return (
    <div>
      {/* Group Performance Summary */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">League Performance</h3>
          <div className="flex justify-center items-center space-x-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {groupStats.totalCorrect}/{groupStats.totalPicks}
              </div>
              <div className="text-sm text-blue-700">Total Correct Picks</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {groupPercentage}%
              </div>
              <div className="text-sm text-blue-700">League Success Rate</div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Correct
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Overall
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leaderboardData.map((user) => {
              const isTopPerformer = user.rank === 1 && user.percentage > 0;
              return (
                <tr key={user.id} className={isTopPerformer ? 'bg-yellow-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      {user.rank === 1 && user.percentage > 0 && <span className="text-yellow-500 mr-2">🏆</span>}
                      {user.rank === Math.max(...leaderboardData.map(u => u.rank)) && leaderboardData.length > 1 && <span className="text-red-500 mr-2">🤡</span>}
                      #{user.rank}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="font-semibold">{user.totalCorrect}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.totalPicks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`font-semibold px-2 py-1 rounded ${
                      user.percentage >= 60 ? 'bg-green-100 text-green-800' :
                      user.percentage >= 50 ? 'bg-yellow-100 text-yellow-800' :
                      user.percentage > 0 ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {user.percentage}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SuperBowlPickInterfaceProps {
  game: Game;
  currentPicks: TeamPick[];
  onSavePicks: (picks: TeamPick[]) => void;
  selectedUser: string;
  users: User[];
}

function SuperBowlPickInterface({ game, currentPicks, onSavePicks, selectedUser, users }: SuperBowlPickInterfaceProps) {
  // Pick types for Super Bowl: spread, total, spread_h1, total_h1, prop1, prop2
  const [picks, setPicks] = useState<{[key: string]: TeamPick}>(() => {
    const pickMap: {[key: string]: TeamPick} = {};
    currentPicks.forEach(p => {
      if (p.pickType) pickMap[p.pickType] = p;
    });
    return pickMap;
  });
  const [hasExistingPicks, setHasExistingPicks] = useState<boolean>(currentPicks.length > 0);
  const [availableProps, setAvailableProps] = useState<PropBet[]>([]);
  const [propSearch, setPropSearch] = useState('');
  const [showPropDropdown, setShowPropDropdown] = useState<'prop1' | 'prop2' | null>(null);

  // Load props on mount
  React.useEffect(() => {
    const loadProps = async () => {
      try {
        const response = await fetch(`${process.env.PUBLIC_URL}/lines/superbowl_props.json`);
        if (!response.ok) {
          throw new Error(`superbowl_props.json returned HTTP ${response.status}`);
        }
        const data = await response.json();
        setAvailableProps(data);
      } catch (error) {
        console.error('Error loading props:', error);
      }
    };
    loadProps();
  }, []);

  React.useEffect(() => {
    const pickMap: {[key: string]: TeamPick} = {};
    currentPicks.forEach(p => {
      if (p.pickType) pickMap[p.pickType] = p;
    });
    setPicks(pickMap);
    setHasExistingPicks(currentPicks.length > 0);
  }, [currentPicks]);

  const isGameLocked = () => {
    if (!game) return false;
    const gameTime = new Date(game.kickoff_et);
    const now = new Date();
    return now >= gameTime;
  };

  const gameLocked = isGameLocked();

  const handleSpreadPick = (pickType: 'spread' | 'spread_h1', team: string, spread: number) => {
    if (gameLocked) return;
    setPicks(prev => ({
      ...prev,
      [pickType]: { gameId: game.id, team, spread, pickType }
    }));
  };

  const handleTotalPick = (pickType: 'total' | 'total_h1', selection: 'OVER' | 'UNDER', total: number) => {
    if (gameLocked) return;
    setPicks(prev => ({
      ...prev,
      [pickType]: { gameId: game.id, team: `O/U:${selection}`, spread: total, pickType }
    }));
  };

  const handlePropSelect = (pickType: 'prop1' | 'prop2', prop: PropBet) => {
    if (gameLocked) return;
    // For yes/no props, auto-select YES
    if (prop.type === 'yes_no') {
      setPicks(prev => ({
        ...prev,
        [pickType]: {
          gameId: game.id,
          team: prop.display,
          spread: prop.price || 0,
          pickType,
          propId: prop.id,
          propSelection: 'YES'
        }
      }));
    } else {
      // For O/U props, just select the prop (user will pick O/U next)
      setPicks(prev => ({
        ...prev,
        [pickType]: {
          gameId: game.id,
          team: prop.display,
          spread: prop.line || 0,
          pickType,
          propId: prop.id,
          propSelection: undefined // Will be set when O/U is selected
        }
      }));
    }
    setShowPropDropdown(null);
    setPropSearch('');
  };

  const handlePropOUSelect = (pickType: 'prop1' | 'prop2', selection: 'OVER' | 'UNDER') => {
    if (gameLocked) return;
    setPicks(prev => {
      const current = prev[pickType];
      if (!current) return prev;
      return {
        ...prev,
        [pickType]: { ...current, propSelection: selection }
      };
    });
  };

  const handleRemoveProp = (pickType: 'prop1' | 'prop2') => {
    if (gameLocked) return;
    setPicks(prev => {
      const newPicks = { ...prev };
      delete newPicks[pickType];
      return newPicks;
    });
  };

  const getSelectedPropIds = () => {
    const ids: string[] = [];
    if (picks['prop1']?.propId) ids.push(picks['prop1'].propId);
    if (picks['prop2']?.propId) ids.push(picks['prop2'].propId);
    return ids;
  };

  // Filter props: exclude already selected AND exclude odds worse than -120
  const isOddsValid = (prop: PropBet): boolean => {
    // For yes/no props, check the price
    if (prop.type === 'yes_no') {
      // Positive odds are always valid, negative odds must be -120 or better (closer to 0)
      return prop.price === null || prop.price === undefined || prop.price >= -120;
    }
    // For O/U props, at least one side must be -120 or better
    const overValid = prop.over_price === null || prop.over_price === undefined || prop.over_price >= -120;
    const underValid = prop.under_price === null || prop.under_price === undefined || prop.under_price >= -120;
    return overValid || underValid;
  };

  const filteredProps = availableProps.filter(prop => {
    const selectedIds = getSelectedPropIds();
    if (selectedIds.includes(prop.id)) return false; // Don't show already selected props
    if (!isOddsValid(prop)) return false; // Don't show props with bad odds
    if (!propSearch) return true;
    return prop.display.toLowerCase().includes(propSearch.toLowerCase()) ||
           prop.player.toLowerCase().includes(propSearch.toLowerCase()) ||
           prop.market.toLowerCase().includes(propSearch.toLowerCase());
  });

  // Group filtered props by market category
  const groupedProps = filteredProps.reduce((acc, prop) => {
    const market = prop.market;
    if (!acc[market]) acc[market] = [];
    acc[market].push(prop);
    return acc;
  }, {} as { [key: string]: PropBet[] });

  // Sort markets for consistent ordering
  const sortedMarkets = Object.keys(groupedProps).sort();

  const handleSave = () => {
    // Require all 6 picks (spread, total, spread_h1, total_h1, prop1, prop2)
    const requiredPicks = ['spread', 'total', 'spread_h1', 'total_h1', 'prop1', 'prop2'];
    const allRequired = requiredPicks.every(pt => {
      const pick = picks[pt];
      if (!pick) return false;
      // For O/U props, ensure selection is made
      if ((pt === 'prop1' || pt === 'prop2') && pick.propId) {
        const prop = availableProps.find(p => p.id === pick.propId);
        if (prop?.type === 'over_under' && !pick.propSelection) return false;
      }
      return true;
    });
    if (allRequired) {
      const allPicks = Object.values(picks);
      onSavePicks(allPicks);
    }
  };

  const arePicksModified = () => {
    const allPicks = Object.values(picks);
    if (!hasExistingPicks && allPicks.length > 0) return true;
    if (hasExistingPicks && allPicks.length !== currentPicks.length) return true;
    return allPicks.some(pick => {
      const originalPick = currentPicks.find(op => op.pickType === pick.pickType);
      if (!originalPick) return true;
      return originalPick.team !== pick.team ||
             originalPick.spread !== pick.spread ||
             originalPick.propId !== pick.propId ||
             originalPick.propSelection !== pick.propSelection;
    });
  };

  const isPropPickComplete = (pickType: 'prop1' | 'prop2') => {
    const pick = picks[pickType];
    if (!pick?.propId) return false;
    const prop = availableProps.find(p => p.id === pick.propId);
    if (prop?.type === 'over_under') return !!pick.propSelection;
    return true; // yes/no props are complete once selected
  };

  const requiredPicks = ['spread', 'total', 'spread_h1', 'total_h1', 'prop1', 'prop2'];
  const completedPicks = requiredPicks.filter(pt => {
    if (pt === 'prop1' || pt === 'prop2') return isPropPickComplete(pt as 'prop1' | 'prop2');
    return !!picks[pt];
  }).length;
  const allPicksComplete = completedPicks === 6;

  const getButtonText = () => {
    const userName = users.find(u => u.id === selectedUser)?.name || 'Unknown User';
    if (!hasExistingPicks) {
      return `Save Picks for ${userName} (${completedPicks}/6)`;
    } else if (arePicksModified()) {
      return `Update Picks for ${userName} (${completedPicks}/6)`;
    } else {
      return `Picks Saved for ${userName} (${completedPicks}/6)`;
    }
  };

  const formatGameTime = (kickoffEt: string) => {
    const date = new Date(kickoffEt);
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneAbbr = new Date().toLocaleTimeString('en-US', {
      timeZoneName: 'short'
    }).split(' ')[2];
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: userTimezone
    }) + ` ${timezoneAbbr}`;
  };


  if (!game) {
    return <div className="text-gray-500">Loading Super Bowl data...</div>;
  }

  const renderSpreadPick = (title: string, pickType: 'spread' | 'spread_h1', awaySpread: number, homeSpread: number) => {
    const currentPick = picks[pickType];
    return (
      <div className={`border rounded-lg p-4 shadow-md ${gameLocked ? 'bg-gray-50' : 'bg-white'}`}>
        <h4 className={`font-semibold mb-3 ${gameLocked ? 'text-gray-500' : 'text-gray-900'}`}>{title}</h4>
        <div className="space-y-2">
          {/* Away Team */}
          <div
            className={`flex items-center space-x-3 p-3 rounded border transition-colors cursor-pointer ${
              gameLocked ? 'opacity-60 cursor-not-allowed' :
              currentPick?.team === game.away ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleSpreadPick(pickType, game.away, awaySpread)}
          >
            {getTeamLogo(game.away) && (
              <img src={getTeamLogo(game.away)} alt={game.away} className="w-8 h-8 object-contain" />
            )}
            <span className="flex-1 font-medium">{getMascotName(game.away)}</span>
            <span className={`text-lg font-bold ${currentPick?.team === game.away ? 'text-green-600' : 'text-gray-600'}`}>
              {awaySpread > 0 ? `+${awaySpread}` : awaySpread}
            </span>
          </div>
          {/* Home Team */}
          <div
            className={`flex items-center space-x-3 p-3 rounded border transition-colors cursor-pointer ${
              gameLocked ? 'opacity-60 cursor-not-allowed' :
              currentPick?.team === game.home ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleSpreadPick(pickType, game.home, homeSpread)}
          >
            {getTeamLogo(game.home) && (
              <img src={getTeamLogo(game.home)} alt={game.home} className="w-8 h-8 object-contain" />
            )}
            <span className="flex-1 font-medium">{getMascotName(game.home)}</span>
            <span className={`text-lg font-bold ${currentPick?.team === game.home ? 'text-green-600' : 'text-gray-600'}`}>
              {homeSpread > 0 ? `+${homeSpread}` : homeSpread}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderTotalPick = (title: string, pickType: 'total' | 'total_h1', total: number) => {
    const currentPick = picks[pickType];
    // Check for both formats: with prefix (new picks) and without (loaded from DB)
    const isOver = currentPick?.team === 'O/U:OVER' || currentPick?.team === 'OVER';
    const isUnder = currentPick?.team === 'O/U:UNDER' || currentPick?.team === 'UNDER';
    return (
      <div className={`border rounded-lg p-4 shadow-md ${gameLocked ? 'bg-gray-50' : 'bg-white'}`}>
        <h4 className={`font-semibold mb-3 ${gameLocked ? 'text-gray-500' : 'text-gray-900'}`}>{title}</h4>
        <div className="text-center mb-3">
          <span className="text-2xl font-bold text-blue-600">{total}</span>
        </div>
        <div className="flex space-x-3">
          <button
            className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold transition-colors ${
              gameLocked ? 'opacity-60 cursor-not-allowed' :
              isOver ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleTotalPick(pickType, 'OVER', total)}
            disabled={gameLocked}
          >
            OVER
          </button>
          <button
            className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold transition-colors ${
              gameLocked ? 'opacity-60 cursor-not-allowed' :
              isUnder ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleTotalPick(pickType, 'UNDER', total)}
            disabled={gameLocked}
          >
            UNDER
          </button>
        </div>
      </div>
    );
  };

  const renderPropPicker = (pickType: 'prop1' | 'prop2') => {
    const currentPick = picks[pickType];
    const selectedProp = currentPick?.propId ? availableProps.find(p => p.id === currentPick.propId) : null;
    const isDropdownOpen = showPropDropdown === pickType;
    const propNumber = pickType === 'prop1' ? 1 : 2;

    // If a prop is selected, show it with O/U buttons (if applicable) and remove option
    if (selectedProp) {
      return (
        <div className={`border rounded-lg p-4 shadow-md ${gameLocked ? 'bg-gray-50' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={`font-semibold ${gameLocked ? 'text-gray-500' : 'text-gray-900'}`}>Prop {propNumber}</h4>
            {!gameLocked && (
              <button
                onClick={() => handleRemoveProp(pickType)}
                className="text-red-500 hover:text-red-700 text-sm font-medium"
              >
                Remove
              </button>
            )}
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
            <div className="font-medium text-purple-900">{selectedProp.player}</div>
            <div className="text-sm text-purple-700">{selectedProp.market}</div>
            {selectedProp.line && (
              <div className="text-lg font-bold text-purple-600 mt-1">Line: {selectedProp.line}</div>
            )}
            {selectedProp.type === 'yes_no' && (
              <div className="text-sm text-green-600 mt-1 font-medium">
                YES ({selectedProp.price! > 0 ? '+' : ''}{selectedProp.price})
              </div>
            )}
          </div>

          {/* O/U selection for over_under props */}
          {selectedProp.type === 'over_under' && (
            <div className="flex space-x-3">
              <button
                className={`flex-1 py-2 px-3 rounded-lg border-2 font-semibold transition-colors text-sm ${
                  gameLocked ? 'opacity-60 cursor-not-allowed' :
                  currentPick?.propSelection === 'OVER' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => handlePropOUSelect(pickType, 'OVER')}
                disabled={gameLocked}
              >
                OVER ({selectedProp.over_price! > 0 ? '+' : ''}{selectedProp.over_price})
              </button>
              <button
                className={`flex-1 py-2 px-3 rounded-lg border-2 font-semibold transition-colors text-sm ${
                  gameLocked ? 'opacity-60 cursor-not-allowed' :
                  currentPick?.propSelection === 'UNDER' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 hover:border-purple-300'
                }`}
                onClick={() => handlePropOUSelect(pickType, 'UNDER')}
                disabled={gameLocked}
              >
                UNDER ({selectedProp.under_price! > 0 ? '+' : ''}{selectedProp.under_price})
              </button>
            </div>
          )}
        </div>
      );
    }

    // No prop selected - show search dropdown
    return (
      <div className={`border rounded-lg p-4 shadow-md relative ${gameLocked ? 'bg-gray-50' : 'bg-white'}`}>
        <h4 className={`font-semibold mb-3 ${gameLocked ? 'text-gray-500' : 'text-gray-900'}`}>Prop {propNumber}</h4>
        <div className="relative">
          <input
            type="text"
            placeholder="Search props (e.g., 'Walker rush', 'anytime TD')..."
            value={isDropdownOpen ? propSearch : ''}
            onChange={(e) => setPropSearch(e.target.value)}
            onFocus={() => setShowPropDropdown(pickType)}
            disabled={gameLocked}
            className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
              gameLocked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
            }`}
          />
          {isDropdownOpen && (
            <>
              {/* Backdrop to close dropdown */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => {
                  setShowPropDropdown(null);
                  setPropSearch('');
                }}
              />
              {/* Dropdown - grouped by category */}
              <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {filteredProps.length === 0 ? (
                  <div className="p-3 text-gray-500 text-sm">No props found</div>
                ) : (
                  sortedMarkets.map(market => (
                    <div key={market}>
                      {/* Category Header */}
                      <div className="sticky top-0 bg-purple-100 px-3 py-2 text-xs font-bold text-purple-800 uppercase tracking-wide border-b border-purple-200">
                        {market}
                      </div>
                      {/* Props in this category */}
                      {groupedProps[market].map(prop => (
                        <div
                          key={prop.id}
                          className="p-3 hover:bg-purple-50 cursor-pointer border-b last:border-b-0"
                          onClick={() => handlePropSelect(pickType, prop)}
                        >
                          <div className="font-medium text-gray-900">{prop.player}</div>
                          <div className="text-sm text-purple-600 font-medium">
                            {prop.type === 'yes_no' ? (
                              `YES (${prop.price! > 0 ? '+' : ''}${prop.price})`
                            ) : (
                              `O/U ${prop.line} (${prop.over_price! > 0 ? '+' : ''}${prop.over_price}/${prop.under_price! > 0 ? '+' : ''}${prop.under_price})`
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Game Header */}
      <div className="text-white rounded-lg p-6 mb-6" style={{ background: 'linear-gradient(to right, #69BE28, #002244)' }}>
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-2">Super Bowl LX</h3>
          <div className="flex items-center justify-center space-x-4">
            {getTeamLogo(game.away) && (
              <img src={getTeamLogo(game.away)} alt={game.away} className="w-16 h-16 object-contain" />
            )}
            <div className="text-xl font-semibold">
              {getMascotName(game.away)} @ {getMascotName(game.home)}
            </div>
            {getTeamLogo(game.home) && (
              <img src={getTeamLogo(game.home)} alt={game.home} className="w-16 h-16 object-contain" />
            )}
          </div>
          <p className="mt-2 text-blue-100">{formatGameTime(game.kickoff_et)}</p>
          {gameLocked && (
            <div className="mt-2 bg-red-500 text-white px-3 py-1 rounded-full inline-block text-sm font-medium">
              LOCKED
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      {!selectedUser ? (
        <p className="text-sm text-red-600 font-medium mb-6">
          Please select your name from the dropdown above before making picks
        </p>
      ) : (
        <p className="text-sm text-gray-600 mb-6">
          Make 4 picks: Full Game Spread, Full Game O/U, 1st Half Spread, 1st Half O/U
        </p>
      )}

      {/* Full Game Picks */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          Full Game
          <span className={`ml-2 text-sm font-normal ${picks['spread'] && picks['total'] ? 'text-green-600' : 'text-orange-600'}`}>
            ({(picks['spread'] ? 1 : 0) + (picks['total'] ? 1 : 0)}/2)
          </span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderSpreadPick('Game Spread', 'spread', game.spread_away, game.spread_home)}
          {renderTotalPick('Game Total', 'total', game.total)}
        </div>
      </div>

      {/* First Half Picks */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          First Half
          <span className={`ml-2 text-sm font-normal ${picks['spread_h1'] && picks['total_h1'] ? 'text-green-600' : 'text-orange-600'}`}>
            ({(picks['spread_h1'] ? 1 : 0) + (picks['total_h1'] ? 1 : 0)}/2)
          </span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {game.spread_h1_away !== undefined && game.spread_h1_home !== undefined ? (
            renderSpreadPick('1st Half Spread', 'spread_h1', game.spread_h1_away, game.spread_h1_home)
          ) : (
            <div className="border rounded-lg p-4 bg-gray-50 text-gray-500">1st Half Spread: Coming Soon</div>
          )}
          {game.total_h1 !== undefined ? (
            renderTotalPick('1st Half Total', 'total_h1', game.total_h1)
          ) : (
            <div className="border rounded-lg p-4 bg-gray-50 text-gray-500">1st Half Total: Coming Soon</div>
          )}
        </div>
      </div>

      {/* Prop Bets Section */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          Prop Bets
          <span className={`ml-2 text-sm font-normal ${isPropPickComplete('prop1') && isPropPickComplete('prop2') ? 'text-green-600' : 'text-orange-600'}`}>
            ({(isPropPickComplete('prop1') ? 1 : 0) + (isPropPickComplete('prop2') ? 1 : 0)}/2)
          </span>
        </h3>
        <p className="text-sm text-gray-600 mb-2">Search and select any 2 prop bets (must be -120 or better)</p>
        <p className="text-xs text-gray-500 italic mb-4">Note: Picks are judged only on correctness — no extra credit for longer odds!</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Prop 1 */}
          {renderPropPicker('prop1')}
          {/* Prop 2 */}
          {renderPropPicker('prop2')}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={!selectedUser || !allPicksComplete || (hasExistingPicks && !arePicksModified())}
        className={`w-full py-3 px-4 rounded-md text-lg font-semibold ${
          !selectedUser || !allPicksComplete
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : hasExistingPicks && !arePicksModified()
              ? 'bg-green-600 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        {getButtonText()}
      </button>
      {selectedUser && !allPicksComplete && (
        <p className="text-sm text-orange-600 mt-2 text-center">
          Complete all 6 picks to save ({completedPicks}/6 selected)
        </p>
      )}
    </div>
  );
}

function PlayoffPickInterface({ games, currentPicks, onSavePicks, selectedUser, users }: PlayoffPickInterfaceProps) {
  // Separate spread picks and total picks from currentPicks
  const currentSpreadPicks = currentPicks.filter(p => !p.pickType || p.pickType === 'spread');
  const currentTotalPicks = currentPicks.filter(p => p.pickType === 'total');

  const [spreadPicks, setSpreadPicks] = useState<TeamPick[]>(currentSpreadPicks);
  const [totalPicks, setTotalPicks] = useState<TeamPick[]>(currentTotalPicks);
  const [hasExistingPicks, setHasExistingPicks] = useState<boolean>(currentPicks.length > 0);

  React.useEffect(() => {
    const spreadFromCurrent = currentPicks.filter(p => !p.pickType || p.pickType === 'spread');
    const totalFromCurrent = currentPicks.filter(p => p.pickType === 'total');
    setSpreadPicks(spreadFromCurrent);
    setTotalPicks(totalFromCurrent);
    setHasExistingPicks(currentPicks.length > 0);
  }, [currentPicks]);

  const handleSpreadToggle = (gameId: string, team: string, spread: number) => {
    const game = games.find(g => g.id === gameId);
    if (game && isGameLocked(game)) {
      return;
    }

    setSpreadPicks(prev => {
      const existingPickIndex = prev.findIndex(p => p.gameId === gameId && p.team === team);

      if (existingPickIndex >= 0) {
        return prev.filter((_, index) => index !== existingPickIndex);
      }

      const otherTeamIndex = prev.findIndex(p => p.gameId === gameId && p.team !== team);

      if (otherTeamIndex >= 0) {
        const newPicks = [...prev];
        newPicks[otherTeamIndex] = { gameId, team, spread, pickType: 'spread' };
        return newPicks;
      }

      return [...prev, { gameId, team, spread, pickType: 'spread' }];
    });
  };

  const handleTotalToggle = (gameId: string, selection: 'OVER' | 'UNDER', total: number) => {
    const game = games.find(g => g.id === gameId);
    if (game && isGameLocked(game)) {
      return;
    }

    setTotalPicks(prev => {
      // Check if this exact selection exists
      const existingPickIndex = prev.findIndex(p => p.gameId === gameId && p.team === selection);

      if (existingPickIndex >= 0) {
        // Deselect - remove it
        return prev.filter((_, index) => index !== existingPickIndex);
      }

      // Check if the other selection (OVER vs UNDER) for this game exists
      const otherSelectionIndex = prev.findIndex(p => p.gameId === gameId);

      if (otherSelectionIndex >= 0) {
        // Replace with new selection
        const newPicks = [...prev];
        newPicks[otherSelectionIndex] = { gameId, team: selection, spread: total, pickType: 'total' };
        return newPicks;
      }

      // Check if already at max (one O/U pick per game)
      if (prev.length >= games.length) {
        return prev; // Don't add more
      }

      return [...prev, { gameId, team: selection, spread: total, pickType: 'total' }];
    });
  };

  const handleSave = () => {
    // Require all spread picks AND all O/U picks (both games ATS + both games O/U)
    if (spreadPicks.length === games.length && totalPicks.length === games.length) {
      const allPicks = [...spreadPicks, ...totalPicks];
      onSavePicks(allPicks);
    }
  };

  const arePicksModified = () => {
    const allPicks = [...spreadPicks, ...totalPicks];
    if (!hasExistingPicks && allPicks.length > 0) return true;
    if (hasExistingPicks && allPicks.length !== currentPicks.length) return true;

    return allPicks.some(pick => {
      const originalPick = currentPicks.find(op =>
        op.gameId === pick.gameId &&
        op.team === pick.team &&
        (op.pickType || 'spread') === (pick.pickType || 'spread')
      );
      return !originalPick || originalPick.spread !== pick.spread;
    });
  };

  const getButtonText = () => {
    const userName = users.find(u => u.id === selectedUser)?.name || 'Unknown User';
    const totalPickCount = spreadPicks.length + totalPicks.length;
    const maxPicks = games.length * 2; // All spreads + all O/U picks

    if (!hasExistingPicks) {
      return `Save Picks for ${userName} (${totalPickCount}/${maxPicks})`;
    } else if (arePicksModified()) {
      return `Update Picks for ${userName} (${totalPickCount}/${maxPicks})`;
    } else {
      return `Picks Saved for ${userName} (${totalPickCount}/${maxPicks})`;
    }
  };

  const formatGameTime = (kickoffEt: string) => {
    const date = new Date(kickoffEt);
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezoneAbbr = new Date().toLocaleTimeString('en-US', {
      timeZoneName: 'short'
    }).split(' ')[2];

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: userTimezone
    }) + ` ${timezoneAbbr}`;
  };

  const getSpreadSelectionState = (gameId: string) => {
    const gamePick = spreadPicks.find((p: TeamPick) => p.gameId === gameId);
    return gamePick ? gamePick.team : null;
  };

  const getTotalSelectionState = (gameId: string) => {
    const gamePick = totalPicks.find((p: TeamPick) => p.gameId === gameId);
    return gamePick ? gamePick.team : null;
  };

  const isGameLocked = (game: Game) => {
    const gameTime = new Date(game.kickoff_et);
    const now = new Date();
    return now >= gameTime;
  };


  const canAddMoreTotals = totalPicks.length < games.length;
  const allSpreadsSelected = spreadPicks.length === games.length;
  const allTotalsSelected = totalPicks.length === games.length;

  return (
    <div>
      {/* Instructions */}
      <div className="mb-6">
        {!selectedUser ? (
          <p className="text-sm text-red-600 font-medium">
            Please select your name from the dropdown above before making picks
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Spread Picks:</span> Pick all {games.length} games against the spread (required)
            </p>
            <p className="text-sm text-gray-700">
              <span className="font-semibold">Over/Under Picks:</span> Pick all {games.length} totals (required)
            </p>
          </div>
        )}
        {hasExistingPicks && !arePicksModified() && (
          <p className="text-sm text-green-600 mt-2">
            Your picks have been saved. Make changes to update them.
          </p>
        )}
      </div>

      {/* Spread Picks Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          Spread Picks
          <span className={`ml-2 text-sm font-normal ${allSpreadsSelected ? 'text-green-600' : 'text-orange-600'}`}>
            ({spreadPicks.length}/{games.length} selected)
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map(game => {
            const selectedTeam = getSpreadSelectionState(game.id);
            const gameLocked = isGameLocked(game);

            return (
              <div key={game.id} className={`border rounded-lg p-4 shadow-md transition-shadow ${
                gameLocked ? 'bg-gray-50 border-gray-300' : 'bg-white hover:shadow-lg'
              }`}>
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-lg font-bold ${gameLocked ? 'text-gray-500' : 'text-gray-900'}`}>
                        {getMascotName(game.away)} @ {getMascotName(game.home)}
                      </span>
                      <span className={`text-sm ml-3 ${gameLocked ? 'text-gray-400' : 'text-gray-500'}`}>
                        {formatGameTime(game.kickoff_et)}
                      </span>
                    </div>
                    {gameLocked && (
                      <div className="flex items-center text-red-600">
                        <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-medium">LOCKED</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {/* Away Team Option */}
                  <div
                    className={`flex items-center space-x-3 p-3 rounded border transition-colors ${
                      gameLocked
                        ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60'
                        : selectedTeam === game.away
                          ? 'border-green-500 bg-green-50 cursor-pointer'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                    }`}
                    onClick={() => !gameLocked && handleSpreadToggle(game.id, game.away, game.spread_away)}
                  >
                    <input
                      type="radio"
                      name={`playoff-spread-${game.id}`}
                      checked={selectedTeam === game.away}
                      onChange={() => !gameLocked && handleSpreadToggle(game.id, game.away, game.spread_away)}
                      disabled={gameLocked}
                      className="h-4 w-4 text-green-600 focus:ring-green-500"
                    />
                    {getTeamLogo(game.away) && (
                      <img
                        src={getTeamLogo(game.away)}
                        alt={game.away}
                        className="w-8 h-8 object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1">
                      <div className={`font-medium ${gameLocked ? 'text-gray-500' : 'text-gray-900'}`}>
                        {game.away}
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${gameLocked ? 'text-gray-400' : 'text-green-600'}`}>
                      {game.spread_away > 0 ? `+${game.spread_away}` : game.spread_away}
                    </div>
                  </div>

                  {/* Home Team Option */}
                  <div
                    className={`flex items-center space-x-3 p-3 rounded border transition-colors ${
                      gameLocked
                        ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60'
                        : selectedTeam === game.home
                          ? 'border-green-500 bg-green-50 cursor-pointer'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 cursor-pointer'
                    }`}
                    onClick={() => !gameLocked && handleSpreadToggle(game.id, game.home, game.spread_home)}
                  >
                    <input
                      type="radio"
                      name={`playoff-spread-${game.id}`}
                      checked={selectedTeam === game.home}
                      onChange={() => !gameLocked && handleSpreadToggle(game.id, game.home, game.spread_home)}
                      disabled={gameLocked}
                      className="h-4 w-4 text-green-600 focus:ring-green-500"
                    />
                    {getTeamLogo(game.home) && (
                      <img
                        src={getTeamLogo(game.home)}
                        alt={game.home}
                        className="w-8 h-8 object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1">
                      <div className={`font-medium ${gameLocked ? 'text-gray-500' : 'text-gray-900'}`}>
                        {game.home}
                      </div>
                    </div>
                    <div className={`text-lg font-bold ${gameLocked ? 'text-gray-400' : 'text-green-600'}`}>
                      {game.spread_home > 0 ? `+${game.spread_home}` : game.spread_home}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Over/Under Picks Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          Over/Under Picks
          <span className={`ml-2 text-sm font-normal ${totalPicks.length > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
            ({totalPicks.length}/2 selected)
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map(game => {
            const selectedTotal = getTotalSelectionState(game.id);
            const gameLocked = isGameLocked(game);
            const hasSelection = selectedTotal !== null;
            const canSelect = canAddMoreTotals || hasSelection;

            return (
              <div key={`total-${game.id}`} className={`border rounded-lg p-4 shadow-md transition-shadow ${
                gameLocked ? 'bg-gray-50 border-gray-300' : 'bg-white hover:shadow-lg'
              }`}>
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${gameLocked ? 'text-gray-500' : 'text-gray-900'}`}>
                      {getMascotName(game.away)} @ {getMascotName(game.home)}
                    </span>
                    <span className={`text-lg font-semibold ${gameLocked ? 'text-gray-400' : 'text-blue-600'}`}>
                      O/U {game.total}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  {/* Over Button */}
                  <button
                    className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold transition-colors ${
                      gameLocked
                        ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : selectedTotal === 'OVER'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : canSelect
                            ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700'
                            : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                    onClick={() => !gameLocked && canSelect && handleTotalToggle(game.id, 'OVER', game.total)}
                    disabled={gameLocked || !canSelect}
                  >
                    OVER {game.total}
                  </button>

                  {/* Under Button */}
                  <button
                    className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold transition-colors ${
                      gameLocked
                        ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                        : selectedTotal === 'UNDER'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : canSelect
                            ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-700'
                            : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                    onClick={() => !gameLocked && canSelect && handleTotalToggle(game.id, 'UNDER', game.total)}
                    disabled={gameLocked || !canSelect}
                  >
                    UNDER {game.total}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={!selectedUser || !allSpreadsSelected || !allTotalsSelected || (hasExistingPicks && !arePicksModified())}
        className={`w-full py-3 px-4 rounded-md text-lg font-semibold ${
          !selectedUser || !allSpreadsSelected || !allTotalsSelected
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : hasExistingPicks && !arePicksModified()
              ? 'bg-green-600 text-white cursor-not-allowed'
              : hasExistingPicks && arePicksModified()
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-green-600 text-white hover:bg-green-700'
        }`}
      >
        {getButtonText()}
      </button>
      {selectedUser && (!allSpreadsSelected || !allTotalsSelected) && (
        <p className="text-sm text-orange-600 mt-2 text-center">
          {!allSpreadsSelected && !allTotalsSelected
            ? `Select all ${games.length} spread picks and all ${games.length} O/U picks to save`
            : !allSpreadsSelected
              ? `Select all ${games.length} spread picks to save`
              : `Select all ${games.length} O/U picks to save`}
        </p>
      )}
    </div>
  );
}

function PlayoffPickChart({ picks, users, currentPlayoffWeek, teamAbbreviations }: PlayoffPickChartProps) {
  const [selectedWeek, setSelectedWeek] = useState(currentPlayoffWeek);
  const [games, setGames] = useState<Game[]>([]);

  const playoffWeeks = seasonConfig.playoffRounds.map(round => ({
    week: round.week,
    name: round.name,
    file: round.linesFile,
  }));

  // Only show weeks up to and including the current playoff week
  const availableWeeks = playoffWeeks.filter(w => w.week <= currentPlayoffWeek);

  useEffect(() => {
    const loadGamesForWeek = async () => {
      const weekInfo = playoffWeeks.find(w => w.week === selectedWeek);
      if (!weekInfo) return;

      try {
        const response = await fetch(`${process.env.PUBLIC_URL}/lines/${weekInfo.file}`);
        if (!response.ok) {
          throw new Error(`${weekInfo.file} returned HTTP ${response.status}`);
        }
        const csvText = await response.text();

        Papa.parse(csvText, {
          header: true,
          complete: (results) => {
            const csvGames: Game[] = results.data.map((row: any, index: number) => ({
              id: `playoff-${index + 1}`,
              kickoff_et: row.kickoff_et,
              away: row.away,
              home: row.home,
              spread_away: parseFloat(row.spread_away),
              spread_home: parseFloat(row.spread_home),
              total: parseFloat(row.total),
              spreads_book: row.spreads_book
            })).filter((game: Game) => game.away && game.home);

            setGames(csvGames);
          },
          error: (error: any) => {
            console.error(`Error parsing ${weekInfo.file}:`, error);
            setGames([]);
          }
        });
      } catch (error) {
        console.error('Error loading playoff games:', error);
        setGames([]);
      }
    };

    loadGamesForWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek]);

  const getAbbreviation = (teamName: string) => {
    return teamAbbreviations[teamName] || teamName.substring(0, 3).toUpperCase();
  };

  // Get picks for the selected playoff week
  const playoffPicks = picks.filter(p => p.week === selectedWeek);

  // Get unique game matchups from the games list
  const gameMatchups = games.map((game: Game) => ({
    id: game.id,
    away: game.away,
    home: game.home,
    total: game.total,
    awayAbbr: getAbbreviation(game.away),
    homeAbbr: getAbbreviation(game.home),
    awayMascot: getMascotName(game.away),
    homeMascot: getMascotName(game.home)
  }));

  // Calculate totals for each user
  const getUserTotals = (userId: string) => {
    const userPicks = playoffPicks.find(p => p.userId === userId);
    if (!userPicks) return { correct: 0, total: 0 };

    // Pushes count in the total, pending picks don't
    const record = calcRecord(userPicks.picks);
    return { correct: record.wins, total: record.graded };
  };

  // Check if any user has O/U picks for this week
  const hasAnyTotalPicks = playoffPicks.some(p =>
    p.picks.some(pick => pick.pickType === 'total')
  );

  return (
    <div>
      {/* Week Selector */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {availableWeeks.map(week => (
            <button
              key={week.week}
              onClick={() => setSelectedWeek(week.week)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                selectedWeek === week.week
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {week.name}
            </button>
          ))}
        </div>
      </div>

      {/* Super Bowl: Single consolidated table with all 6 picks per user */}
      {selectedWeek === 103 ? (
        <div className="mb-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead style={{ background: 'linear-gradient(to right, #69BE28, #002244)' }}>
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-white uppercase tracking-wider sticky left-0 z-10" style={{ background: '#69BE28' }}>
                    User
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    Spread
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    O/U
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    1H Spread
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    1H O/U
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    Prop 1
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider">
                    Prop 2
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-white uppercase tracking-wider" style={{ background: '#002244' }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map(user => {
                  const userPick = playoffPicks.find(p => p.userId === user.id);
                  const totals = getUserTotals(user.id);

                  // Get all 6 picks
                  const game = gameMatchups[0]; // Super Bowl only has 1 game
                  const spreadPick = userPick?.picks.find(p => p.gameId === game?.id && (!p.pickType || p.pickType === 'spread'));
                  const totalPick = userPick?.picks.find(p => p.gameId === game?.id && p.pickType === 'total');
                  const spreadH1Pick = userPick?.picks.find(p => p.pickType === 'spread_h1');
                  const totalH1Pick = userPick?.picks.find(p => p.pickType === 'total_h1');
                  const prop1Pick = userPick?.picks.find(p => p.pickType === 'prop1');
                  const prop2Pick = userPick?.picks.find(p => p.pickType === 'prop2');

                  const renderSpreadPick = (pick: typeof spreadPick) => {
                    if (!pick) return <span className="text-gray-400">-</span>;
                    const isCorrect = pick.correct === true;
                    const isIncorrect = pick.correct === false;
                    const isPush = pick.result === 'P';
                    return (
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                        isCorrect ? 'bg-green-100 text-green-800' :
                        isIncorrect ? 'bg-red-100 text-red-800' :
                        isPush ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getAbbreviation(pick.team)}
                        {pick.spread > 0 ? ` +${pick.spread}` : ` ${pick.spread}`}
                      </span>
                    );
                  };

                  const renderTotalPick = (pick: typeof totalPick) => {
                    if (!pick) return <span className="text-gray-400">-</span>;
                    const isCorrect = pick.correct === true;
                    const isIncorrect = pick.correct === false;
                    const isPush = pick.result === 'P';
                    return (
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                        isCorrect ? 'bg-green-100 text-green-800' :
                        isIncorrect ? 'bg-red-100 text-red-800' :
                        isPush ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {pick.team} {pick.spread}
                      </span>
                    );
                  };

                  const renderPropPick = (pick: typeof prop1Pick) => {
                    if (!pick) return <span className="text-gray-400">-</span>;
                    const isCorrect = pick.correct === true;
                    const isIncorrect = pick.correct === false;
                    let displayText = pick.team;
                    if (pick.propSelection && pick.propSelection !== 'YES') {
                      displayText = `${pick.propSelection}: ${pick.team}`;
                    }
                    if (displayText.length > 25) {
                      displayText = displayText.substring(0, 22) + '...';
                    }
                    return (
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                        isCorrect ? 'bg-green-100 text-green-800' :
                        isIncorrect ? 'bg-red-100 text-red-800' :
                        'bg-purple-100 text-purple-800'
                      }`} title={pick.team}>
                        {displayText}
                      </span>
                    );
                  };

                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                        {user.name}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        {renderSpreadPick(spreadPick)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        {renderTotalPick(totalPick)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        {renderSpreadPick(spreadH1Pick)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        {renderTotalPick(totalH1Pick)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        {renderPropPick(prop1Pick)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center">
                        {renderPropPick(prop2Pick)}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-bold">
                        {totals.total > 0 ? (
                          <span className={totals.correct > 0 ? 'text-green-600' : 'text-gray-600'}>
                            {totals.correct}/{totals.total}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Non-Super Bowl: Original spread and O/U tables */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Spread Picks</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                      User
                    </th>
                    {gameMatchups.map((game: { id: string; away: string; home: string; total: number; awayAbbr: string; homeAbbr: string; awayMascot: string; homeMascot: string }) => (
                      <th key={game.id} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div>{game.awayMascot}</div>
                        <div className="text-gray-400">@</div>
                        <div>{game.homeMascot}</div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map(user => {
                    const userPick = playoffPicks.find(p => p.userId === user.id);
                    const totals = getUserTotals(user.id);

                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                          {user.name}
                        </td>
                        {gameMatchups.map((game: { id: string; away: string; home: string; total: number; awayAbbr: string; homeAbbr: string; awayMascot: string; homeMascot: string }) => {
                          const pick = userPick?.picks.find(p => p.gameId === game.id && (!p.pickType || p.pickType === 'spread'));

                          if (!pick) {
                            return (
                              <td key={game.id} className="px-3 py-4 whitespace-nowrap text-center text-sm text-gray-400">
                                -
                              </td>
                            );
                          }

                          const isCorrect = pick.correct === true;
                          const isIncorrect = pick.correct === false;
                          const isPush = pick.result === 'P';

                          return (
                            <td key={game.id} className="px-3 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                                isCorrect ? 'bg-green-100 text-green-800' :
                                isIncorrect ? 'bg-red-100 text-red-800' :
                                isPush ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {getAbbreviation(pick.team)}
                                {pick.spread > 0 ? ` +${pick.spread}` : ` ${pick.spread}`}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-4 whitespace-nowrap text-center text-sm font-bold">
                          {totals.total > 0 ? (
                            <span className={totals.correct > 0 ? 'text-green-600' : 'text-gray-600'}>
                              {totals.correct}/{totals.total}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Over/Under Picks Table - Only show if there are any O/U picks */}
          {(hasAnyTotalPicks || selectedWeek >= 101) && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Over/Under Picks</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-blue-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-blue-50 z-10">
                        User
                      </th>
                      {gameMatchups.map((game: { id: string; away: string; home: string; total: number; awayAbbr: string; homeAbbr: string; awayMascot: string; homeMascot: string }) => (
                        <th key={`ou-${game.id}`} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <div>{game.awayMascot} @ {game.homeMascot}</div>
                          <div className="text-blue-600">O/U {game.total}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map(user => {
                      const userPick = playoffPicks.find(p => p.userId === user.id);

                      return (
                        <tr key={`ou-${user.id}`} className="hover:bg-gray-50">
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                            {user.name}
                          </td>
                          {gameMatchups.map((game: { id: string; away: string; home: string; total: number; awayAbbr: string; homeAbbr: string; awayMascot: string; homeMascot: string }) => {
                            const pick = userPick?.picks.find(p => p.gameId === game.id && p.pickType === 'total');

                            if (!pick) {
                              return (
                                <td key={`ou-${game.id}`} className="px-3 py-4 whitespace-nowrap text-center text-sm text-gray-400">
                                  -
                                </td>
                              );
                            }

                            const isCorrect = pick.correct === true;
                            const isIncorrect = pick.correct === false;
                            const isPush = pick.result === 'P';

                            return (
                              <td key={`ou-${game.id}`} className="px-3 py-4 whitespace-nowrap text-center">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                                  isCorrect ? 'bg-green-100 text-green-800' :
                                  isIncorrect ? 'bg-red-100 text-red-800' :
                                  isPush ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {pick.team} {pick.spread}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}



export default App;
