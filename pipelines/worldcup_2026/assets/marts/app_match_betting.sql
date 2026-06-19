/* @bruin
name: marts.app_match_betting
description: App-ready match-level prediction market outcomes from public Kalshi match markets.
connection: motherduck-fifa

materialization:
  type: table
  strategy: create+replace

depends:
  - raw.reference_teams_json
  - raw.reference_schedule_json
  - raw.kalshi_worldcup_correct_score

columns:
  - name: match_index
    type: integer
  - name: source
    type: varchar
  - name: market_type
    type: varchar
  - name: outcome_rank
    type: integer
  - name: outcome
    type: varchar
  - name: probability
    type: double
  - name: bid
    type: double
  - name: ask
    type: double
  - name: last_price
    type: double
  - name: volume
    type: double
  - name: market_id
    type: varchar
  - name: url
    type: varchar

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
        ta1.team_name AS team1,
        ta2.team_name AS team2
    FROM event_sides es
    JOIN team_aliases ta1
        ON lower(es.source_team1) = ta1.alias
    JOIN team_aliases ta2
        ON lower(es.source_team2) = ta2.alias
),
matched_events AS (
    SELECT
        rm.match_index,
        e.event_ticker,
        e.title
    FROM events e
    JOIN reference_matches rm
        ON (rm.team1 = e.team1 AND rm.team2 = e.team2)
        OR (rm.team1 = e.team2 AND rm.team2 = e.team1)
),
outcomes AS (
    SELECT
        me.match_index,
        'Kalshi' AS source,
        'correct_score' AS market_type,
        json_extract_string(m.value, '$.yes_sub_title') AS outcome,
        COALESCE(
            (
                TRY_CAST(json_extract_string(m.value, '$.yes_bid_dollars') AS DOUBLE)
                + TRY_CAST(json_extract_string(m.value, '$.yes_ask_dollars') AS DOUBLE)
            ) / 2,
            TRY_CAST(json_extract_string(m.value, '$.last_price_dollars') AS DOUBLE)
        ) AS probability,
        TRY_CAST(json_extract_string(m.value, '$.yes_bid_dollars') AS DOUBLE) AS bid,
        TRY_CAST(json_extract_string(m.value, '$.yes_ask_dollars') AS DOUBLE) AS ask,
        TRY_CAST(json_extract_string(m.value, '$.last_price_dollars') AS DOUBLE) AS last_price,
        TRY_CAST(json_extract_string(m.value, '$.volume_fp') AS DOUBLE) AS volume,
        json_extract_string(m.value, '$.ticker') AS market_id
    FROM raw.kalshi_worldcup_correct_score e
    JOIN matched_events me
        ON e.event_ticker = me.event_ticker
    CROSS JOIN json_each(e.markets) AS m
    WHERE json_extract_string(m.value, '$.status') = 'active'
),
ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY match_index, source, market_type
            ORDER BY probability DESC NULLS LAST, volume DESC NULLS LAST
        ) AS outcome_rank
    FROM outcomes
    WHERE probability IS NOT NULL
)
SELECT
    match_index,
    source,
    market_type,
    outcome_rank,
    outcome,
    probability,
    bid,
    ask,
    last_price,
    volume,
    market_id,
    'https://kalshi.com/markets/kxwcscore/world-cup-correct-score/' || lower(regexp_extract(market_id, '^(KXWCSCORE-[^-]+)', 1)) AS url
FROM ranked
WHERE outcome_rank <= 3
ORDER BY match_index, outcome_rank
