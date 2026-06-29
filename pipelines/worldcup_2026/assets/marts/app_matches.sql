/* @bruin
name: marts.app_matches
description: |
  App-ready World Cup match rows. Bruin ingests the curated reference schedule
  and overlays ESPN-ingested scoreboard IDs, status, and scores where ESPN has
  a matching event.
connection: motherduck-fifa
uri: motherduck://fifa/marts/app_matches

materialization:
  type: table
  strategy: truncate+insert

depends:
  - raw.reference_schedule_json
  - raw.espn_scoreboard_window

columns:
  - name: match_index
    type: integer
    primary_key: true
    checks:
      - name: not_null
  - name: match_key
    type: varchar
    update_on_merge: true
  - name: stage
    type: varchar
    update_on_merge: true
  - name: round
    type: varchar
    update_on_merge: true
  - name: group_name
    type: varchar
    update_on_merge: true
  - name: espn_id
    type: varchar
    update_on_merge: true
  - name: team1
    type: varchar
    update_on_merge: true
  - name: team2
    type: varchar
    update_on_merge: true
  - name: team1_espn_name
    type: varchar
    update_on_merge: true
  - name: team2_espn_name
    type: varchar
    update_on_merge: true
  - name: kickoff
    type: varchar
    update_on_merge: true
  - name: city
    type: varchar
    update_on_merge: true
  - name: reference_score
    type: json
    update_on_merge: true
  - name: reference_goals1
    type: json
    update_on_merge: true
  - name: reference_goals2
    type: json
    update_on_merge: true
  - name: espn_kickoff
    type: varchar
    update_on_merge: true
  - name: status_state
    type: varchar
    update_on_merge: true
  - name: status_name
    type: varchar
    update_on_merge: true
  - name: status_period
    type: integer
    update_on_merge: true
  - name: display_clock
    type: varchar
    update_on_merge: true
  - name: venue_name
    type: varchar
    update_on_merge: true
  - name: home_team
    type: varchar
    update_on_merge: true
  - name: away_team
    type: varchar
    update_on_merge: true
  - name: home_score
    type: integer
    update_on_merge: true
  - name: away_score
    type: integer
    update_on_merge: true
  - name: home_linescores
    type: json
    update_on_merge: true
  - name: away_linescores
    type: json
    update_on_merge: true
  - name: competitions
    type: json
    update_on_merge: true
  - name: team1_score
    type: integer
    update_on_merge: true
  - name: team2_score
    type: integer
    update_on_merge: true
  - name: team1_ht_score
    type: integer
    update_on_merge: true
  - name: team2_ht_score
    type: integer
    update_on_merge: true

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
            WHEN 'Bosnia & Herzegovina' THEN 'Bosnia-Herzegovina'
            WHEN 'Czech Republic' THEN 'Czechia'
            WHEN 'DR Congo' THEN 'Congo DR'
            WHEN 'USA' THEN 'United States'
            WHEN 'Turkey' THEN 'Türkiye'
            ELSE json_extract_string(value, '$.team1')
        END AS team1_espn_name,
        CASE json_extract_string(value, '$.team2')
            WHEN 'Bosnia & Herzegovina' THEN 'Bosnia-Herzegovina'
            WHEN 'Czech Republic' THEN 'Czechia'
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
    WHERE filename = 'schedule.json'
),
espn_events AS (
    SELECT
        id AS espn_id,
        name AS espn_name,
        date AS espn_kickoff,
        COALESCE(
            TRY_STRPTIME(date, '%Y-%m-%dT%H:%M:%SZ'),
            TRY_STRPTIME(date, '%Y-%m-%dT%H:%MZ')
        ) AS espn_kickoff_ts,
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
    FROM raw.espn_scoreboard_window
    QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY date DESC) = 1
),
espn_oriented AS (
    SELECT
        *,
        CASE WHEN c0_home_away = 'home' THEN c0_team ELSE c1_team END AS home_team,
        CASE WHEN c0_home_away = 'home' THEN c1_team ELSE c0_team END AS away_team,
        CASE CASE WHEN c0_home_away = 'home' THEN c0_team ELSE c1_team END
            WHEN 'Bosnia-Herzegovina' THEN 'Bosnia & Herzegovina'
            WHEN 'Congo DR' THEN 'DR Congo'
            WHEN 'Czechia' THEN 'Czech Republic'
            WHEN 'United States' THEN 'USA'
            WHEN 'Türkiye' THEN 'Turkey'
            ELSE CASE WHEN c0_home_away = 'home' THEN c0_team ELSE c1_team END
        END AS home_app_team,
        CASE CASE WHEN c0_home_away = 'home' THEN c1_team ELSE c0_team END
            WHEN 'Bosnia-Herzegovina' THEN 'Bosnia & Herzegovina'
            WHEN 'Congo DR' THEN 'DR Congo'
            WHEN 'Czechia' THEN 'Czech Republic'
            WHEN 'United States' THEN 'USA'
            WHEN 'Türkiye' THEN 'Turkey'
            ELSE CASE WHEN c0_home_away = 'home' THEN c1_team ELSE c0_team END
        END AS away_app_team,
        CASE WHEN c0_home_away = 'home' THEN c0_score ELSE c1_score END AS home_score,
        CASE WHEN c0_home_away = 'home' THEN c1_score ELSE c0_score END AS away_score,
        CASE WHEN c0_home_away = 'home' THEN c0_linescores ELSE c1_linescores END AS home_linescores,
        CASE WHEN c0_home_away = 'home' THEN c1_linescores ELSE c0_linescores END AS away_linescores
    FROM espn_events
),
matched AS (
    SELECT
        r.match_index,
        r.match_key,
        r.stage,
        r.round,
        r.group_name,
        CASE
            WHEN r.stage != 'group' AND e.espn_id IS NOT NULL THEN e.home_app_team
            ELSE r.team1
        END AS team1,
        CASE
            WHEN r.stage != 'group' AND e.espn_id IS NOT NULL THEN e.away_app_team
            ELSE r.team2
        END AS team2,
        CASE
            WHEN r.stage != 'group' AND e.espn_id IS NOT NULL THEN e.home_team
            ELSE r.team1_espn_name
        END AS team1_espn_name,
        CASE
            WHEN r.stage != 'group' AND e.espn_id IS NOT NULL THEN e.away_team
            ELSE r.team2_espn_name
        END AS team2_espn_name,
        r.kickoff,
        r.city,
        r.reference_score,
        r.reference_goals1,
        r.reference_goals2,
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
            WHEN r.stage != 'group' AND e.espn_id IS NOT NULL THEN e.home_score
            WHEN r.team1_espn_name = e.home_team THEN e.home_score
            WHEN r.team1_espn_name = e.away_team THEN e.away_score
            ELSE NULL
        END AS team1_score,
        CASE
            WHEN r.stage != 'group' AND e.espn_id IS NOT NULL THEN e.away_score
            WHEN r.team2_espn_name = e.home_team THEN e.home_score
            WHEN r.team2_espn_name = e.away_team THEN e.away_score
            ELSE NULL
        END AS team2_score,
        CASE
            WHEN r.stage != 'group' AND e.espn_id IS NOT NULL THEN CAST(json_extract_string(e.home_linescores, '$[0].value') AS INTEGER)
            WHEN r.team1_espn_name = e.home_team THEN CAST(json_extract_string(e.home_linescores, '$[0].value') AS INTEGER)
            WHEN r.team1_espn_name = e.away_team THEN CAST(json_extract_string(e.away_linescores, '$[0].value') AS INTEGER)
            ELSE NULL
        END AS team1_ht_score,
        CASE
            WHEN r.stage != 'group' AND e.espn_id IS NOT NULL THEN CAST(json_extract_string(e.away_linescores, '$[0].value') AS INTEGER)
            WHEN r.team2_espn_name = e.home_team THEN CAST(json_extract_string(e.home_linescores, '$[0].value') AS INTEGER)
            WHEN r.team2_espn_name = e.away_team THEN CAST(json_extract_string(e.away_linescores, '$[0].value') AS INTEGER)
            ELSE NULL
        END AS team2_ht_score
    FROM reference_matches r
    LEFT JOIN espn_oriented e
        ON LOWER(e.espn_name) = LOWER(r.team2_espn_name || ' at ' || r.team1_espn_name)
        OR (
            r.stage != 'group'
            AND ABS(EPOCH(CAST(r.kickoff AS TIMESTAMPTZ)) - EPOCH(e.espn_kickoff_ts)) <= 3600
        )
)
SELECT *
FROM matched
UNION ALL
SELECT
    error('Expected 104 rows in marts.app_matches') AS match_index,
    NULL AS match_key,
    NULL AS stage,
    NULL AS round,
    NULL AS group_name,
    NULL AS team1,
    NULL AS team2,
    NULL AS team1_espn_name,
    NULL AS team2_espn_name,
    NULL AS kickoff,
    NULL AS city,
    NULL::JSON AS reference_score,
    NULL::JSON AS reference_goals1,
    NULL::JSON AS reference_goals2,
    NULL AS espn_id,
    NULL AS espn_kickoff,
    NULL AS status_state,
    NULL AS status_name,
    NULL AS status_period,
    NULL AS display_clock,
    NULL AS venue_name,
    NULL AS home_team,
    NULL AS away_team,
    NULL AS home_score,
    NULL AS away_score,
    NULL::JSON AS home_linescores,
    NULL::JSON AS away_linescores,
    NULL::JSON AS competitions,
    NULL AS team1_score,
    NULL AS team2_score,
    NULL AS team1_ht_score,
    NULL AS team2_ht_score
FROM (SELECT COUNT(*) AS match_count FROM matched)
WHERE match_count != 104
ORDER BY match_index
