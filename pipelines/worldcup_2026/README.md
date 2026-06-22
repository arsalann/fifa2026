# World Cup 2026 Bruin Pipelines

These pipelines land FIFA World Cup 2026 soccer data into MotherDuck and export
app-ready JSON for the React app.

## Layout

- `pipelines/worldcup_2026`: live score pipeline, scheduled every 2 minutes.
  It refreshes curated schedule JSON, ESPN scoreboard rows, `marts.app_matches`,
  and `marts.app_live_manifest`.
- `pipelines/worldcup_2026_enrichment`: enrichment pipeline, scheduled hourly.
  It refreshes team metadata, ESPN summary/details, Kalshi/Polymarket markets,
  retained ESPN demo sources, and `marts.app_data_manifest`.
- MotherDuck database: `fifa`.
- `src/data/bruin/schedule.json`: generated app match data plus betting insights.
- `src/data/bruin/teams.json`: generated team metadata.
- `src/data/bruin/details.json`: generated match-summary data.
- `public/data/bruin/*.json`: refreshable browser-facing copies of the same
  generated data.

## Sources

The app-data paths use:

- ESPN full-window scoreboard data for match IDs, scores, status, and details.
- ESPN match-summary data for box scores, facts, rosters, and starting XIs.
- Kalshi public World Cup winner and correct-score events.
- Polymarket public World Cup search results for team futures, group winners,
  and knockout qualification markets.
- Curated local reference JSON for tournament schedule and team metadata.

The retained ESPN ingestr assets cover scoreboard, teams, competitors,
standings, and news. The app-score source is the DuckDB SQL full-window ESPN
asset, `raw.espn_scoreboard_window`. The lineup source is the Bruin Python
asset, `raw.espn_match_summary`, which lands ESPN summary payloads in
MotherDuck before export.

## Config

Copy `.bruin.yml.example` to `.bruin.yml`, add your MotherDuck token, and set
these environment variables:

```bash
export MOTHERDUCK_TOKEN=...
```

Then validate, run both app-data selectors, and export:

```bash
npm run pipeline:validate
npm run pipeline:refresh
```

`pipeline:run` runs `pipeline:run:live` first, then `pipeline:run:enrichment`.
The live selector executes the upstream assets needed for
`marts.app_live_manifest`: curated schedule ingestion, ESPN full-window
scoreboard ingestion, and `marts.app_matches`. The full-window ESPN asset loads
the whole tournament range on each run, which backfills historical results on
the first run and refreshes event rows on later runs. It is the app-score
source.

The enrichment selector executes the upstream assets needed for
`marts.app_data_manifest`: ESPN match-summary ingestion, Kalshi and Polymarket
public market ingestion, team/reference ingestion, retained ESPN source demos,
and app-facing betting/team/detail marts. `raw.espn_match_summary` refreshes one
summary payload per event ID so lineups stay warehouse-owned. The enrichment
manifest depends on live `marts.app_matches` by MotherDuck URI so Bruin Cloud
can model the cross-pipeline dependency.

`pipeline:export` uses
`bruin query` against the `motherduck-fifa` connection and serializes those
MotherDuck marts/raw rows into `src/data/bruin/` and `public/data/bruin/`. The
app uses only these generated files at runtime. Set `WORLDCUP_DUCKDB_PATH` only
when exporting from a local DuckDB file instead.

## Current Tooling Note

Bruin CLI `v0.11.633` recognizes and executes ESPN ingestr assets via its
embedded `ingestr` runner. The standalone `ingestr` binary installed as
`v1.0.34` still rejects the documented ESPN and soccer URI schemes, so run these
assets through `bruin run` instead of invoking the local `ingestr` binary
directly.
