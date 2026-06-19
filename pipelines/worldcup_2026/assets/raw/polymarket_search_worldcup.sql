/* @bruin
name: raw.polymarket_search_worldcup
description: Polymarket public search results for World Cup 2026 markets.
connection: motherduck-fifa

materialization:
  type: table
  strategy: create+replace

columns:
  - name: id
    type: varchar
  - name: slug
    type: varchar
  - name: title
    type: varchar
  - name: type
    type: varchar
  - name: raw
    type: json

@bruin */

WITH payload AS (
    SELECT content::JSON AS payload
    FROM read_text('https://gamma-api.polymarket.com/public-search?q=FIFA%20World%20Cup%202026&events_status=open&markets_status=open&limit=100')
)
SELECT
    NULL::VARCHAR AS id,
    NULL::VARCHAR AS slug,
    NULL::VARCHAR AS title,
    NULL::VARCHAR AS type,
    payload AS raw
FROM payload
