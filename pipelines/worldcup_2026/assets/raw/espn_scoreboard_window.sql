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
    SELECT content::JSON AS payload
    FROM read_text('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=300')
),
events AS (
    SELECT unnest(json_extract(payload, '$.events')::JSON[]) AS event
    FROM payload
)
SELECT
    json_extract_string(event, '$.id') AS id,
    json_extract_string(event, '$.uid') AS uid,
    json_extract_string(event, '$.date') AS date,
    json_extract_string(event, '$.name') AS name,
    json_extract_string(event, '$.shortName') AS short_name,
    json_extract(event, '$.season') AS season,
    json_extract(event, '$.competitions') AS competitions,
    json_extract(event, '$.status') AS status,
    json_extract(event, '$.venue') AS venue,
    json_extract(event, '$.links') AS links,
    CURRENT_TIMESTAMP AS ingested_at
FROM events
