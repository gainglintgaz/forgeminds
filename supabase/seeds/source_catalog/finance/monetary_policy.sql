-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — finance / monetary_policy
-- Curated by source-catalog-curator subagent on 2026-05-12
-- All URLs verified reachable + producing valid feed content
--
-- Verification summary:
--   - Every URL curl-verified (HTTP 200) and WebFetch/content-verified
--     for ≥3 recent items before inclusion.
--   - Last-updated dates confirmed within 30 days for daily/realtime
--     sources, 90 days for weekly+ sources (all confirmed current as of
--     2026-05-12).
--   - Paywall tiers reflect actual subscription requirements (May 2026
--     pricing where verifiable).
--   - NBER monetary-economics RSS rejected (redirect → 404).
--   - IMF, BoE public RSS feeds rejected (returned 403 or 404).
--   - WSJ, FT, Economist rejected (fetcher blocked or 403; paywall).
--   - Brookings generic /feed rejected (0 items). Search-filtered URL
--     accepted instead (10 items, verified 2026-05-12).
--   - Bank of Canada /feed verified HTTP 200, RSS valid, recent items.
--   - Calculated Risk blog legacy feed migrated to Substack — Substack
--     feed is now real-estate-focused; included for housing/macro signal.
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  -- ── Central Banks / Institutional ────────────────────────────────────

  (
    'Federal Reserve — Monetary Policy Press Releases',
    'rss',
    'https://www.federalreserve.gov/feeds/press_monetary.xml',
    'Official FOMC statements, rate decisions, and monetary policy communications published directly by the Board of Governors — the primary US source for central bank policy announcements.',
    array['finance'],
    array['monetary_policy'],
    'free',
    null,
    'realtime',
    array['us'],
    0.98,
    false,
    null,
    array['fomc', 'interest_rates', 'federal_reserve', 'rate_decisions', 'monetary_policy_us', 'central_banking', 'inflation_targets']
  ),

  (
    'Federal Reserve — Board Speeches',
    'rss',
    'https://www.federalreserve.gov/feeds/speeches.xml',
    'Speeches and testimony from Federal Reserve governors and regional bank presidents, offering forward guidance signals and policy reasoning not always captured in press releases.',
    array['finance'],
    array['monetary_policy'],
    'free',
    null,
    'daily',
    array['us'],
    0.96,
    false,
    null,
    array['federal_reserve', 'central_bank_communications', 'monetary_policy_us', 'fomc_speeches', 'forward_guidance', 'inflation', 'interest_rates']
  ),

  (
    'European Central Bank — Press Releases & Speeches',
    'rss',
    'https://www.ecb.europa.eu/rss/press.html',
    'ECB press releases, speeches, and interview transcripts — the definitive source for eurozone monetary policy decisions, governing council statements, and ECB leadership commentary.',
    array['finance'],
    array['monetary_policy'],
    'free',
    null,
    'daily',
    array['eu', 'global'],
    0.97,
    false,
    null,
    array['ecb', 'eurozone_monetary_policy', 'interest_rates_eu', 'central_banking_europe', 'inflation_eu', 'governing_council', 'ecb_speeches']
  ),

  (
    'ECB Working Papers',
    'rss',
    'https://www.ecb.europa.eu/rss/wppub.html',
    'Working papers from ECB economists covering monetary transmission, inflation dynamics, financial stability, and policy modeling — peer-reviewed quality research before formal journal publication.',
    array['finance', 'sciences'],
    array['monetary_policy'],
    'free',
    null,
    'weekly',
    array['eu', 'global'],
    0.92,
    false,
    null,
    array['ecb_research', 'monetary_transmission', 'inflation_modeling', 'central_bank_economics', 'eurozone_research', 'monetary_policy_theory']
  ),

  (
    'Bank for International Settlements — Central Bankers Speeches',
    'rss',
    'https://www.bis.org/doclist/cbspeeches.rss',
    'Aggregated speeches from central bank governors and senior officials worldwide, curated by the BIS — the broadest single source for global central bank policy signals.',
    array['finance'],
    array['monetary_policy'],
    'free',
    null,
    'daily',
    array['global'],
    0.95,
    false,
    null,
    array['central_banking_global', 'monetary_policy_global', 'interest_rates_global', 'bis', 'central_bank_communications', 'global_inflation', 'forward_guidance']
  ),

  (
    'Bank for International Settlements — Press Releases',
    'rss',
    'https://www.bis.org/doclist/all_pressrels.rss',
    'BIS press releases covering global monetary and financial system developments, Basel committee updates, and coordination announcements from the central bank of central banks.',
    array['finance'],
    array['monetary_policy'],
    'free',
    null,
    'daily',
    array['global'],
    0.93,
    false,
    null,
    array['bis', 'financial_stability', 'basel_committee', 'global_monetary_system', 'central_banking_regulation', 'monetary_policy_coordination']
  ),

  (
    'BIS Central Bank Research Hub',
    'rss',
    'https://www.bis.org/doclist/reshub_papers.rss',
    'Aggregates recent working papers from Fed, ECB, Bank of England, Bank of Spain, and other BIS member central banks — the most comprehensive single feed for central bank academic research.',
    array['finance', 'sciences'],
    array['monetary_policy'],
    'free',
    null,
    'daily',
    array['global'],
    0.91,
    false,
    null,
    array['central_bank_research', 'monetary_policy_research', 'monetary_transmission', 'inflation_research', 'interest_rate_theory', 'quantitative_easing', 'central_banking_academia']
  ),

  (
    'Bank of Canada — News Feed',
    'rss',
    'https://www.bankofcanada.ca/feed/',
    'Official Bank of Canada news feed covering rate announcements, monetary policy reports, and economic research — primary source for Canadian central bank policy.',
    array['finance'],
    array['monetary_policy'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.93,
    false,
    null,
    array['bank_of_canada', 'monetary_policy_canada', 'canadian_interest_rates', 'boc_rate_decisions', 'canadian_inflation', 'north_american_monetary_policy']
  ),

  -- ── Research & Academic ───────────────────────────────────────────────

  (
    'Federal Reserve — Finance and Economics Discussion Series',
    'rss',
    'https://www.federalreserve.gov/feeds/feds.xml',
    'Pre-publication working papers from Fed Board economists on monetary policy mechanisms, macroprudential tools, and financial market dynamics — highest-caliber US central bank research.',
    array['finance', 'sciences'],
    array['monetary_policy'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.91,
    false,
    null,
    array['federal_reserve_research', 'monetary_policy_research', 'macroeconomics', 'central_bank_economics', 'interest_rate_theory', 'financial_market_research']
  ),

  (
    'Brookings Institution — Monetary Policy Research',
    'rss',
    'https://www.brookings.edu/?s=monetary+policy&feed=rss2',
    'Brookings economists and the Hutchins Center publish nonpartisan analysis of Fed policy, inflation dynamics, and central bank reform — consistently cited by FOMC members and economists.',
    array['finance'],
    array['monetary_policy'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.84,
    false,
    null,
    array['monetary_policy_analysis', 'federal_reserve_critique', 'inflation_policy', 'hutchins_center', 'central_bank_reform', 'fiscal_monetary_interaction']
  ),

  -- ── Trade Journalism ──────────────────────────────────────────────────

  (
    'Bloomberg Economics News',
    'rss',
    'https://feeds.bloomberg.com/economics/news.rss',
    'Bloomberg''s economics desk breaking coverage of central bank decisions, inflation data, and monetary policy globally — freemium feed with headlines and summaries accessible without full subscription.',
    array['finance'],
    array['monetary_policy'],
    'freemium',
    34.99,
    'realtime',
    array['us', 'eu', 'global'],
    0.88,
    false,
    null,
    array['monetary_policy_news', 'central_bank_news', 'inflation_news', 'interest_rate_news', 'fed_news', 'ecb_news', 'global_economics_breaking']
  ),

  -- ── Specialty Newsletters ─────────────────────────────────────────────

  (
    'Chartbook — Adam Tooze',
    'rss',
    'https://adamtooze.substack.com/feed',
    'Historian-economist Adam Tooze (181K+ subscribers) publishes deep-dive macro analysis integrating monetary policy, geopolitics, and economic history — one of the most intellectually rigorous newsletters in economics.',
    array['finance'],
    array['monetary_policy'],
    'freemium',
    null,  -- free tier available; paid tier ~$8/mo on Substack
    'daily',
    array['global'],
    0.82,
    false,
    null,
    array['macroeconomics', 'monetary_policy_analysis', 'geopolitical_economics', 'central_banking_history', 'global_inflation', 'fiscal_policy', 'monetary_policy_theory']
  ),

  (
    'Calculated Risk Newsletter',
    'rss',
    'https://calculatedrisk.substack.com/feed',
    'Bill McBride''s long-running economics newsletter now on Substack, publishing housing market data, employment analysis, and macroeconomic cycle tracking at 4-6x weekly cadence.',
    array['finance'],
    array['monetary_policy'],
    'freemium',
    null,  -- free tier available; paid tier ~$10/mo
    'daily',
    array['us'],
    0.78,
    false,
    null,
    array['housing_market', 'employment_data', 'macro_cycle_tracking', 'us_economy', 'monetary_policy_effects', 'credit_conditions', 'real_estate_economics']
  ),

  -- ── Podcasts ──────────────────────────────────────────────────────────

  (
    'Macro Musings with David Beckworth',
    'rss',
    'https://rss.libsyn.com/shows/138806/destinations/865793.xml',
    'Mercatus Center''s flagship monetary economics podcast hosted by David Beckworth — weekly interviews with central bankers, academic economists, and Fed officials on monetary policy frameworks and theory.',
    array['finance'],
    array['monetary_policy'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.85,
    false,
    null,
    array['monetary_policy_podcast', 'central_banking', 'ngdp_targeting', 'monetary_theory', 'federal_reserve_interviews', 'macro_policy', 'monetary_economics_academic']
  ),

  (
    'Odd Lots — Bloomberg',
    'rss',
    'https://www.omnycontent.com/d/playlist/e73c998e-6e60-432f-8610-ae210140c5b1/8a94442e-5a74-4fa2-8b8d-ae27003a8d6b/982f5071-765c-403d-969d-ae27003a8d83/podcast.rss',
    'Bloomberg''s leading economics and markets podcast hosted by Joe Weisenthal and Tracy Alloway — covers monetary policy, financial markets, and macro with practitioners and academics; regularly features central bank officials.',
    array['finance'],
    array['monetary_policy'],
    'freemium',
    34.99,
    'daily',
    array['us', 'eu', 'global'],
    0.83,
    false,
    null,
    array['monetary_policy_podcast', 'central_banking', 'financial_markets', 'macro_economics', 'interest_rates', 'inflation_podcast', 'bloomberg_economics']
  )

on conflict (type, url) do update set
  name                  = excluded.name,
  description           = excluded.description,
  categories            = excluded.categories,
  subcategories         = excluded.subcategories,
  paywall_tier          = excluded.paywall_tier,
  paywall_cost_usd_monthly = excluded.paywall_cost_usd_monthly,
  update_cadence        = excluded.update_cadence,
  quality_score         = excluded.quality_score,
  recommended_for_topics = excluded.recommended_for_topics,
  updated_at            = now();
