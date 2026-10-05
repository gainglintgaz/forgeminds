-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — education / edtech
-- Curated by source-catalog-curator subagent on 2026-05-13
-- All URLs verified reachable + producing valid feed content
--
-- Verification summary:
--   - Every URL curl-verified (HTTP 200) and WebFetch/content-verified
--     for ≥3 recent items before inclusion.
--   - Last-updated dates confirmed within 30 days for daily sources,
--     90 days for weekly+ and podcast sources.
--   - Paywall tiers reflect actual subscription requirements (May 2026).
--   - Reddit feeds verified via curl with User-Agent header (200 OK).
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  -- ── Trade Journalism ─────────────────────────────────────────────────

  (
    'EdSurge',
    'rss',
    'https://www.edsurge.com/articles_rss',
    'Nonprofit newsroom covering K-12 and higher-education technology, policy, and teaching practice; the closest thing edtech has to a trade journal of record.',
    array['education'],
    array['edtech'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.80,
    false,
    null,
    array['edtech', 'edtech_policy', 'learning_management_systems', 'ai_in_education', 'higher_ed_technology', 'k12_technology', 'edtech_startups', 'online_learning', 'edtech_funding']
  ),

  (
    'Inside Higher Ed',
    'rss',
    'https://www.insidehighered.com/rss.xml',
    'Daily news covering higher-education policy, academic technology, campus administration, and faculty affairs — essential for tracking university-level edtech adoption and regulation.',
    array['education'],
    array['edtech', 'higher_education'],
    'freemium',
    null,  -- most articles free; some premium content requires registration
    'daily',
    array['us', 'global'],
    0.77,
    false,
    null,
    array['higher_ed_technology', 'lms_adoption', 'online_learning', 'ai_in_higher_ed', 'edtech_policy', 'academic_freedom', 'enrollment_trends', 'higher_ed_finance']
  ),

  (
    'K-12 Dive',
    'rss',
    'https://www.k12dive.com/feeds/news/',
    'Industry Dive''s K-12 vertical covering edtech procurement, cybersecurity in schools, curriculum technology, and district-level policy affecting pre-K through grade 12.',
    array['education'],
    array['edtech', 'k12'],
    'free',
    null,
    'daily',
    array['us'],
    0.74,
    false,
    null,
    array['k12_technology', 'edtech_procurement', 'school_cybersecurity', 'curriculum_technology', 'student_data_privacy', 'district_policy', 'edtech_vendors', 'classroom_tools']
  ),

  (
    'TechCrunch — EdTech',
    'rss',
    'https://techcrunch.com/tag/edtech/feed/',
    'TechCrunch''s edtech tag covering venture funding rounds, startup launches, and M&A in education technology — the go-to signal for investment and market-entry news.',
    array['education', 'tech'],
    array['edtech'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.72,
    false,
    null,
    array['edtech_startups', 'edtech_funding', 'edtech_venture_capital', 'ai_in_education', 'online_learning_platforms', 'edtech_acquisitions', 'edtech_market']
  ),

  -- ── Research Institutes / Foundations ────────────────────────────────

  (
    'Getting Smart',
    'rss',
    'https://www.gettingsmart.com/feed/',
    'Tom Vander Ark''s think-and-do-tank publishing practitioner-grade analysis of learning innovation, personalized learning, AI in classrooms, and competency-based education for K-12 and higher ed leaders.',
    array['education'],
    array['edtech'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.68,
    false,
    null,
    array['personalized_learning', 'ai_in_education', 'competency_based_education', 'learning_innovation', 'k12_technology', 'future_of_learning', 'edtech_leadership', 'school_redesign']
  ),

  (
    'Hewlett Foundation',
    'rss',
    'https://hewlett.org/feed/',
    'The William and Flora Hewlett Foundation publishes grant-making rationale and research on deeper learning, open educational resources, and education equity — a primary funder of edtech research.',
    array['education'],
    array['edtech'],
    'free',
    null,
    'monthly',
    array['us', 'global'],
    0.82,
    false,
    null,
    array['open_educational_resources', 'deeper_learning', 'education_equity', 'edtech_philanthropy', 'competency_based_education', 'edtech_research_funding', 'education_policy']
  ),

  -- ── Industry / Investor Insights ─────────────────────────────────────

  (
    'Reach Capital',
    'rss',
    'https://www.reachcapital.com/feed/',
    'Edtech-focused venture capital firm publishing investment theses, portfolio company spotlights, and sector analysis on learning, special education AI, and workforce technology.',
    array['education', 'finance'],
    array['edtech'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.70,
    false,
    null,
    array['edtech_venture_capital', 'edtech_startups', 'edtech_funding', 'special_education_technology', 'workforce_learning', 'edtech_market', 'ai_in_education', 'learning_equity']
  ),

  -- ── Education Journalism (mission-driven) ────────────────────────────

  (
    'The 74',
    'rss',
    'https://www.the74million.org/feed/',
    'Nonprofit journalism outlet covering U.S. education from early childhood through higher ed, with particular strength on equity, accountability, and technology''s effects on learning outcomes.',
    array['education'],
    array['edtech', 'k12', 'higher_education'],
    'free',
    null,
    'daily',
    array['us'],
    0.75,
    false,
    null,
    array['education_equity', 'k12_technology', 'edtech_policy', 'charter_schools', 'student_achievement', 'ai_in_education', 'education_accountability', 'school_choice']
  ),

  -- ── Podcasts ─────────────────────────────────────────────────────────

  (
    'House of #EdTech',
    'rss',
    'https://feeds.captivate.fm/houseofedtech/',
    'Christopher Nesi''s practitioner-hosted podcast reviewing edtech tools, AI classroom applications, and digital pedagogy strategies for K-12 educators, publishing regularly since 2014.',
    array['education'],
    array['edtech'],
    'free',
    null,
    'monthly',
    array['us', 'global'],
    0.62,
    false,
    null,
    array['classroom_technology', 'edtech_tools', 'ai_in_education', 'digital_pedagogy', 'k12_technology', 'teacher_professional_development', 'edtech_reviews']
  ),

  -- ── Communities ──────────────────────────────────────────────────────

  (
    'r/Teachers',
    'reddit_subreddit',
    'https://www.reddit.com/r/Teachers/.rss',
    'The 1.2M-member Reddit teacher community where K-12 educators discuss classroom technology, edtech tool frustrations, AI policy debates, and real-world adoption barriers — the highest signal grassroots view of edtech in practice.',
    array['education'],
    array['edtech', 'k12'],
    'free',
    null,
    'realtime',
    array['us'],
    0.55,
    true,
    'reddit',
    array['classroom_technology', 'ai_in_education', 'teacher_professional_development', 'edtech_adoption', 'k12_technology', 'student_data_privacy', 'lms_adoption', 'edtech_policy']
  ),

  (
    'r/edtech',
    'reddit_subreddit',
    'https://www.reddit.com/r/edtech/.rss',
    'Subreddit for edtech practitioners, founders, and researchers sharing tool reviews, market commentary, startup launches, and implementation case studies across K-12 and higher education.',
    array['education'],
    array['edtech'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.45,
    true,
    'reddit',
    array['edtech_tools', 'edtech_startups', 'online_learning', 'lms_adoption', 'ai_in_education', 'edtech_procurement', 'classroom_technology', 'edtech_reviews']
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
