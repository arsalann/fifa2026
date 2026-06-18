/* @bruin
name: raw.reference_schedule_json
description: Curated tournament schedule JSON ingested into DuckDB for app export.
connection: motherduck-fifa

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
FROM read_text('src/data/schedule.json')
