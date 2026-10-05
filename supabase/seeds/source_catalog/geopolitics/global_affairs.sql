-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — geopolitics / global_affairs
-- Curated by source-catalog-curator subagent on 2026-05-12
-- All URLs verified reachable + producing valid feed content
--
-- Verification summary:
--   - Every URL curl-verified (HTTP 200) and content-inspected
--     for ≥3 recent items before inclusion.
--   - Last-updated dates confirmed within 30 days for daily sources,
--     90 days for weekly+ sources.
--   - Paywall tiers reflect actual subscription requirements (May 2026).
--   - Type breakdown: 10 RSS, 1 podcast RSS
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  -- ── Think Tanks / Institutional ──────────────────────────────────────

  (
    'War on the Rocks',
    'rss',
    'https://warontherocks.com/feed/',
    'Named-byline analysis on military strategy, national security, and foreign policy by practitioners and academics; one of the most cited free sources among US defense professionals.',
    array['geopolitics'],
    array['global_affairs', 'defense_policy', 'national_security'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.88,
    false,
    null,
    array['global_affairs', 'us_defense_policy', 'military_strategy', 'nato', 'us_foreign_policy', 'china_competition', 'russia_ukraine', 'middle_east_security', 'national_security']
  ),

  (
    'Atlantic Council',
    'rss',
    'https://www.atlanticcouncil.org/feed/',
    'Washington think tank publishing daily expert commentary and analysis on transatlantic security, NATO, democracy, energy, and great-power competition across all major regions.',
    array['geopolitics'],
    array['global_affairs', 'defense_policy'],
    'free',
    null,
    'daily',
    array['us', 'eu', 'global'],
    0.82,
    false,
    null,
    array['global_affairs', 'nato', 'transatlantic_security', 'russia_ukraine', 'china_competition', 'middle_east', 'democracy_promotion', 'energy_security', 'us_europe_relations']
  ),

  (
    'Just Security',
    'rss',
    'https://www.justsecurity.org/feed/',
    'NYU-affiliated legal and policy forum covering national security law, international law, human rights, and rule-of-law challenges facing the US and allied governments.',
    array['geopolitics'],
    array['global_affairs', 'international_law', 'national_security'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.85,
    false,
    null,
    array['global_affairs', 'national_security_law', 'international_humanitarian_law', 'us_executive_power', 'human_rights', 'sanctions_policy', 'war_powers', 'rule_of_law']
  ),

  (
    'Defense Priorities',
    'rss',
    'https://www.defensepriorities.org/feed/',
    'Realist foreign-policy think tank publishing analysis on military overextension, alliance burden-sharing, and restraint-oriented US grand strategy — distinct voice from mainstream interventionist consensus.',
    array['geopolitics'],
    array['global_affairs', 'defense_policy', 'us_grand_strategy'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.72,
    false,
    null,
    array['global_affairs', 'us_grand_strategy', 'military_restraint', 'nato_burden_sharing', 'middle_east_withdrawal', 'us_china_competition', 'defense_budgets', 'alliance_policy']
  ),

  (
    'MERIP — Middle East Research and Information Project',
    'rss',
    'https://www.merip.org/rss/',
    'Critical academic coverage of the Middle East since 1971; publishes peer-edited dispatches, essays, and podcast episodes from scholars and regional specialists unavailable in mainstream media.',
    array['geopolitics'],
    array['global_affairs', 'middle_east'],
    'free',
    null,
    'monthly',
    array['global'],
    0.78,
    false,
    null,
    array['global_affairs', 'middle_east_politics', 'palestine_israel', 'iran', 'gulf_states', 'arab_politics', 'colonialism_resistance', 'regional_security_middle_east']
  ),

  -- ── Trade Journalism ─────────────────────────────────────────────────

  (
    'Foreign Policy',
    'rss',
    'https://foreignpolicy.com/feed/',
    'Daily global-affairs journalism with named-byline correspondents covering geopolitics, diplomacy, war, and economics; feed provides headlines and abstracts with full text behind subscription.',
    array['geopolitics'],
    array['global_affairs'],
    'freemium',
    9.99,  -- FP Digital Access ~$99/yr (~$8.25/mo); some articles free
    'daily',
    array['us', 'global'],
    0.84,
    false,
    null,
    array['global_affairs', 'us_foreign_policy', 'china', 'russia', 'middle_east', 'europe_politics', 'diplomacy', 'sanctions', 'international_economics', 'conflict_reporting']
  ),

  (
    'BBC World News',
    'rss',
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'BBC''s global wire feed with named correspondents reporting on breaking international events, conflict, diplomacy, and humanitarian crises — the most widely distributed free English-language world feed.',
    array['geopolitics'],
    array['global_affairs'],
    'free',
    null,
    'realtime',
    array['global', 'eu'],
    0.82,
    false,
    null,
    array['global_affairs', 'international_news', 'conflict_reporting', 'diplomacy', 'europe_politics', 'asia_pacific', 'africa_news', 'middle_east', 'latin_america']
  ),

  (
    'The Guardian — World News',
    'rss',
    'https://www.theguardian.com/world/rss',
    'Guardian''s international newswire with strong UK and Commonwealth perspective; breaking world news, conflict dispatches, and analysis from a large global correspondent network.',
    array['geopolitics'],
    array['global_affairs'],
    'free',
    null,
    'realtime',
    array['global', 'eu'],
    0.80,
    false,
    null,
    array['global_affairs', 'international_news', 'conflict_reporting', 'climate_geopolitics', 'human_rights', 'europe_politics', 'africa_news', 'asia_pacific', 'uk_foreign_policy']
  ),

  (
    'Al Jazeera English',
    'rss',
    'https://www.aljazeera.com/xml/rss/all.xml',
    'Qatar-funded international broadcaster with strongest regional sourcing on Middle East, Africa, and South Asia; provides non-Western perspective critical for balanced global-affairs monitoring.',
    array['geopolitics'],
    array['global_affairs', 'middle_east'],
    'free',
    null,
    'realtime',
    array['global'],
    0.76,
    false,
    null,
    array['global_affairs', 'middle_east_politics', 'palestine_israel', 'gulf_states', 'africa_news', 'south_asia', 'non_western_perspective', 'humanitarian_crises', 'conflict_reporting']
  ),

  -- ── Specialty Newsletters ────────────────────────────────────────────

  (
    'Chartbook — Adam Tooze',
    'rss',
    'https://adamtooze.substack.com/feed',
    'Weekly deep-dives by Columbia historian Adam Tooze on the intersection of economics, geopolitics, and history — essential for understanding fiscal statecraft, energy transitions, and great-power rivalry through a macro lens.',
    array['geopolitics', 'finance'],
    array['global_affairs', 'monetary_policy', 'geoeconomics'],
    'freemium',
    10.00,  -- Substack paid tier ~$10/mo; substantial free content
    'weekly',
    array['global', 'us', 'eu'],
    0.87,
    false,
    null,
    array['global_affairs', 'geoeconomics', 'fiscal_policy', 'china_economy', 'europe_energy', 'dollar_hegemony', 'great_power_competition', 'climate_economics', 'debt_geopolitics']
  ),

  (
    'Sinocism — Bill Bishop',
    'rss',
    'https://sinocism.com/feed',
    'Daily China-focused newsletter by veteran Beijing analyst Bill Bishop synthesizing Chinese-language media, official statements, and economic data — the highest-signal English-language China intelligence feed.',
    array['geopolitics'],
    array['global_affairs', 'china'],
    'paid',
    14.92,  -- ~$179/yr paid Substack subscription; free tier gets limited access
    'daily',
    array['cn', 'us', 'global'],
    0.89,
    false,
    null,
    array['global_affairs', 'china_politics', 'xi_jinping', 'us_china_relations', 'china_economy', 'taiwan_strait', 'pla_military', 'chinese_foreign_policy', 'ccp_domestic_politics']
  ),

  -- ── Podcasts ────────────────────────────────────────────────────────

  (
    'War on the Rocks Podcast',
    'rss',
    'https://warontherocks.com/category/podcasts/feed/',
    'Long-form audio companion to War on the Rocks featuring practitioner-hosted conversations on strategy, defense policy, and geopolitics; multiple weekly shows averaging 4+ episodes/week.',
    array['geopolitics'],
    array['global_affairs', 'defense_policy', 'national_security'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.87,
    false,
    null,
    array['global_affairs', 'military_strategy', 'us_defense_policy', 'nato', 'russia_ukraine', 'china_competition', 'counterterrorism', 'nuclear_strategy', 'grand_strategy']
  )

on conflict (type, url) do update set
  name                     = excluded.name,
  description              = excluded.description,
  categories               = excluded.categories,
  subcategories            = excluded.subcategories,
  paywall_tier             = excluded.paywall_tier,
  paywall_cost_usd_monthly = excluded.paywall_cost_usd_monthly,
  update_cadence           = excluded.update_cadence,
  geography                = excluded.geography,
  quality_score            = excluded.quality_score,
  recommended_for_topics   = excluded.recommended_for_topics,
  updated_at               = now();
