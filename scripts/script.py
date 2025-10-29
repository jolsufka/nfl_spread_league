# nfl_week_lines.py
import os, sys, argparse, datetime as dt, pytz, requests, pandas as pd

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

def fetch_market(api_key: str, market: str, t_from_iso: str, t_to_iso: str):
    url = f"https://api.the-odds-api.com/v4/sports/{SPORT}/odds"
    params = {
        "regions": REGION,
        "markets": market,
        "oddsFormat": ODDS_FORMAT,
        "apiKey": api_key,
        "commenceTimeFrom": t_from_iso,
        "commenceTimeTo": t_to_iso,
    }
    r = requests.get(url, params=params, timeout=25)
    r.raise_for_status()
    return r.json()

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
    cols = ["kickoff_et","away","home",
            "spread_away","spread_away_price","spread_home","spread_home_price",
            "total","over_price","under_price",
            "ml_away","ml_home",
            "spreads_book","totals_book","h2h_book"]
    for c in cols:
        if c not in df.columns:
            df[c] = None
    return df[cols].sort_values("kickoff_et").reset_index(drop=True)

def main():
    ap = argparse.ArgumentParser(description="Fetch NFL odds table for a single week window.")
    ap.add_argument("--api-key", default=os.getenv("ODDS_API_KEY"),
                    help="The Odds API key (or set ODDS_API_KEY).")
    # Option A: pass a calendar start datetime (ET)
    ap.add_argument("--start-et", help='Week start ET (e.g., "2025-09-02 08:00")')
    # Option B: season/week style given a known week 1 start
    ap.add_argument("--week1-start-et", help='NFL Week 1 start ET (e.g., "2025-09-02 08:00")')
    ap.add_argument("--week", type=int, help="NFL week number (1..postseason as you define)")
    ap.add_argument("--days", type=int, default=7, help="Length of window in days (default 7).")
    ap.add_argument("--csv", help="Output CSV path (if not specified, uses nfl_lines_week{N}.csv format).")
    args = ap.parse_args()

    if not args.api_key:
        sys.exit("Missing API key. Use --api-key or set ODDS_API_KEY.")

    tz = pytz.timezone("America/New_York")
    if args.start_et:
        start = tz.localize(dt.datetime.strptime(args.start_et, "%Y-%m-%d %H:%M"))
        end = start + dt.timedelta(days=args.days, seconds=-1)
        week_num = None
    elif args.week1_start_et and args.week:
        start, end = week_window_from_weeknum(args.week1_start_et, args.week)
        week_num = args.week
    else:
        sys.exit("Provide either --start-et OR (--week1-start-et AND --week).")

    # Auto-generate CSV filename if not provided
    if not args.csv:
        if week_num:
            args.csv = f"data/lines/nfl_lines_week{week_num}.csv"
        else:
            args.csv = "data/lines/nfl_lines_week.csv"

    t_from = iso_z(start)
    t_to   = iso_z(end)

    # fetch each market within the window
    spreads = fetch_market(args.api_key, "spreads", t_from, t_to)
    totals  = fetch_market(args.api_key, "totals",  t_from, t_to)
    money   = fetch_market(args.api_key, "h2h",     t_from, t_to)

    df = build_frame(spreads, totals, money)
    if df.empty:
        print("No games/odds in that window.")
        return
    print(df.to_string(index=False))
    df.to_csv(args.csv, index=False)
    print(f"\nSaved: {args.csv}")

if __name__ == "__main__":
    main()