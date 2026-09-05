# season.py — shared season/config helpers for the data pipeline.
# The single source of truth is nfl-pickem/public/season.json, which the
# deployed React app reads too. Nothing about the calendar is hardcoded here.
import datetime as dt
import json
import os
from pathlib import Path

import pytz

REPO_ROOT = Path(__file__).resolve().parent.parent
SEASON_JSON = REPO_ROOT / "nfl-pickem" / "public" / "season.json"

LINES_DIR = REPO_ROOT / "data" / "lines"
RESULTS_DIR = REPO_ROOT / "data" / "results"
PICKS_DIR = REPO_ROOT / "data" / "picks"
PICK_RESULTS_DIR = REPO_ROOT / "data" / "pick_results"
WEATHER_DIR = REPO_ROOT / "data" / "weather"
PUBLIC_DIR = REPO_ROOT / "nfl-pickem" / "public"
PUBLIC_LINES_DIR = PUBLIC_DIR / "lines"
PUBLIC_RESULTS_DIR = PUBLIC_DIR / "results"

ET = pytz.timezone("America/New_York")


def load_season_config() -> dict:
    with open(SEASON_JSON) as f:
        return json.load(f)


def week1_start_et(config: dict = None) -> dt.datetime:
    """Week 1 starts Tuesday 08:00 ET (from season.json week1TuesdayEt)."""
    config = config or load_season_config()
    day = dt.datetime.strptime(config["week1TuesdayEt"], "%Y-%m-%d")
    return ET.localize(day.replace(hour=8, minute=0))


def week_window_et(week: int, config: dict = None):
    """[start, end) window for a week: Tuesday 08:00 ET to next Tuesday 08:00 ET."""
    start = week1_start_et(config) + dt.timedelta(days=7 * (week - 1))
    return start, start + dt.timedelta(days=7, seconds=-1)


def current_week(config: dict = None, now: dt.datetime = None) -> int:
    """Same computation as seasonConfig.ts: clamped to [1, regularSeasonWeeks]."""
    config = config or load_season_config()
    now = now or dt.datetime.now(dt.timezone.utc)
    delta = now - week1_start_et(config)
    week = delta.days // 7 + 1
    return min(max(week, 1), config.get("regularSeasonWeeks", 18))


def read_api_key(env_var: str, key_file: str) -> str:
    """API key from the environment (CI) or the local .keys/ folder (laptop)."""
    key = os.environ.get(env_var)
    if key:
        return key.strip()
    path = REPO_ROOT / ".keys" / key_file
    if path.exists():
        return path.read_text().strip()
    raise SystemExit(f"No API key: set {env_var} or create {path}")


def lines_csv_paths(week: int):
    """(archive path, deployed path) for a week's lines file."""
    name = f"nfl_lines_week{week}.csv"
    return LINES_DIR / name, PUBLIC_LINES_DIR / name


def results_csv_paths(week: int):
    """(archive path, deployed path) for a week's results file."""
    name = f"nfl_results_week{week}.csv"
    return RESULTS_DIR / name, PUBLIC_RESULTS_DIR / name
