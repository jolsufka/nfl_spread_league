# nfl_week_lines.py
import os, sys, argparse, datetime as dt, time, pytz, requests, pandas as pd

from season import (
    load_season_config,
    current_week,
    week_window_et,
    read_api_key,
    lines_csv_paths,
)

SPORT = "americanfootball_nfl"
REGION = "us"                      # US books
MARKETS = ["spreads","totals","h2h"]
ODDS_FORMAT = "american"
PREFERRED_BOOKS = ("DraftKings","FanDuel","BetMGM","Caesars")

def iso_z(dt_aware):
    return dt_aware.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def get_week_window_et(
    start_et: dt.datetime,
    days: int = 7
):
    tz = pytz.timezone("America/New_York")
    start = tz.localize(start_et) if start_et.tzinfo is None else start_et.astimezone(tz)
    end = start + dt.timedelta(days=days, seconds=-1)
    return start, end

def week_window_from_weeknum(week1_start_et_str: str, week: int):
    # Example: week1_start_et_str="2025-09-02 08:00" (Tue 8am ET -> your house rule)
    tz = pytz.timezone("America/New_York")
    w1 = tz.localize(dt.datetime.strptime(week1_start_et_str, "%Y-%m-%d %H:%M"))
    start = w1 + dt.timedelta(days=7*(week-1))
    end = start + dt.timedelta(days=7, seconds=-1)
    return start, end

def fetch_market(api_key: str, market: str, t_from_iso: str, t_to_iso: str, retries: int = 3):
    url = f"https://api.the-odds-api.com/v4/sports/{SPORT}/odds"
    params = {
        "regions": REGION,
        "markets": market,
        "oddsFormat": ODDS_FORMAT,
        "apiKey": api_key,
        "commenceTimeFrom": t_from_iso,
        "commenceTimeTo": t_to_iso,
    }
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=25)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            if attempt == retries - 1:
                raise
            wait = 10 * (attempt + 1)
            print(f"{market} fetch failed ({e}); retrying in {wait}s")
            time.sleep(wait)

def pick_book(books, preferred=PREFERRED_BOOKS):
    by_name = {b["title"]: b for b in books}
    for name in preferred:
        if name in by_name:
            return by_name[name]
    return books[0] if books else None

def index_market(events, kind):
    rows = {}
    for g in events:
        key = g["id"]
        book = pick_book(g.get("bookmakers", []))
        if not book: 
            continue
        market = next((m for m in book.get("markets", []) if m["key"]==kind), None)
        if not market:
            continue
        outcomes = {o["name"]: o for o in market["outcomes"]}
        row = rows.setdefault(key, {
            "game_id": key,
            "commence_time": g["commence_time"],
            "home": g["home_team"],
            "away": g["away_team"],
        })
        if kind == "spreads":
            row.update({
                "spread_home": outcomes.get(row["home"],{}).get("point"),
                "spread_home_price": outcomes.get(row["home"],{}).get("price"),
                "spread_away": outcomes.get(row["away"],{}).get("point"),
                "spread_away_price": outcomes.get(row["away"],{}).get("price"),
                "spreads_book": book["title"],
            })
        elif kind == "totals":
            row.update({
                "total": outcomes.get("Over",{}).get("point"),
                "over_price": outcomes.get("Over",{}).get("price"),
                "under_price": outcomes.get("Under",{}).get("price"),
                "totals_book": book["title"],
            })
        elif kind == "h2h":
            row.update({
                "ml_home": outcomes.get(row["home"],{}).get("price"),
                "ml_away": outcomes.get(row["away"],{}).get("price"),
                "h2h_book": book["title"],
            })
    return rows

def build_frame(spreads, totals, money):
    ix = {}
    for d in (index_market(spreads,"spreads"),
              index_market(totals,"totals"),
              index_market(money,"h2h")):
        for k,v in d.items():
            ix.setdefault(k, {}).update(v)
    df = pd.DataFrame(list(ix.values()))
    if df.empty:
        return df
    df["kickoff_et"] = pd.to_datetime(df["commence_time"], utc=True).dt.tz_convert("America/New_York")
    df["event_id"] = df["game_id"]  # The Odds API's stable event id
    cols = ["kickoff_et","away","home",
            "spread_away","spread_away_price","spread_home","spread_home_price",
            "total","over_price","under_price",
            "ml_away","ml_home",
            "spreads_book","totals_book","h2h_book","event_id"]
    for c in cols:
        if c not in df.columns:
            df[c] = None
    df = df[cols].sort_values("kickoff_et").reset_index(drop=True)
    # Explicit row ids matching the app's game-id convention (row order, 1..N)
    df.insert(0, "id", [str(i + 1) for i in range(len(df))])
    return df

