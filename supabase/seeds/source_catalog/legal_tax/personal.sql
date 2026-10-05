-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — legal_tax / personal
-- Curated by source-catalog-curator subagent on 2026-05-15
-- All URLs verified reachable + producing valid feed content
--
-- Scope: US personal taxes (IRS-adjacent, OBBBA, state DOR signals),
-- personal legal matters (estate/will/contract/family-law general
-- information — NOT advice), consumer protection (FTC, CFPB),
-- small-business / self-employment tax + legal, US Tax Court rulings
-- affecting individuals, US Supreme Court opinions, federal
-- legislative/regulatory tax updates.
--
-- COMPLIANCE NOTE (per .claude/rules/compliance.md):
--   Every source description below is INFORMATIONAL ONLY. This catalog
--   surfaces news/rulings/analysis — it does NOT constitute legal or
--   tax advice. Downstream UI surfaces consuming this catalog must
--   render the standard three-layer disclaimer copy (inline + section
--   header + settings) for any user-facing summary derived from these
--   sources.
--
-- Verification summary:
--   - Every URL WebFetch-verified (HTTP 200) and content-verified
--     for ≥3 recent items before inclusion.
--   - Last-updated dates confirmed within 30 days for daily sources,
--     90 days for weekly+ sources (all confirmed current 2026-05-15).
--
-- Rejections (do not re-add without re-verification):
--   - IRS Newsroom RSS (multiple candidate paths tried:
--     /pub/irs-rss/newsroom.rss, /pub/irs-rss/taxtips.rss,
--     /newsroom/rss, /uac/irs-newswire-rss, /downloads/rss) — every
--     guess returned 404. IRS appears to have retired their public
--     RSS feeds; use TAS feed (below) plus IRS Newswire email
--     subscriptions instead. Covered via Journal of Accountancy +
--     Tax Foundation + TAS as proxies.
--   - US Tax Court direct RSS (ustaxcourt.gov/rss/*.xml) — 404.
--     Substituted with CourtListener Tax Court Atom feed (verified).
--   - FTC press release RSS (ftc.gov/feeds/press-release.xml,
--     consumer-protection.xml, consumer.ftc.gov/consumer-alerts/rss) —
--     all returned 403 (anti-bot). Cannot verify, excluded.
--   - Reuters Legal feed (reuters.com/arc/outboundfeeds/...) —
--     blocked by Claude Code WebFetch policy (cannot verify).
--   - Bloomberg Tax — no public free RSS feed exists; paid product
--     behind pro.bloombergtax.com subscription.
--   - Law360 / Tax Notes — paywalled, no free RSS feed accessible
--     for verification.
--   - r/tax, r/legaladvice, r/personalfinance subreddits — Reddit
--     blocked by Claude Code WebFetch policy. Cannot verify SNR or
--     activity; excluded until per-tenant OAuth fetch is wired
--     (then revisit with `requires_oauth=true`).
--   - Procedurally Taxing (procedurallytaxing.com/feed) — 403.
--   - Tax Policy Center / TaxVox blog (taxpolicycenter.org/taxvox/feed,
--     /feed/all) — 403.
--   - Cornell LII Supreme Court feed (supct_recent.rss) — feed
--     last updated 2019; stale beyond 90-day window. Use CourtListener
--     scotus feed instead (verified).
--   - Cornell LII blog (blog.law.cornell.edu/feed) — last item
--     May 2024, stale beyond 90-day weekly threshold.
--   - Cornell LII US Code Title 26 (Tax Code) updates feed —
--     valid RSS but most recent legislative-update entry from 2010;
--     stale beyond threshold.
--   - Cornell LII Wex legal encyclopedia feed — 404.
--   - NY DTF press RSS (tax.ny.gov/rss/press.xml, /help/rss.htm) — 404.
--     CA FTB has no published RSS feed. State DOR coverage deferred
--     until state-specific subcategory is added.
--   - Treasury press feed (home.treasury.gov/news/press-releases/feed,
--     /rss/press) — both timed out (60s); cannot verify.
--   - EY Tax News (taxnews.ey.com/rss/news.rss) — empty body returned.
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  -- ── Government / Institutional (US federal) ───────────────────────────

  (
    'Taxpayer Advocate Service — News',
    'rss',
    'https://www.taxpayeradvocate.irs.gov/feed/',
    'Official news, blog posts, and bulletins from the Taxpayer Advocate Service (an independent organization within the IRS). Surfaces scam alerts, taxpayer-rights bulletins, and procedural guidance most directly relevant to individual filers and small-business owners.',
    array['legal_tax'],
    array['personal'],
    'free',
    null,
    'weekly',
    array['us'],
    0.95,
    false,
    null,
    array['irs_news', 'taxpayer_rights', 'tax_scams', 'tax_filing', 'tax_procedure', 'individual_taxes', 'self_employment_tax', 'irs_notices']
  ),

  (
    'Consumer Financial Protection Bureau — Newsroom',
    'rss',
    'https://www.consumerfinance.gov/about-us/newsroom/feed/',
    'Official CFPB press releases on consumer protection enforcement actions, fair lending, credit reporting, debt collection, and mortgage rules. Primary signal for personal-finance regulatory developments affecting US consumers.',
    array['legal_tax'],
    array['personal'],
    'free',
    null,
    'monthly',
    array['us'],
    0.92,
    false,
    null,
    array['consumer_protection', 'fair_lending', 'credit_reporting', 'debt_collection', 'mortgage_rules', 'cfpb_enforcement', 'financial_regulation_personal']
  ),

  -- ── Courts (US federal — Tax & Supreme) ───────────────────────────────

  (
    'US Tax Court — Opinions (via CourtListener)',
    'rss',
    'https://www.courtlistener.com/feed/court/tax/',
    'Atom feed of US Tax Court opinions (TC Memo, regular, and summary decisions) maintained by Free Law Project. Surfaces rulings on individual tax disputes, deductions, dependency, innocent spouse relief, and self-employment-tax cases the moment they are filed.',
    array['legal_tax'],
    array['personal'],
    'free',
    null,
    'daily',
    array['us'],
    0.93,
    false,
    null,
    array['tax_court_rulings', 'tax_case_law', 'individual_tax_disputes', 'tc_memo', 'self_employment_disputes', 'innocent_spouse', 'tax_deductions']
  ),

  (
    'US Supreme Court — Opinions (via CourtListener)',
    'rss',
    'https://www.courtlistener.com/feed/court/scotus/',
    'Atom feed of US Supreme Court slip opinions and orders maintained by Free Law Project. Covers all SCOTUS decisions including those affecting individual taxpayers, federal tax statutes, consumer-protection precedent, estate-tax doctrine, and personal-liberty rulings.',
    array['legal_tax'],
    array['personal'],
    'free',
    null,
    'weekly',
    array['us'],
    0.95,
    false,
    null,
    array['supreme_court_opinions', 'scotus_rulings', 'constitutional_law', 'federal_tax_precedent', 'consumer_protection_precedent', 'estate_law_precedent']
  ),

  -- ── Trade publications / Specialty newsletters ────────────────────────

  (
    'Journal of Accountancy',
    'rss',
    'https://www.journalofaccountancy.com/feed/rss.html',
    'AICPA-published trade publication for CPAs covering federal and state tax developments, IRS procedural changes, OBBBA implementation guidance, ERC claim updates, and practitioner-grade tax-news commentary relevant to individuals with complex returns and self-employment income.',
    array['legal_tax'],
    array['personal'],
    'free',
    null,
    'daily',
    array['us'],
    0.85,
    false,
    null,
    array['cpa_news', 'tax_practitioner_news', 'irs_procedure', 'tax_filing_updates', 'obbba_guidance', 'erc_claims', 'tax_news_us', 'aicpa']
  ),

  (
    'Tax Foundation',
    'rss',
    'https://taxfoundation.org/feed/',
    'Nonpartisan tax policy research organization covering federal, state, and international tax developments. Useful for tracking US individual-income-tax, capital-gains, estate-tax, and state-level tax-policy changes with quantitative analysis — geared toward informed taxpayers and policymakers, not advice-seeking filers.',
    array['legal_tax'],
    array['personal'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.85,
    false,
    null,
    array['tax_policy_analysis', 'individual_income_tax', 'capital_gains', 'estate_tax', 'state_tax_policy', 'federal_tax_reform', 'obbba_analysis']
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
