# World Cup 2026 App

A recreated version of `worldcup-teams-stats`: a static React/Vite app for World
Cup 2026 groups, schedule, teams, bracket, scorers, and comparisons, with a
Bruin pipeline scaffold for API-backed ingestion.

## App

```bash
npm install
npm run dev
npm test
npm run build
```

## Netlify

This repo is ready to deploy as a static Netlify site. `netlify.toml` sets:

- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `20`
- Netlify Function read endpoint for live schedule data from MotherDuck
- No-cache headers for `/data/bruin/*`
- SPA fallback to `index.html`

Set `MOTHERDUCK_TOKEN` in Netlify for the read-only MotherDuck token. The
deployed app polls `/.netlify/functions/bruin-schedule` first, then falls back
to the committed Bruin exports under `public/data/bruin/` if the function is
unavailable. Run `npm run pipeline:refresh` before deploying when you want to
refresh MotherDuck and regenerate those fallback JSON files.

The app runtime reads Bruin-generated data. `src/data/bruin/` is bundled as a
fallback, and `public/data/bruin/` is fetched as a second fallback so a fresh
pipeline export can be picked up without changing browser code:

- `schedule.json` - app-ready matches from Bruin marts.
- `teams.json` - team metadata from Bruin-ingested reference data.
- `details.json` - ESPN match summaries exported from `raw.espn_match_summary`
  and scoreboard fallback rows in MotherDuck.
- `schedule.json` also carries betting-market insights from Bruin marts: team
  futures and match-level correct-score markets when provider data is available.

The original reference JSON under `src/data/` remains only as a Bruin ingestion
input. The browser no longer fetches ESPN or openfootball directly.

## Bruin Pipeline

The Bruin project lives in `pipelines/worldcup_2026` and targets the `fifa`
database in MotherDuck.

```bash
cp .bruin.yml.example .bruin.yml
export MOTHERDUCK_TOKEN=...

npm run pipeline:validate
npm run pipeline:refresh
npm run dev
```

The raw layer uses ESPN for the live-score overlay, match summaries, and
lineups; Kalshi and Polymarket public markets for betting insights; plus
curated local reference JSON for the tournament schedule and team metadata.

See `pipelines/worldcup_2026/README.md` for the source/table map and the current
tooling limitation around the unreleased soccer URI schemes.
