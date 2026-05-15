-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — geopolitics / us_politics
-- Curated by source-catalog-curator subagent on 2026-05-15
-- All URLs verified reachable + producing valid feed content
-- ════════════════════════════════════════════════════════════════════
--
-- REJECTIONS (attempted but failed verification):
--   https://www.whitehouse.gov/feed/               — 404 Not Found (correct path is /news/feed/)
--   https://www.ftc.gov/rss/pressrelease           — 403 Forbidden (bot-blocked)
--   https://www.ftc.gov/feeds/press-release.xml    — 403 Forbidden (bot-blocked)
--   https://www.ftc.gov/newsroom/rss               — 403 Forbidden (bot-blocked)
--   https://www.justice.gov/feeds/opa/justice-news.xml — 403 Forbidden (bot-blocked)
--   https://www.justice.gov/rss/justice-news.xml   — 403 Forbidden (bot-blocked)
--   https://www.justice.gov/opa/pr/rss             — 403 Forbidden (bot-blocked)
--   https://www.epa.gov/rss/epa-news.xml           — 404 Not Found
--   https://www.fcc.gov/news-events/rss/news       — Timeout
--   https://www.fcc.gov/news-events/rss/headlines  — Timeout
--   https://www.cbo.gov/publications/feed          — 403 Forbidden (bot-blocked)
--   https://www.cbo.gov/taxonomy/term/42/feed      — 403 Forbidden (bot-blocked)
--   https://www.cbo.gov/podcasts/cbo-podcast-rss.xml — Stale (last episode Oct 2018, 3-part pilot only)
--   https://www.cbo.gov/rss.xml                    — 404 Not Found
--   https://www.congress.gov/rss/new-legislation.xml — 404 Not Found
--   https://www.congress.gov/rss/recent-activity.xml — 404 Not Found
--   https://rss.politico.com/politics-news.xml     — Claude fetch-blocked (domain restriction)
--   https://www.politico.com/rss/politics08.xml    — Claude fetch-blocked (domain restriction)
--   https://www.politico.com/feeds/main.xml        — Claude fetch-blocked (domain restriction)
--   https://www.politico.com/rss/congress.xml      — Claude fetch-blocked (domain restriction)
--   https://apnews.com/politics.rss                — Claude fetch-blocked (domain restriction)
--   https://feeds.washingtonpost.com/rss/politics  — 403 Forbidden (bot-blocked)
--   https://www.realclearpolitics.com/rss/latest_added.xml — 403 Forbidden
--   https://www.opensecrets.org/news/feed          — 403 Forbidden (bot-blocked)
--   https://www.brookings.edu/feed/                — Returns HTML, not XML feed
--   https://www.brookings.edu/topic/governance-studies/feed/ — Returns HTML, not XML feed
--   https://www.c-span.org/resources/rss/          — 403 Forbidden (bot-blocked)
--   https://www.c-span.org/resources/rss/congressional-chronicle/ — 403 Forbidden
--   https://www.govinfo.gov/rss/fdsys.xml          — 404 Not Found
--
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  (
    'White House Newsroom',
    'rss',
    'https://www.whitehouse.gov/news/feed/',
    'Official White House RSS feed publishing presidential remarks, executive orders, proclamations, and press briefings directly from the Executive Office of the President; authoritative primary source for all executive branch announcements.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'daily',
    array['us'],
    0.97,
    false,
    null,
    array['white_house', 'executive_orders', 'presidential_remarks', 'press_briefings', 'proclamations', 'us_executive_branch']
  ),

  (
    'GovInfo — Congressional Bills',
    'rss',
    'https://www.govinfo.gov/rss/bills.xml',
    'Official U.S. Government Publishing Office feed of newly introduced and amended House and Senate bills, joint resolutions, and concurrent resolutions; links directly to PDF, XML, and HTML versions of legislative text.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'daily',
    array['us'],
    0.96,
    false,
    null,
    array['congress', 'legislation', 'house_bills', 'senate_bills', 'us_law', 'legislative_activity', 'congressional_resolutions']
  ),

  (
    'GovInfo — Federal Register',
    'rss',
    'https://www.govinfo.gov/rss/fr.xml',
    'Real-time RSS feed from the National Archives and Records Administration publishing new rules, proposed rules, executive orders, and agency notices as they appear in the Federal Register; the definitive source for all federal regulatory activity.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'daily',
    array['us'],
    0.97,
    false,
    null,
    array['federal_regulations', 'regulatory_agencies', 'rulemaking', 'executive_orders', 'agency_notices', 'ftc', 'fcc', 'epa', 'doj', 'federal_policy']
  ),

  (
    'GovInfo — Congressional Record',
    'rss',
    'https://www.govinfo.gov/rss/crec.xml',
    'Official GPO feed of the Congressional Record providing full transcripts of House and Senate floor proceedings, debates, votes, and extensions of remarks; the verbatim primary source for congressional activity.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'daily',
    array['us'],
    0.96,
    false,
    null,
    array['congress', 'senate_floor', 'house_floor', 'congressional_debates', 'floor_votes', 'legislative_proceedings']
  ),

  (
    'GovInfo — Congressional Hearings',
    'rss',
    'https://www.govinfo.gov/rss/chrg.xml',
    'Official GPO feed publishing newly released transcripts of Congressional committee hearings across all House and Senate committees; covers oversight, appropriations, nominations, and policy investigations.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'daily',
    array['us'],
    0.96,
    false,
    null,
    array['congressional_hearings', 'senate_committees', 'house_committees', 'oversight', 'nominations', 'appropriations', 'congressional_testimony']
  ),

  (
    'GovInfo — Daily Compilation of Presidential Documents',
    'rss',
    'https://www.govinfo.gov/rss/dcpd.xml',
    'Office of the Federal Register feed covering the complete daily record of presidential communications including executive orders, proclamations, remarks, statements, and administrative orders; the authoritative legislative history of executive action.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'daily',
    array['us'],
    0.97,
    false,
    null,
    array['executive_orders', 'presidential_documents', 'proclamations', 'white_house', 'presidential_statements', 'us_executive_branch']
  ),

  (
    'Congress.gov — Most-Viewed Bills',
    'rss',
    'https://www.congress.gov/rss/most-viewed-bills.xml',
    'Library of Congress weekly digest of the ten most-viewed bills on Congress.gov; a signal-rich indicator of legislative activity attracting the highest public and press attention in any given week.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'weekly',
    array['us'],
    0.92,
    false,
    null,
    array['congress', 'legislation', 'house_bills', 'senate_bills', 'legislative_activity', 'trending_legislation']
  ),

  (
    'GAO — Reports and Testimony',
    'rss',
    'https://www.gao.gov/rss/reports.xml',
    'Government Accountability Office RSS feed publishing nonpartisan audit reports, testimony to Congress, and watchdog findings on federal agency performance, spending, and program effectiveness; essential for policy accountability coverage.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'weekly',
    array['us'],
    0.94,
    false,
    null,
    array['government_accountability', 'federal_spending', 'oversight', 'audit_reports', 'congress', 'nonpartisan_analysis', 'government_watchdog']
  ),

  (
    'The Hill',
    'rss',
    'https://thehill.com/feed/',
    'The Hill is a nonpartisan Washington political news outlet focused on Congress, the White House, and regulatory agencies; the primary daily read for Capitol Hill staff, lobbyists, and policy professionals.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'hourly',
    array['us'],
    0.78,
    false,
    null,
    array['congress', 'white_house', 'us_senate', 'us_house', 'regulatory_policy', 'washington_dc', 'political_news', 'legislation']
  ),

  (
    'The Hill — Senate',
    'rss',
    'https://thehill.com/homenews/senate/feed/',
    'The Hill Senate vertical covering Senate floor activity, leadership, committee actions, and confirmation proceedings; tightly focused on the upper chamber with strong sourcing among Senate staff.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'daily',
    array['us'],
    0.78,
    false,
    null,
    array['us_senate', 'senate_leadership', 'senate_committees', 'nominations', 'confirmation_hearings', 'senate_votes', 'cloture']
  ),

  (
    'The Hill — House',
    'rss',
    'https://thehill.com/homenews/house/feed/',
    'The Hill House vertical covering House floor activity, Speaker proceedings, committee work, and the budget and appropriations process; reliable sourcing from House majority and minority leadership offices.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'daily',
    array['us'],
    0.78,
    false,
    null,
    array['us_house', 'house_leadership', 'house_committees', 'appropriations', 'house_votes', 'budget_process', 'speaker']
  ),

  (
    'Roll Call',
    'rss',
    'https://rollcall.com/feed/',
    'Roll Call has covered Capitol Hill since 1955 and remains the authoritative trade publication for congressional insiders; strong on redistricting, campaign finance, election forecasting, and procedural detail that national outlets miss.',
    array['geopolitics'],
    array['us_politics'],
    'freemium',
    null,
    'daily',
    array['us'],
    0.82,
    false,
    null,
    array['congress', 'elections', 'redistricting', 'campaign_finance', 'congressional_campaigns', 'house_races', 'senate_races', 'capitol_hill']
  ),

  (
    'NPR Politics',
    'rss',
    'https://feeds.npr.org/1014/rss.xml',
    'NPR Politics section covering the White House, Congress, elections, and Supreme Court with editorial independence and strong primary-source reporting; publicly funded journalism with no partisan alignment.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'daily',
    array['us'],
    0.83,
    false,
    null,
    array['white_house', 'congress', 'us_elections', 'supreme_court', 'federal_policy', 'political_news', 'campaign_2026']
  ),

  (
    'PBS NewsHour — Politics',
    'rss',
    'https://www.pbs.org/newshour/feeds/rss/politics',
    'PBS NewsHour politics feed from the publicly funded broadcaster known for long-form, nonpartisan political reporting and analysis; strong on domestic policy, confirmation hearings, and election integrity.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'daily',
    array['us'],
    0.84,
    false,
    null,
    array['white_house', 'congress', 'us_elections', 'federal_policy', 'domestic_policy', 'political_analysis', 'nonpartisan_news']
  ),

  (
    'FactCheck.org',
    'rss',
    'https://www.factcheck.org/feed/',
    'Nonpartisan fact-checking project of the Annenberg Public Policy Center at the University of Pennsylvania; verifies claims made by political figures, ads, and viral social content with sourced primary documentation.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'weekly',
    array['us'],
    0.88,
    false,
    null,
    array['fact_checking', 'political_misinformation', 'election_integrity', 'political_ads', 'congressional_claims', 'presidential_statements', 'nonpartisan_analysis']
  ),

  (
    'Government Executive',
    'rss',
    'https://www.govexec.com/rss/all/',
    'Government Executive covers the federal workforce, agency management, technology procurement, and homeland security from an insider perspective; essential for tracking how executive branch policy is implemented operationally.',
    array['geopolitics'],
    array['us_politics'],
    'free',
    null,
    'daily',
    array['us'],
    0.72,
    false,
    null,
    array['federal_agencies', 'government_management', 'executive_branch', 'federal_workforce', 'doge', 'agency_operations', 'homeland_security', 'government_procurement']
  )

on conflict (type, url) do update set
  name = excluded.name,
  description = excluded.description,
  categories = excluded.categories,
  subcategories = excluded.subcategories,
  paywall_tier = excluded.paywall_tier,
  paywall_cost_usd_monthly = excluded.paywall_cost_usd_monthly,
  update_cadence = excluded.update_cadence,
  geography = excluded.geography,
  quality_score = excluded.quality_score,
  requires_oauth = excluded.requires_oauth,
  oauth_provider = excluded.oauth_provider,
  recommended_for_topics = excluded.recommended_for_topics,
  updated_at = now();