def apply_refresh_merge(df, existing_path):
    """Stabilize a refreshed fetch against the previously published lines.

    Picks reference games by id, so a refresh must NEVER renumber games:
    existing events (matched by The Odds API event_id) keep their id and
    their opening lines; brand-new events get the next free ids. Every row
    gets a fetched_at stamp for the app's freshness display.
    """
    now_et = dt.datetime.now(pytz.timezone("America/New_York"))
    if existing_path is not None and os.path.exists(str(existing_path)):
        old = pd.read_csv(existing_path, dtype={"id": str, "event_id": str})
        old_by_event = {
            str(row["event_id"]): row
            for _, row in old.iterrows()
            if pd.notna(row.get("event_id"))
        }
        used_ids = [int(row["id"]) for _, row in old.iterrows()
                    if str(row.get("id", "")).isdigit()]
        next_id = max(used_ids) + 1 if used_ids else 1

        def carry(prev, opening_col, current_col):
            value = prev.get(opening_col)
            return value if pd.notna(value) else prev.get(current_col)

        ids, opening_away, opening_home, opening_total = [], [], [], []
        for _, row in df.iterrows():
            prev = old_by_event.get(str(row["event_id"]))
            if prev is not None:
                ids.append(str(prev["id"]))
                opening_away.append(carry(prev, "opening_spread_away", "spread_away"))
                opening_home.append(carry(prev, "opening_spread_home", "spread_home"))
                opening_total.append(carry(prev, "opening_total", "total"))
            else:
                ids.append(str(next_id))
                next_id += 1
                opening_away.append(row["spread_away"])
                opening_home.append(row["spread_home"])
                opening_total.append(row["total"])
        df["id"] = ids
        df["opening_spread_away"] = opening_away
        df["opening_spread_home"] = opening_home
        df["opening_total"] = opening_total
        df = df.sort_values(by="id", key=lambda s: s.astype(int)).reset_index(drop=True)
    else:
        df["opening_spread_away"] = df["spread_away"]
        df["opening_spread_home"] = df["spread_home"]
        df["opening_total"] = df["total"]
    df["fetched_at"] = now_et.isoformat(timespec="seconds")
    return df

def main():
    ap = argparse.ArgumentParser(
        description="Fetch NFL lines for a week. Week timing comes from "
                    "nfl-pickem/public/season.json; the CSV is written to both "
                    "data/lines/ and nfl-pickem/public/lines/."
    )
    ap.add_argument("--api-key", default=None,
                    help="The Odds API key (default: ODDS_API_KEY env or .keys/odds_api_key)")
    ap.add_argument("--week", type=int, default=None,
                    help="NFL week number (default: current week from season.json)")
    ap.add_argument("--start-et", help='Override window start ET (e.g. "2026-09-08 08:00")')
    ap.add_argument("--days", type=int, default=7, help="Window length in days (default 7)")
    ap.add_argument("--csv", help="Override output path (skips the public/ copy)")
    ap.add_argument("--force", action="store_true",
                    help="Overwrite an existing lines file (changes spreads users picked against!)")
    ap.add_argument("--refresh", action="store_true",
                    help="Refresh lines in place: game ids and opening lines are preserved "
                         "(picks grade against their own saved spread, so this is safe)")
    ap.add_argument("--skip-if-exists", action="store_true",
                    help="Exit 0 quietly if the lines file already exists (for scheduled runs)")
    args = ap.parse_args()

    api_key = args.api_key or read_api_key("ODDS_API_KEY", "odds_api_key")
    config = load_season_config()

    tz = pytz.timezone("America/New_York")
    if args.start_et:
        start = tz.localize(dt.datetime.strptime(args.start_et, "%Y-%m-%d %H:%M"))
        end = start + dt.timedelta(days=args.days, seconds=-1)
        week_num = args.week
    else:
        week_num = args.week if args.week is not None else current_week(config)
        start, end = week_window_et(week_num, config)

    if args.csv:
        outputs = [args.csv]
    elif week_num:
        archive_path, public_path = lines_csv_paths(week_num)
        outputs = [archive_path, public_path]
    else:
        sys.exit("Provide --week (or --csv) when using --start-et.")

    existing = [str(p) for p in outputs if os.path.exists(p)]
    if existing and not args.force and not args.refresh:
        if args.skip_if_exists:
            print(f"Lines already fetched ({existing[0]}); nothing to do.")
            return
        sys.exit(
            "Refusing to overwrite existing lines (picks may reference them): "
            + ", ".join(existing) + "\nUse --refresh to update lines in place "
            "(ids/openings preserved) or --force to clobber."
        )

    t_from = iso_z(start)
    t_to   = iso_z(end)

    spreads = fetch_market(api_key, "spreads", t_from, t_to)
    totals  = fetch_market(api_key, "totals",  t_from, t_to)
    money   = fetch_market(api_key, "h2h",     t_from, t_to)

    df = build_frame(spreads, totals, money)
    if df.empty:
        sys.exit(f"No games/odds between {start} and {end} — wrong week or season.json?")
    df = apply_refresh_merge(df, existing[0] if existing else None)
    print(df[["id","kickoff_et","away","home","spread_away","spread_home","total"]].to_string(index=False))
    for out in outputs:
        os.makedirs(os.path.dirname(str(out)) or ".", exist_ok=True)
        df.to_csv(out, index=False)
        print(f"Saved: {out}")

if __name__ == "__main__":
    main()