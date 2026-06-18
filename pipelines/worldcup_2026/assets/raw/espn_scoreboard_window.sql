/* @bruin
name: raw.espn_scoreboard_window
description: |
  Full-window ESPN World Cup scoreboard backfill. This Bruin SQL asset loads
  the full tournament date range so the first run backfills historical results
  and later runs refresh the same event IDs with the latest ESPN state.
connection: motherduck-fifa

materialization:
  type: table
  strategy: truncate+insert

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
    type: json
    update_on_merge: true
  - name: competitions
    type: json
    update_on_merge: true
  - name: status
    type: json
    update_on_merge: true
  - name: venue
    type: json
    update_on_merge: true
  - name: links
    type: json
    update_on_merge: true
  - name: ingested_at
    type: timestamp
    update_on_merge: true

@bruin */

WITH payload AS (
    SELECT *
    FROM read_json_auto('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300')
),
events AS (
    SELECT unnest(events) AS event
    FROM payload
)
SELECT
    event.id::VARCHAR AS id,
    event.uid::VARCHAR AS uid,
    event.date::VARCHAR AS date,
    event.name::VARCHAR AS name,
    event.shortName::VARCHAR AS short_name,
    to_json(event.season) AS season,
    to_json(event.competitions) AS competitions,
    to_json(event.status) AS status,
    to_json(event.venue) AS venue,
    to_json(event.links) AS links,
    CURRENT_TIMESTAMP AS ingested_at
FROM events
