/* @bruin
name: marts.app_match_market_summary
description: App-ready match-level market summaries derived from Kalshi correct-score markets.
connection: motherduck-fifa

materialization:
  type: table
  strategy: create+replace

depends:
  - raw.reference_teams_json
  - uri: motherduck://fifa/raw/reference_schedule_json
  - raw.kalshi_worldcup_correct_score

columns:
  - name: match_index
    type: integer
  - name: source
    type: varchar
  - name: team1_win_probability
    type: double
  - name: draw_probability
    type: double
  - name: team2_win_probability
    type: double
  - name: expected_team1_goals
    type: double
  - name: expected_team2_goals
    type: double
  - name: over_2_5_probability
    type: double
  - name: both_teams_score_probability
    type: double
  - name: team1_clean_sheet_probability
    type: double
  - name: team2_clean_sheet_probability
    type: double
  - name: top_outcome
    type: varchar
  - name: top_probability
    type: double
  - name: market_total_probability
    type: double
  - name: outcomes_count
    type: integer

@bruin */

WITH team_rows AS (
    SELECT key AS team_name
    FROM raw.reference_teams_json,
        json_each(payload)
    WHERE filename = 'teams.json'
),
team_aliases AS (
    SELECT team_name, lower(team_name) AS alias
    FROM team_rows
    UNION ALL SELECT * FROM (VALUES
        ('Bosnia & Herzegovina', 'bosnia and herzegovina'),
        ('Curaçao', 'curacao'),
        ('Czech Republic', 'czechia'),
        ('DR Congo', 'congo dr'),
        ('DR Congo', 'congo democratic republic'),
        ('Ivory Coast', 'cote d''ivoire'),
        ('South Korea', 'korea republic'),
        ('Turkey', 'turkiye'),
        ('USA', 'united states')
    ) AS v(team_name, alias)
),
reference_matches AS (
    SELECT
        CAST(json_extract_string(value, '$.index') AS INTEGER) AS match_index,
        json_extract_string(value, '$.team1') AS team1,
        json_extract_string(value, '$.team2') AS team2
    FROM raw.reference_schedule_json,
        json_each(payload, '$.matches')
    WHERE filename = 'schedule.json'
),
event_sides AS (
    SELECT
        event_ticker,
        title,
        trim(split_part(split_part(title, ':', 1), ' vs ', 1)) AS source_team1,
        trim(split_part(split_part(title, ':', 1), ' vs ', 2)) AS source_team2
    FROM raw.kalshi_worldcup_correct_score
),
events AS (
    SELECT
        es.event_ticker,
        es.title,
        es.source_team1,
        es.source_team2,
        ta1.team_name AS event_team1,
        ta2.team_name AS event_team2
    FROM event_sides es
    JOIN team_aliases ta1
        ON lower(es.source_team1) = ta1.alias
    JOIN team_aliases ta2
        ON lower(es.source_team2) = ta2.alias
),
matched_events AS (
    SELECT
        rm.match_index,
        rm.team1,
        rm.team2,
        e.event_ticker,
        e.event_team1,
        e.event_team2,
        e.source_team1,
        e.source_team2
    FROM events e
    JOIN reference_matches rm
        ON (rm.team1 = e.event_team1 AND rm.team2 = e.event_team2)
        OR (rm.team1 = e.event_team2 AND rm.team2 = e.event_team1)
),
outcomes AS (
    SELECT
        me.match_index,
        me.team1,
        me.team2,
        me.event_team1,
        me.event_team2,
        me.source_team1,
        me.source_team2,
        json_extract_string(m.value, '$.yes_sub_title') AS outcome,
        COALESCE(
            (
                TRY_CAST(json_extract_string(m.value, '$.yes_bid_dollars') AS DOUBLE)
                + TRY_CAST(json_extract_string(m.value, '$.yes_ask_dollars') AS DOUBLE)
            ) / 2,
            TRY_CAST(json_extract_string(m.value, '$.last_price_dollars') AS DOUBLE)
        ) AS probability,
        TRY_CAST(regexp_extract(json_extract_string(m.value, '$.yes_sub_title'), '([0-9]+)-([0-9]+)', 1) AS INTEGER) AS shown_goals1,
        TRY_CAST(regexp_extract(json_extract_string(m.value, '$.yes_sub_title'), '([0-9]+)-([0-9]+)', 2) AS INTEGER) AS shown_goals2,
        CASE
            WHEN json_extract_string(m.value, '$.yes_sub_title') LIKE 'Draw %' THEN 'draw'
            WHEN lower(json_extract_string(m.value, '$.yes_sub_title')) LIKE lower(me.source_team1) || ' wins %' THEN 'event_team1'
            WHEN lower(json_extract_string(m.value, '$.yes_sub_title')) LIKE lower(me.source_team2) || ' wins %' THEN 'event_team2'
            WHEN lower(json_extract_string(m.value, '$.yes_sub_title')) LIKE lower(me.event_team1) || ' wins %' THEN 'event_team1'
            WHEN lower(json_extract_string(m.value, '$.yes_sub_title')) LIKE lower(me.event_team2) || ' wins %' THEN 'event_team2'
            ELSE NULL
        END AS winner_side
    FROM raw.kalshi_worldcup_correct_score e
    JOIN matched_events me
        ON e.event_ticker = me.event_ticker
    CROSS JOIN json_each(e.markets) AS m
    WHERE json_extract_string(m.value, '$.status') = 'active'
),
scored AS (
    SELECT
        *,
        CASE
            WHEN winner_side = 'draw' THEN 'draw'
            WHEN winner_side = 'event_team1' THEN event_team1
            WHEN winner_side = 'event_team2' THEN event_team2
        END AS winner_team,
        CASE
            WHEN team1 = event_team1 THEN
                CASE
                    WHEN winner_side = 'draw' THEN shown_goals1
                    WHEN winner_side = 'event_team1' THEN shown_goals1
                    WHEN winner_side = 'event_team2' THEN shown_goals2
                END
            ELSE
                CASE
                    WHEN winner_side = 'draw' THEN shown_goals2
                    WHEN winner_side = 'event_team1' THEN shown_goals2
                    WHEN winner_side = 'event_team2' THEN shown_goals1
                END
        END AS team1_goals,
        CASE
            WHEN team2 = event_team2 THEN
                CASE
                    WHEN winner_side = 'draw' THEN shown_goals2
                    WHEN winner_side = 'event_team1' THEN shown_goals2
                    WHEN winner_side = 'event_team2' THEN shown_goals1
                END
            ELSE
                CASE
                    WHEN winner_side = 'draw' THEN shown_goals1
                    WHEN winner_side = 'event_team1' THEN shown_goals1
                    WHEN winner_side = 'event_team2' THEN shown_goals2
                END
        END AS team2_goals,
        ROW_NUMBER() OVER (
            PARTITION BY match_index
            ORDER BY probability DESC NULLS LAST
        ) AS outcome_rank
    FROM outcomes
    WHERE probability IS NOT NULL
        AND shown_goals1 IS NOT NULL
        AND shown_goals2 IS NOT NULL
        AND winner_side IS NOT NULL
),
totals AS (
    SELECT
        match_index,
        SUM(probability) AS total_probability,
        COUNT(*) AS outcomes_count
    FROM scored
    GROUP BY match_index
),
top_outcomes AS (
    SELECT match_index, outcome AS top_outcome, probability AS top_probability
    FROM scored
    WHERE outcome_rank = 1
)
SELECT
    s.match_index,
    'Kalshi' AS source,
    SUM(CASE WHEN s.winner_team = s.team1 THEN s.probability ELSE 0 END) / t.total_probability AS team1_win_probability,
    SUM(CASE WHEN s.winner_team = 'draw' THEN s.probability ELSE 0 END) / t.total_probability AS draw_probability,
    SUM(CASE WHEN s.winner_team = s.team2 THEN s.probability ELSE 0 END) / t.total_probability AS team2_win_probability,
    SUM(s.probability * s.team1_goals) / t.total_probability AS expected_team1_goals,
    SUM(s.probability * s.team2_goals) / t.total_probability AS expected_team2_goals,
    SUM(CASE WHEN s.team1_goals + s.team2_goals > 2.5 THEN s.probability ELSE 0 END) / t.total_probability AS over_2_5_probability,
    SUM(CASE WHEN s.team1_goals > 0 AND s.team2_goals > 0 THEN s.probability ELSE 0 END) / t.total_probability AS both_teams_score_probability,
    SUM(CASE WHEN s.team2_goals = 0 THEN s.probability ELSE 0 END) / t.total_probability AS team1_clean_sheet_probability,
    SUM(CASE WHEN s.team1_goals = 0 THEN s.probability ELSE 0 END) / t.total_probability AS team2_clean_sheet_probability,
    top_outcomes.top_outcome,
    top_outcomes.top_probability,
    t.total_probability AS market_total_probability,
    t.outcomes_count
FROM scored s
JOIN totals t
    ON s.match_index = t.match_index
JOIN top_outcomes
    ON s.match_index = top_outcomes.match_index
GROUP BY
    s.match_index,
    t.total_probability,
    t.outcomes_count,
    top_outcomes.top_outcome,
    top_outcomes.top_probability
ORDER BY s.match_index
