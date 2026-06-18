/* @bruin
name: raw.reference_schedule_json
description: Curated tournament schedule JSON ingested into DuckDB for app export.
connection: motherduck-fifa

materialization:
  type: table
  strategy: truncate+insert

columns:
  - name: filename
    type: varchar
    primary_key: true
  - name: ingested_at
    type: timestamp
    update_on_merge: true
  - name: payload
    type: json
    update_on_merge: true

@bruin */

SELECT
    'schedule.json' AS filename,
    CURRENT_TIMESTAMP AS ingested_at,
    content::JSON AS payload
FROM (
    SELECT 1 AS priority, *
    FROM read_text('pipelines/worldcup_2026/reference/schedule.json')
    UNION ALL
    SELECT 2 AS priority, *
    FROM read_text('reference/schedule.json')
    UNION ALL
    SELECT 3 AS priority, *
    FROM read_text('../../reference/schedule.json')
    UNION ALL
    SELECT 4 AS priority, *
    FROM read_text('src/data/schedule.json')
    UNION ALL
    SELECT 5 AS priority, *
    FROM read_text('../../src/data/schedule.json')
    UNION ALL
    SELECT 6 AS priority, *
    FROM read_text('../../../src/data/schedule.json')
    UNION ALL
    SELECT 7 AS priority, *
    FROM read_text('../../../../src/data/schedule.json')
)
WHERE content IS NOT NULL
QUALIFY ROW_NUMBER() OVER (ORDER BY priority) = 1
