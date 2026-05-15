-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — finance / personal_finance
-- Curated by source-catalog-curator subagent on 2026-05-15
-- All URLs verified reachable + producing valid feed content
-- ════════════════════════════════════════════════════════════════════
--
-- REJECTIONS (URLs considered but failed verification):
--   https://www.mrmoneymustache.com/feed/          — HTTP 403 Forbidden
--   https://feeds.feedburner.com/ThePennyHoarder   — Empty body returned (no content)
--   https://www.thepennyhoarder.com/feed/          — Empty body returned (no content)
--   https://www.getrichslowly.org/feed/            — HTTP 403 Forbidden
--   https://www.wisebread.com/feed                 — Redirects to third-party killeraces.com (unverified chain)
--   https://www.investopedia.com/feeds/investopedia-personal-finance.aspx — Blocked (fetch not allowed)
--   https://www.consumerfinance.gov/about-us/blog/feed/ — CFPB blog archived May 14 2026; zero items
--   https://feeds.feedburner.com/doughroller       — HTTP 404
--   https://feeds.feedburner.com/ChooseToThrive    — HTTP 404
--   https://feeds.megaphone.fm/plannerlife         — HTTP 404
--   https://www.kiplinger.com/feeds/rss/personal-finance.rss — HTTP 404
--   https://www.kiplinger.com/rss/personal-finance — HTTP 404
--   https://howimoneycom.libsyn.com/rss            — HTTP 404
--   https://feeds.simplecast.com/YVnabs5e          — HTTP 404
--   https://rss.art19.com/how-to-money             — HTTP 404
--   https://howtomoney.com/feed/podcast            — HTTP 404
--   https://feeds.megaphone.fm/HSW7408638726       — HTTP 404
--   https://rss.art19.com/bigger-pockets-money-show — HTTP 404
--   https://feeds.megaphone.fm/biggerpocketsmoney  — HTTP 404
--   https://www.usfinancialcapability.org/rss/news.xml — Redirects to FINRA foundation page (not a feed)
--   https://feeds.feedburner.com/financial-samurai — HTTP 404 (direct /feed/ URL used instead)
--   https://feeds.feedburner.com/AffordAnything    — Stale FeedBurner mirror; content from 2021 only
--   https://consumer.ftc.gov/consumer-alerts/rss.xml — HTTP 403
--   https://ftc.gov/consumer-alerts/rss.xml        — HTTP 403
--   https://feeds.megaphone.fm/ChooseFI            — HTTP 404
--   https://feeds.megaphone.fm/rewindforward       — HTTP 404
--   https://feeds.feedburner.com/MoneyGirlQuickAndDirtyTips — HTTP 404
--   https://feeds.megaphone.fm/stacking-benjamins  — 301 → rss.art19.com (resolved chain used instead)
--   https://petetheplannershow.libsyn.com/rss      — HTTP 404
--   https://rss.art19.com/so-money                 — HTTP 404
--   https://www.marketwatch.com/rss/personal-finance — Blocked (fetch not allowed)
--   https://www.thesimpledollar.com/feed/          — Only 1 item from April 2025; effectively dormant
--   https://www.irs.gov/rss-newsfeed               — HTTP 404
--   https://www.irs.gov/newsroom/tax-news-information-feed — HTTP 404
--   https://podcasts.apple.com/us/podcast/how-to-money/id1148650985 — HTML page, no feed URL found
--   https://feeds.npr.org/510338/podcast.xml       — NPR Life Kit covers general lifestyle, not personal finance
--   Planet Money (feeds.npr.org/510289) retained — covers economic forces relevant to personal finance decisions

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  (
    'NerdWallet Blog',
    'rss',
    'https://www.nerdwallet.com/blog/feed/',
    'NerdWallet''s editorial team publishes daily personal finance guides covering credit cards, mortgages, budgeting tools, and banking comparisons. Staffed by credentialed journalists and subject-matter experts; primary audience is US consumers making financial product decisions.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'daily',
    array['us'],
    0.82,
    false,
    null,
    array['credit_cards', 'mortgages', 'budgeting', 'savings_accounts', 'personal_loans', 'banking', 'debt_payoff']
  ),

  (
    'ChooseFI Podcast',
    'rss',
    'https://feeds.choosefi.com/rss/choosefi-podcast',
    'Weekly podcast from Brad Barrett and Jonathan Mendonsa dedicated entirely to the financial independence / retire early (FIRE) movement; covers frugality tactics, tax optimization, index investing, and community-sourced case studies. One of the largest FIRE-focused communities with 300K+ active members.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'weekly',
    array['us'],
    0.80,
    false,
    null,
    array['fire_movement', 'financial_independence', 'early_retirement', 'index_investing', 'frugality', 'tax_optimization', 'side_hustles']
  ),

  (
    'Afford Anything Podcast',
    'rss',
    'https://affordanything.com/feed/',
    'Paula Pant''s long-form podcast and blog at the intersection of FIRE, real estate investing, and behavioral finance; episodes air 2-3x per week mixing Q&A deep dives with expert interviews. Rigorous on math — tracks debt payoff, opportunity cost, and rental yield with first-principles reasoning rather than rules of thumb.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'weekly',
    array['us'],
    0.85,
    false,
    null,
    array['fire_movement', 'financial_independence', 'real_estate_investing', 'debt_payoff', 'behavioral_finance', 'retirement_planning', 'budgeting']
  ),

  (
    'Bogleheads Forum',
    'rss',
    'https://www.bogleheads.org/forum/feed.php',
    'Community forum built around John Bogle''s passive-index-investing philosophy; discussions span retirement accounts (401k, IRA, Roth conversions), asset allocation, tax-loss harvesting, and withdrawal strategies. Signal-to-noise ratio is exceptionally high — moderation is strict and contributors frequently include CFPs and CPAs.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'hourly',
    array['us', 'global'],
    0.88,
    false,
    null,
    array['index_investing', 'retirement_planning', '401k', 'roth_ira', 'asset_allocation', 'tax_loss_harvesting', 'withdrawal_strategies', 'financial_independence']
  ),

  (
    'The Stacking Benjamins Show',
    'rss',
    'https://rss.art19.com/stacking-benjamins',
    'Award-winning personal finance podcast releasing 3 episodes per week; co-hosts Joe Saul-Sehy (former financial planner) and OG (CFP) interview authors, economists, and planners while maintaining an accessible, humor-forward tone. Covers budgeting, debt elimination, insurance, and retirement with enough rigor to satisfy practitioners.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'daily',
    array['us'],
    0.78,
    false,
    null,
    array['budgeting', 'debt_payoff', 'retirement_planning', 'investing_for_individuals', 'insurance', 'savings', 'behavioral_finance']
  ),

  (
    'Financial Samurai',
    'rss',
    'https://financialsamurai.com/feed/',
    'Sam Dogen''s data-rich blog by a former Goldman Sachs VP who retired at 34; in-depth long-form analysis on FIRE milestones, real estate, passive income streams, and wealth preservation for high earners. One of the oldest and most-cited FIRE blogs, publishing since 2009 with weekly cadence.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'weekly',
    array['us'],
    0.82,
    false,
    null,
    array['fire_movement', 'financial_independence', 'early_retirement', 'real_estate_investing', 'passive_income', 'wealth_building', 'savings_rate']
  ),

  (
    'Early Retirement Now',
    'rss',
    'https://earlyretirementnow.com/feed/',
    'Big ERN''s (Dr. Karsten Jeske, PhD Economics) rigorous quantitative blog focused on safe withdrawal rates, sequence-of-returns risk, and options strategies in the FIRE context. Publishes the definitive Safe Withdrawal Rate series — mandatory reading for anyone modeling early retirement; updated monthly with macro-aware commentary.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'monthly',
    array['us', 'global'],
    0.91,
    false,
    null,
    array['safe_withdrawal_rate', 'fire_movement', 'retirement_planning', 'sequence_of_returns', 'portfolio_withdrawal', 'financial_independence', 'options_strategies']
  ),

  (
    'Millennial Revolution',
    'rss',
    'https://millennial-revolution.com/feed/',
    'Kristy Shen and Bryce Leung''s blog documenting their path from 0 to $1M in savings on average salaries, retiring at 31 without owning real estate; covers index investing, geo-arbitrage, and family FIRE with a math-first approach and a skeptical take on homeownership dogma.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'monthly',
    array['us', 'global'],
    0.76,
    false,
    null,
    array['fire_movement', 'financial_independence', 'early_retirement', 'index_investing', 'geo_arbitrage', 'frugality', 'wealth_building']
  ),

  (
    'Money Under 30',
    'rss',
    'https://www.moneyunder30.com/feed',
    'Editorial site targeting young adults (20s-30s) navigating first credit cards, student loan repayment, renter vs. buyer decisions, and early investing; publishes comprehensive product comparison guides alongside actionable personal finance how-tos updated bi-weekly.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'weekly',
    array['us'],
    0.72,
    false,
    null,
    array['budgeting', 'credit_cards', 'student_loans', 'debt_payoff', 'first_time_investing', 'savings_accounts', 'renting_vs_buying']
  ),

  (
    'Clark Howard',
    'rss',
    'https://clark.com/feed/',
    'Consumer advocate Clark Howard''s publication covering everyday money decisions: insurance shopping, credit monitoring, retirement account best practices, and fee avoidance strategies. Daily publishing cadence with a practical, non-aspirational focus on protecting what you already have and avoiding common financial traps.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'daily',
    array['us'],
    0.75,
    false,
    null,
    array['budgeting', 'savings', 'credit_cards', 'insurance', 'retirement_planning', 'consumer_protection', 'debt_payoff']
  ),

  (
    'CFPB Newsroom',
    'rss',
    'https://www.consumerfinance.gov/about-us/newsroom/feed/',
    'Official press feed of the Consumer Financial Protection Bureau; publishes enforcement actions, supervisory findings, rule changes, and consumer research covering mortgages, credit reporting, student loans, and payday lending. Primary US regulatory source for individual consumer financial rights and protections.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'monthly',
    array['us'],
    0.90,
    false,
    null,
    array['consumer_protection', 'mortgage_regulation', 'credit_reporting', 'student_loans', 'debt_collection', 'payday_lending', 'financial_regulation']
  ),

  (
    'BiggerPockets Real Estate Blog',
    'rss',
    'https://www.biggerpockets.com/blog/feed',
    'Daily blog from the largest US real estate investing community; covers rental property analysis, BRRRR strategy, house hacking, REITs, and short-term rental economics for individual investors. High publication frequency with practitioner-authored case studies and market condition reports.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'daily',
    array['us'],
    0.77,
    false,
    null,
    array['real_estate_investing', 'rental_properties', 'house_hacking', 'passive_income', 'brrrr_strategy', 'reits', 'wealth_building']
  ),

  (
    'White Coat Investor',
    'rss',
    'https://whitecoatinvestor.com/feed/',
    'Dr. James Dahle''s daily blog and podcast focused on personal finance for high-income professionals (physicians, dentists, lawyers); covers practice-specific retirement accounts, disability insurance, student loan repayment strategies, and backdoor Roth conversions. Authoritative for any high-earner navigating complex tax-advantaged account stacking.',
    array['finance'],
    array['personal_finance'],
    'free',
    null,
    'daily',
    array['us'],
    0.86,
    false,
    null,
    array['retirement_planning', 'backdoor_roth', 'student_loan_repayment', 'disability_insurance', 'tax_advantaged_accounts', 'high_income_investing', 'financial_independence']
  ),

  (
    'Planet Money (NPR)',
    'rss',
    'https://feeds.npr.org/510289/podcast.xml',
    'NPR''s flagship economics and personal finance storytelling podcast; explains how macro forces — inflation, interest rates, labor markets, trade policy — translate into individual financial decisions. Two episodes per week with high production quality and fact-checked economic reporting that contextualizes savings, investing, and debt decisions.',
    array['finance'],
    array['personal_finance', 'economics'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.92,
    false,
    null,
    array['inflation', 'interest_rates', 'labor_markets', 'savings', 'debt', 'economic_policy_impact', 'investing_for_individuals', 'consumer_economics']
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
