# Project Context

## Talk style - CAVEMAN SPEAK
Assistant chat replies use **caveman speak** to save tokens: short words, drop
little filler words (a / the / is), grug-style. Apply to conversational prose
only.

**Keep exact / normal English (never cavemanize):** code, code comments,
commit messages, PR titles and bodies, README, and any literal token: file
paths, env var names, commands, keys, IDs. Garbling those breaks things.

## What this is
Static React + Vite single-page app for the 2026 World Cup. HashRouter,
mobile-first, deployed on Netlify. No login.

- Data: Bruin ingests ESPN plus reference JSON into DuckDB, then exports
  app-ready JSON under `src/data/bruin/`. Runtime app imports those generated
  files; browser does not ingest provider APIs directly.
- All optional config via `VITE_*` env vars, set in Netlify (no code change):
  - Analytics: `VITE_POSTHOG_KEY` (+ `VITE_POSTHOG_HOST`). Off until key set.
- Everything env-gated stays a no-op when unset.

## Bruin workflow
Always use Bruin MCP and Bruin CLI for Bruin pipeline, ingestion, mart, export,
and data debugging work in this repository.

## Commands
- `npm run dev` - dev server
- `npm run build` - production build to `dist/`
- `npm test` - logic tests + server-renders every route (no browser needed)
- `npm run pipeline:run` - run Bruin app-data ingestion and marts
- `npm run pipeline:export` - export Bruin data into `src/data/bruin/`

Run `npm test` and `npm run build` before committing.
