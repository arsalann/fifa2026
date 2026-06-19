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
