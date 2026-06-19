"""@bruin
name: raw.espn_match_summary
description: ESPN match summary payloads for World Cup events, including rosters and starting XIs.
image: python:3.13
connection: motherduck-fifa

materialization:
  type: table
  strategy: create+replace

depends:
  - raw.espn_scoreboard_window

columns:
  - name: event_id
    type: varchar
    primary_key: true
    checks:
      - name: not_null
  - name: fetched_at
    type: timestamp
  - name: summary
    type: varchar
  - name: has_rosters
    type: boolean
  - name: roster_team_count
    type: integer
  - name: starter_count
    type: integer
  - name: error
    type: varchar
@bruin"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


LEAGUE = "fifa.world"
BASE_URL = f"https://site.api.espn.com/apis/site/v2/sports/soccer/{LEAGUE}"
SCOREBOARD_URL = f"{BASE_URL}/scoreboard?dates=20260611-20260719&limit=300"
SUMMARY_URL = f"{BASE_URL}/summary?event={{event_id}}"
MAX_WORKERS = 8
TIMEOUT_SECONDS = 30


def fetch_json(url):
    request = Request(url, headers={"User-Agent": "fifa2026-bruin-pipeline/1.0"})
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def event_ids_from_scoreboard():
    payload = fetch_json(SCOREBOARD_URL)
    ids = sorted(
        {
            str(event.get("id"))
            for event in payload.get("events", [])
            if event.get("id") is not None
        }
    )
    if not ids:
        raise RuntimeError("ESPN scoreboard returned no event IDs")
    return ids


def fetch_summary_row(event_id):
    fetched_at = datetime.now(timezone.utc).isoformat()
    try:
        summary = fetch_json(SUMMARY_URL.format(event_id=event_id))
        rosters = summary.get("rosters") or []
        starter_count = sum(
            1
            for roster in rosters
            for player in roster.get("roster", [])
            if player.get("starter")
        )
        return {
            "event_id": event_id,
            "fetched_at": fetched_at,
            "summary": json.dumps(summary, separators=(",", ":"), ensure_ascii=False),
            "has_rosters": bool(rosters),
            "roster_team_count": len(rosters),
            "starter_count": starter_count,
            "error": None,
        }
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        return {
            "event_id": event_id,
            "fetched_at": fetched_at,
            "summary": None,
            "has_rosters": False,
            "roster_team_count": 0,
            "starter_count": 0,
            "error": str(exc),
        }


def materialize():
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        return list(executor.map(fetch_summary_row, event_ids_from_scoreboard()))
