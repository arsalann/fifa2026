/* @bruin
name: marts.app_matches
description: |
  App-ready World Cup match rows. Bruin ingests the curated reference schedule
  and overlays ESPN-ingested scoreboard IDs, status, and scores where ESPN has
  a matching event.

materialization:
  type: table

depends:
  - raw.reference_schedule_json
  - raw.espn_scoreboard

columns:
  - name: match_index
    type: integer
    primary_key: true
    checks:
      - name: not_null
  - name: match_key
    type: varchar
  - name: espn_id
    type: varchar
  - name: team1
    type: varchar
  - name: team2
    type: varchar
  - name: kickoff
    type: varchar

@bruin */

WITH reference_matches AS (
    SELECT
        CAST(json_extract_string(value, '$.index') AS INTEGER) AS match_index,
        json_extract_string(value, '$.key') AS match_key,
        json_extract_string(value, '$.stage') AS stage,
        json_extract_string(value, '$.round') AS round,
        json_extract_string(value, '$.group') AS group_name,
        json_extract_string(value, '$.team1') AS team1,
        json_extract_string(value, '$.team2') AS team2,
        CASE json_extract_string(value, '$.team1')
            WHEN 'DR Congo' THEN 'Congo DR'
            WHEN 'USA' THEN 'United States'
            WHEN 'Turkey' THEN 'Türkiye'
            ELSE json_extract_string(value, '$.team1')
        END AS team1_espn_name,
        CASE json_extract_string(value, '$.team2')
            WHEN 'DR Congo' THEN 'Congo DR'
            WHEN 'USA' THEN 'United States'
            WHEN 'Turkey' THEN 'Türkiye'
            ELSE json_extract_string(value, '$.team2')
        END AS team2_espn_name,
        json_extract_string(value, '$.kickoff') AS kickoff,
        json_extract_string(value, '$.city') AS city,
        json_extract(value, '$.score') AS reference_score,
        json_extract(value, '$.goals1') AS reference_goals1,
        json_extract(value, '$.goals2') AS reference_goals2
    FROM raw.reference_schedule_json,
        json_each(payload, '$.matches')
),
espn_events AS (
    SELECT
        id AS espn_id,
        name AS espn_name,
        date AS espn_kickoff,
        json_extract_string(status, '$.type.state') AS status_state,
        json_extract_string(status, '$.type.name') AS status_name,
        CAST(json_extract_string(status, '$.period') AS INTEGER) AS status_period,
        json_extract_string(status, '$.displayClock') AS display_clock,
        json_extract_string(venue, '$.displayName') AS venue_name,
        json_extract_string(competitions, '$[0].competitors[0].homeAway') AS c0_home_away,
        json_extract_string(competitions, '$[0].competitors[0].team.displayName') AS c0_team,
        CAST(json_extract_string(competitions, '$[0].competitors[0].score') AS INTEGER) AS c0_score,
        json_extract(competitions, '$[0].competitors[0].linescores') AS c0_linescores,
        json_extract_string(competitions, '$[0].competitors[1].homeAway') AS c1_home_away,
        json_extract_string(competitions, '$[0].competitors[1].team.displayName') AS c1_team,
        CAST(json_extract_string(competitions, '$[0].competitors[1].score') AS INTEGER) AS c1_score,
        json_extract(competitions, '$[0].competitors[1].linescores') AS c1_linescores,
        competitions
    FROM raw.espn_scoreboard
),
espn_oriented AS (
    SELECT
        *,
        CASE WHEN c0_home_away = 'home' THEN c0_team ELSE c1_team END AS home_team,
        CASE WHEN c0_home_away = 'home' THEN c1_team ELSE c0_team END AS away_team,
        CASE WHEN c0_home_away = 'home' THEN c0_score ELSE c1_score END AS home_score,
        CASE WHEN c0_home_away = 'home' THEN c1_score ELSE c0_score END AS away_score,
        CASE WHEN c0_home_away = 'home' THEN c0_linescores ELSE c1_linescores END AS home_linescores,
        CASE WHEN c0_home_away = 'home' THEN c1_linescores ELSE c0_linescores END AS away_linescores
    FROM espn_events
),
matched AS (
    SELECT
        r.*,
        e.espn_id,
        e.espn_kickoff,
        e.status_state,
        e.status_name,
        e.status_period,
        e.display_clock,
        e.venue_name,
        e.home_team,
        e.away_team,
        e.home_score,
        e.away_score,
        e.home_linescores,
        e.away_linescores,
        e.competitions,
        CASE
            WHEN r.team1_espn_name = e.home_team THEN e.home_score
            WHEN r.team1_espn_name = e.away_team THEN e.away_score
            ELSE NULL
        END AS team1_score,
        CASE
            WHEN r.team2_espn_name = e.home_team THEN e.home_score
            WHEN r.team2_espn_name = e.away_team THEN e.away_score
            ELSE NULL
        END AS team2_score,
        CASE
            WHEN r.team1_espn_name = e.home_team THEN CAST(json_extract_string(e.home_linescores, '$[0].value') AS INTEGER)
            WHEN r.team1_espn_name = e.away_team THEN CAST(json_extract_string(e.away_linescores, '$[0].value') AS INTEGER)
            ELSE NULL
        END AS team1_ht_score,
        CASE
            WHEN r.team2_espn_name = e.home_team THEN CAST(json_extract_string(e.home_linescores, '$[0].value') AS INTEGER)
            WHEN r.team2_espn_name = e.away_team THEN CAST(json_extract_string(e.away_linescores, '$[0].value') AS INTEGER)
            ELSE NULL
        END AS team2_ht_score
    FROM reference_matches r
    LEFT JOIN espn_oriented e
        ON LOWER(e.espn_name) = LOWER(r.team2_espn_name || ' at ' || r.team1_espn_name)
)
SELECT *
FROM matched
ORDER BY match_index
