/* @bruin
name: marts.app_teams
description: Team metadata JSON rows generated from the Bruin-ingested team reference.
connection: motherduck-fifa

materialization:
  type: table

depends:
  - raw.reference_teams_json

columns:
  - name: team_name
    type: varchar
    primary_key: true
    checks:
      - name: not_null
  - name: payload
    type: json

@bruin */

WITH team_rows AS (
    SELECT
        key AS team_name,
        value AS payload
    FROM raw.reference_teams_json,
        json_each(payload)
)
SELECT team_name, payload
FROM team_rows
UNION ALL
SELECT
    error('Expected 48 rows in marts.app_teams') AS team_name,
    NULL::JSON AS payload
FROM (SELECT COUNT(*) AS team_count FROM team_rows)
WHERE team_count != 48
ORDER BY team_name
