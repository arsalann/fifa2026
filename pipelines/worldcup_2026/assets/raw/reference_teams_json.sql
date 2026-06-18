/* @bruin
name: raw.reference_teams_json
description: Curated team history and metadata JSON ingested into DuckDB for app export.

materialization:
  type: table

columns:
  - name: filename
    type: varchar
    primary_key: true
  - name: ingested_at
    type: timestamp
  - name: payload
    type: json

@bruin */

SELECT
    filename,
    CURRENT_TIMESTAMP AS ingested_at,
    content::JSON AS payload
FROM read_text('src/data/teams.json')
