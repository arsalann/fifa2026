/* @bruin
name: marts.provider_coverage
description: Row-count coverage checks across the three ingested soccer providers.

materialization:
  type: table

depends:
  - raw.espn_teams
  - raw.espn_scoreboard
  - raw.espn_competitors
  - raw.espn_standings
  - raw.espn_news
  - raw.api_football_teams
  - raw.api_football_matches
  - raw.api_football_group_standings
  - raw.balldontlie_fifa_teams
  - raw.balldontlie_fifa_matches
  - raw.balldontlie_fifa_group_standings
  - raw.football_data_org_teams
  - raw.football_data_org_matches
  - raw.football_data_org_group_standings

columns:
  - name: provider
    type: varchar
  - name: table_name
    type: varchar
  - name: row_count
    type: integer

@bruin */

SELECT 'espn' AS provider, 'teams' AS table_name, COUNT(*) AS row_count FROM raw.espn_teams
UNION ALL
SELECT 'espn', 'scoreboard', COUNT(*) FROM raw.espn_scoreboard
UNION ALL
SELECT 'espn', 'competitors', COUNT(*) FROM raw.espn_competitors
UNION ALL
SELECT 'espn', 'standings', COUNT(*) FROM raw.espn_standings
UNION ALL
SELECT 'espn', 'news', COUNT(*) FROM raw.espn_news
UNION ALL
SELECT 'api_football' AS provider, 'teams' AS table_name, COUNT(*) AS row_count FROM raw.api_football_teams
UNION ALL
SELECT 'api_football', 'matches', COUNT(*) FROM raw.api_football_matches
UNION ALL
SELECT 'api_football', 'group_standings', COUNT(*) FROM raw.api_football_group_standings
UNION ALL
SELECT 'balldontlie_fifa', 'teams', COUNT(*) FROM raw.balldontlie_fifa_teams
UNION ALL
SELECT 'balldontlie_fifa', 'matches', COUNT(*) FROM raw.balldontlie_fifa_matches
UNION ALL
SELECT 'balldontlie_fifa', 'group_standings', COUNT(*) FROM raw.balldontlie_fifa_group_standings
UNION ALL
SELECT 'football_data_org', 'teams', COUNT(*) FROM raw.football_data_org_teams
UNION ALL
SELECT 'football_data_org', 'matches', COUNT(*) FROM raw.football_data_org_matches
UNION ALL
SELECT 'football_data_org', 'group_standings', COUNT(*) FROM raw.football_data_org_group_standings
