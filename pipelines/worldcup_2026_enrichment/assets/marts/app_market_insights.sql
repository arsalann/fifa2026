/* @bruin
name: marts.app_market_insights
description: App-ready tournament betting insights from public Polymarket markets.
connection: motherduck-fifa

materialization:
  type: table
  strategy: create+replace

depends:
  - raw.polymarket_search_worldcup

columns:
  - name: category
    type: varchar
  - name: source
    type: varchar
  - name: rank
    type: integer
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

WITH raw AS (
    SELECT raw::JSON AS payload
    FROM raw.polymarket_search_worldcup
),
markets AS (
    SELECT
        CASE
            WHEN lower(json_extract_string(e.value, '$.slug')) = 'world-cup-golden-boot-winner' THEN 'golden_boot'
            WHEN lower(json_extract_string(e.value, '$.slug')) = 'which-continent-will-win-the-world-cup' THEN 'continent_winner'
            ELSE NULL
        END AS category,
        'Polymarket' AS source,
        json_extract_string(m.value, '$.groupItemTitle') AS label,
        TRY_CAST(json_extract_string(m.value, '$.bestBid') AS DOUBLE) AS bid,
        TRY_CAST(json_extract_string(m.value, '$.bestAsk') AS DOUBLE) AS ask,
        TRY_CAST(json_extract_string(m.value, '$.lastTradePrice') AS DOUBLE) AS last_price,
        TRY_CAST(json_extract_string(m.value, '$.volumeNum') AS DOUBLE) AS volume,
        json_extract_string(m.value, '$.id') AS market_id,
        json_extract_string(m.value, '$.question') AS question,
        json_extract_string(m.value, '$.slug') AS slug
    FROM raw,
        json_each(payload, '$.events') AS e,
        json_each(e.value, '$.markets') AS m
    WHERE COALESCE(TRY_CAST(json_extract_string(m.value, '$.active') AS BOOLEAN), true)
        AND NOT COALESCE(TRY_CAST(json_extract_string(m.value, '$.closed') AS BOOLEAN), false)
),
ranked AS (
    SELECT
        *,
        COALESCE((bid + ask) / 2, last_price) AS probability,
        ROW_NUMBER() OVER (
            PARTITION BY category
            ORDER BY COALESCE((bid + ask) / 2, last_price) DESC NULLS LAST, volume DESC NULLS LAST
        ) AS rank
    FROM markets
    WHERE category IS NOT NULL
        AND label IS NOT NULL
        AND lower(label) != 'other'
)
SELECT
    category,
    source,
    rank,
    label,
    probability,
    bid,
    ask,
    last_price,
    volume,
    market_id,
    question,
    CASE WHEN slug IS NOT NULL THEN 'https://polymarket.com/market/' || slug END AS url
FROM ranked
WHERE probability IS NOT NULL
    AND rank <= CASE WHEN category = 'golden_boot' THEN 12 ELSE 8 END
ORDER BY category, rank
