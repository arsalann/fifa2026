/* @bruin
name: raw.reference_teams_json
description: Curated team history and metadata JSON ingested into DuckDB for app export.
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
FROM (
    SELECT 1 AS priority, *
    FROM read_text('pipelines/worldcup_2026/reference/teams.json')
    UNION ALL
    SELECT 2 AS priority, *
    FROM read_text('reference/teams.json')
    UNION ALL
    SELECT 3 AS priority, *
    FROM read_text('../../reference/teams.json')
    UNION ALL
    SELECT 4 AS priority, *
    FROM read_text('src/data/teams.json')
    UNION ALL
    SELECT 5 AS priority, *
    FROM read_text('../../src/data/teams.json')
    UNION ALL
    SELECT 6 AS priority, *
    FROM read_text('../../../src/data/teams.json')
    UNION ALL
    SELECT 7 AS priority, *
    FROM read_text('../../../../src/data/teams.json')
)
WHERE content IS NOT NULL
QUALIFY ROW_NUMBER() OVER (ORDER BY priority) = 1
