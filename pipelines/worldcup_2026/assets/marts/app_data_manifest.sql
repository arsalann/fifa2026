/* @bruin
name: marts.app_data_manifest
description: Manifest asset used by npm run pipeline:run to build all app-facing Bruin data.
connection: motherduck-fifa

materialization:
  type: table
  strategy: create+replace

depends:
  - marts.app_matches
  - marts.app_teams
  - marts.app_team_betting
  - marts.app_match_betting
  - raw.espn_scoreboard_window
  - raw.espn_match_summary

columns:
  - name: generated_at
    type: timestamp
  - name: match_rows
    type: integer
  - name: team_rows
    type: integer
  - name: team_betting_rows
    type: integer
  - name: match_betting_rows
    type: integer
  - name: espn_summary_rows
    type: integer

@bruin */

WITH counts AS (
    SELECT
        (SELECT COUNT(*) FROM marts.app_matches) AS match_rows,
        (SELECT COUNT(*) FROM marts.app_teams) AS team_rows,
        (SELECT COUNT(*) FROM marts.app_team_betting) AS team_betting_rows,
        (SELECT COUNT(*) FROM marts.app_match_betting) AS match_betting_rows,
        (SELECT COUNT(*) FROM raw.espn_scoreboard_window) AS espn_window_rows,
        (SELECT COUNT(*) FROM raw.espn_match_summary) AS espn_summary_rows
)
SELECT
    CURRENT_TIMESTAMP AS generated_at,
    CASE
        WHEN match_rows != 104 THEN error('Expected 104 rows in marts.app_matches')
        ELSE match_rows
    END AS match_rows,
    CASE
        WHEN team_rows != 48 THEN error('Expected 48 rows in marts.app_teams')
        ELSE team_rows
    END AS team_rows,
    team_betting_rows,
    match_betting_rows,
    CASE
        WHEN espn_window_rows != 104 THEN error('Expected 104 rows in raw.espn_scoreboard_window')
        ELSE espn_window_rows
    END AS espn_window_rows,
    CASE
        WHEN espn_summary_rows != 104 THEN error('Expected 104 rows in raw.espn_match_summary')
        ELSE espn_summary_rows
    END AS espn_summary_rows
FROM counts
