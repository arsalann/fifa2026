/* @bruin
name: raw.espn_scoreboard_window
description: |
  Full-window ESPN World Cup scoreboard backfill. This Bruin SQL asset loads
  the full tournament date range so the first run backfills historical results
  and later runs refresh the same event IDs with the latest ESPN state.
connection: motherduck-fifa

materialization:
  type: table
  strategy: create+replace

columns:
  - name: id
    type: varchar
    primary_key: true
    checks:
      - name: not_null
  - name: uid
    type: varchar
    update_on_merge: true
  - name: date
    type: varchar
    update_on_merge: true
  - name: name
    type: varchar
    update_on_merge: true
  - name: short_name
    type: varchar
    update_on_merge: true
  - name: season
    type: varchar
    update_on_merge: true
  - name: competitions
    type: varchar
    update_on_merge: true
  - name: status
    type: varchar
    update_on_merge: true
  - name: venue
    type: varchar
    update_on_merge: true
  - name: links
    type: varchar
    update_on_merge: true
  - name: ingested_at
    type: timestamp
    update_on_merge: true

@bruin */

WITH events AS (
    SELECT unnest(events) AS event
    FROM read_json_auto(
        'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300',
        ignore_errors = true
    )
)
SELECT
    event.id AS id,
    event.uid AS uid,
    event.date AS date,
    event.name AS name,
    event.shortName AS short_name,
    to_json(event.season)::varchar AS season,
    to_json(event.competitions)::varchar AS competitions,
    to_json(event.status)::varchar AS status,
    to_json(event.venue)::varchar AS venue,
    to_json(event.links)::varchar AS links,
    CURRENT_TIMESTAMP AS ingested_at
FROM events
