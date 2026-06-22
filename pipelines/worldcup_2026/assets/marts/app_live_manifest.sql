/* @bruin
name: marts.app_live_manifest
description: Manifest asset used by the live app-data pipeline.
connection: motherduck-fifa
uri: motherduck://fifa/marts/app_live_manifest

materialization:
  type: table
  strategy: create+replace

depends:
  - marts.app_matches
  - raw.espn_scoreboard_window

columns:
  - name: generated_at
    type: timestamp
  - name: match_rows
    type: integer
  - name: espn_window_rows
    type: integer

@bruin */

WITH counts AS (
    SELECT
        (SELECT COUNT(*) FROM marts.app_matches) AS match_rows,
        (SELECT COUNT(*) FROM raw.espn_scoreboard_window) AS espn_window_rows
)
SELECT
    CURRENT_TIMESTAMP AS generated_at,
    CASE
        WHEN match_rows != 104 THEN error('Expected 104 rows in marts.app_matches')
        ELSE match_rows
    END AS match_rows,
    CASE
        WHEN espn_window_rows != 104 THEN error('Expected 104 rows in raw.espn_scoreboard_window')
        ELSE espn_window_rows
    END AS espn_window_rows
FROM counts
