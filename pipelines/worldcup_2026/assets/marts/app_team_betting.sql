/* @bruin
name: marts.app_team_betting
description: App-ready team-level prediction market probabilities from public Kalshi and Polymarket sources.
connection: motherduck-fifa

materialization:
  type: table
  strategy: create+replace

depends:
  - raw.reference_teams_json
  - raw.kalshi_worldcup_events
  - raw.polymarket_search_worldcup

columns:
  - name: team_name
    type: varchar
  - name: source
    type: varchar
  - name: market_type
    type: varchar
  - name: label
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
  - name: question
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
polymarket_raw AS (
    SELECT raw::JSON AS payload
    FROM raw.polymarket_search_worldcup
),
polymarket_markets AS (
    SELECT
        'Polymarket' AS source,
        CASE
            WHEN lower(json_extract_string(m.value, '$.question')) LIKE '% win group %' THEN 'group_winner'
            WHEN lower(json_extract_string(m.value, '$.question')) LIKE '% advance to the knockout%' THEN 'advance'
            WHEN lower(json_extract_string(m.value, '$.question')) LIKE '% win the 2026 fifa world cup%' THEN 'winner'
            ELSE NULL
        END AS market_type,
        json_extract_string(m.value, '$.groupItemTitle') AS source_team,
        json_extract_string(m.value, '$.question') AS question,
        json_extract_string(m.value, '$.slug') AS slug,
        json_extract_string(m.value, '$.id') AS market_id,
        TRY_CAST(json_extract_string(m.value, '$.bestBid') AS DOUBLE) AS bid,
        TRY_CAST(json_extract_string(m.value, '$.bestAsk') AS DOUBLE) AS ask,
        TRY_CAST(json_extract_string(m.value, '$.lastTradePrice') AS DOUBLE) AS last_price,
        TRY_CAST(json_extract_string(m.value, '$.volumeNum') AS DOUBLE) AS volume,
        json_extract_string(m.value, '$.updatedAt') AS updated_at
    FROM polymarket_raw,
        json_each(payload, '$.events') AS e,
        json_each(e.value, '$.markets') AS m
    WHERE COALESCE(TRY_CAST(json_extract_string(m.value, '$.active') AS BOOLEAN), true)
        AND NOT COALESCE(TRY_CAST(json_extract_string(m.value, '$.closed') AS BOOLEAN), false)
),
polymarket AS (
    SELECT
        ta.team_name,
        p.source,
        p.market_type,
        CASE p.market_type
            WHEN 'winner' THEN 'World Cup winner'
            WHEN 'group_winner' THEN regexp_extract(p.question, 'win (Group [A-L])', 1)
            WHEN 'advance' THEN 'Reach knockouts'
        END AS label,
        COALESCE((p.bid + p.ask) / 2, p.last_price) AS probability,
        p.bid,
        p.ask,
        p.last_price,
        p.volume,
        p.market_id,
        p.question,
        CASE WHEN p.slug IS NOT NULL THEN 'https://polymarket.com/market/' || p.slug END AS url,
        p.updated_at
    FROM polymarket_markets p
    JOIN team_aliases ta
        ON lower(trim(p.source_team)) = ta.alias
    WHERE p.market_type IS NOT NULL
),
kalshi_markets AS (
    SELECT
        'Kalshi' AS source,
        'winner' AS market_type,
        regexp_replace(json_extract_string(m.value, '$.yes_sub_title'), '^the ', '') AS source_team,
        json_extract_string(m.value, '$.title') AS question,
        json_extract_string(m.value, '$.ticker') AS market_id,
        TRY_CAST(json_extract_string(m.value, '$.yes_bid_dollars') AS DOUBLE) AS bid,
        TRY_CAST(json_extract_string(m.value, '$.yes_ask_dollars') AS DOUBLE) AS ask,
        TRY_CAST(json_extract_string(m.value, '$.last_price_dollars') AS DOUBLE) AS last_price,
        TRY_CAST(json_extract_string(m.value, '$.volume_fp') AS DOUBLE) AS volume,
        json_extract_string(m.value, '$.updated_time') AS updated_at
    FROM raw.kalshi_worldcup_events,
        json_each(markets) AS m
    WHERE json_extract_string(m.value, '$.status') = 'active'
),
kalshi AS (
    SELECT
        ta.team_name,
        k.source,
        k.market_type,
        'World Cup winner' AS label,
        COALESCE((k.bid + k.ask) / 2, k.last_price) AS probability,
        k.bid,
        k.ask,
        k.last_price,
        k.volume,
        k.market_id,
        k.question,
        'https://kalshi.com/markets/kxmenworldcup/mens-world-cup-winner/kxmenworldcup-26' AS url,
        k.updated_at
    FROM kalshi_markets k
    JOIN team_aliases ta
        ON lower(trim(k.source_team)) = ta.alias
),
combined AS (
    SELECT * FROM polymarket
    UNION ALL
    SELECT * FROM kalshi
),
ranked AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY team_name, source, market_type
            ORDER BY volume DESC NULLS LAST, updated_at DESC NULLS LAST
        ) AS source_rank
    FROM combined
    WHERE probability IS NOT NULL
)
SELECT
    team_name,
    source,
    market_type,
    label,
    probability,
    bid,
    ask,
    last_price,
    volume,
    market_id,
    question,
    url
FROM ranked
WHERE source_rank = 1
ORDER BY team_name, market_type, source
