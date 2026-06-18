/* @bruin
name: marts.app_data_manifest
description: Manifest asset used by npm run pipeline:run to build all app-facing Bruin data.
connection: motherduck-fifa

materialization:
  type: table

depends:
  - marts.app_matches
  - marts.app_teams
  - raw.espn_scoreboard_window

columns:
  - name: generated_at
    type: timestamp
  - name: match_rows
    type: integer
  - name: team_rows
    type: integer

@bruin */

SELECT
    CURRENT_TIMESTAMP AS generated_at,
    (SELECT COUNT(*) FROM marts.app_matches) AS match_rows,
    (SELECT COUNT(*) FROM marts.app_teams) AS team_rows,
    (SELECT COUNT(*) FROM raw.espn_scoreboard_window) AS espn_window_rows
