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

SELECT
    key AS team_name,
    value AS payload
FROM raw.reference_teams_json,
    json_each(payload)
ORDER BY team_name
