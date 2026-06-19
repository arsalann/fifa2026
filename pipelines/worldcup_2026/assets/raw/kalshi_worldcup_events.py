from urllib.request import Request, urlopen
import json


URL = "https://external-api.kalshi.com/trade-api/v2/events?series_ticker=KXMENWORLDCUP&status=open&with_nested_markets=true&limit=200"


def fetch_payload():
    request = Request(URL, headers={"User-Agent": "fifa2026-bruin-pipeline/1.0"})
    with urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def event_row(event):
    return {
        "event_ticker": event.get("event_ticker"),
        "series_ticker": event.get("series_ticker"),
        "sub_title": event.get("sub_title"),
        "title": event.get("title"),
        "category": event.get("category"),
        "strike_date": event.get("strike_date"),
        "strike_period": event.get("strike_period"),
        "created_time": event.get("created_time"),
        "updated_time": event.get("updated_time") or event.get("last_updated_ts"),
        "markets": json.dumps(event.get("markets") or [], separators=(",", ":"), ensure_ascii=False),
        "raw": json.dumps(event, separators=(",", ":"), ensure_ascii=False),
    }


def materialize():
    payload = fetch_payload()
    return [event_row(event) for event in payload.get("events", [])]
