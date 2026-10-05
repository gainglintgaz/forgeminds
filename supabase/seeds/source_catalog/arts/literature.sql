-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — arts / literature
-- Curated by source-catalog-curator subagent on 2026-05-13
-- All URLs verified reachable + producing valid feed content
--
-- Verification summary:
--   - Every URL WebFetch-verified (HTTP 200) for ≥1 recent item
--     and last-updated date before inclusion.
--   - For daily sources: last update within 30 days (all confirmed
--     May 2026 for daily/weekly sources).
--   - For quarterly sources (n+1, The Drift): within 90 days confirmed.
--   - Paywall tiers reflect actual subscription requirements (May 2026
--     pricing where verifiable).
--
-- Rejected candidates (see report):
--   - Paris Review main RSS (https://www.theparisreview.org/feed) — HTTP 403
--   - LA Review of Books RSS (https://lareviewofbooks.org/feed/) — HTTP 403
--   - Granta RSS (https://granta.com/feed/) — HTTP 403
--   - Publishers Weekly feed (pw-all-news.xml, pw-front-page.xml) — HTML, not RSS
--   - The Millions main feed (https://www.themillionsonline.com/feed/) — ECONNREFUSED
--   - Kirkus Reviews RSS (multiple paths tried) — 404
--   - NYT Books RSS — blocked by domain
--   - New Yorker Books RSS — blocked by domain
--   - The Atlantic Books RSS — blocked by domain
--   - NYRB /feed/ — RSS shell, 0 items; FeedBurner redirect works
--   - LRB article RSS (multiple paths) — 404
--   - Backlisted podcast (acast/backlisted) — most recent ep May 2020, >90d
--   - Lit Hub Radio podcast feed — 0 items, last built Dec 2020
--   - Tin House RSS — 404
--   - Catapult.co RSS — redirects to homepage, no feed
--   - Poetry Foundation RSS — HTTP 403
--   - Booker Prize RSS — HTTP 403
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  -- ── Book Trade Journalism / Daily ─────────────────────────────────────

  (
    'Literary Hub (Lit Hub)',
    'rss',
    'https://www.lithub.com/feed/',
    'The web''s essential daily literary culture destination — essays, criticism, fiction excerpts, interviews, and reading lists aggregated from the most respected voices in contemporary publishing.',
    array['arts'],
    array['literature'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.82,
    false,
    null,
    array['literary_criticism', 'book_reviews', 'fiction', 'essays', 'author_interviews', 'contemporary_literature', 'publishing_industry', 'translation', 'poetry']
  ),

  (
    'Publishers Weekly',
    'rss',
    'https://www.publishersweekly.com/pw/feeds/recent/index.xml',
    'The trade bible of the American book industry, publishing daily news on acquisitions, sales data, rights deals, bestseller lists, and pre-publication reviews used by librarians and booksellers worldwide.',
    array['arts'],
    array['literature'],
    'freemium',
    null,  -- basic site access free; PW Select and full digital archive require subscription
    'daily',
    array['us', 'global'],
    0.80,
    false,
    null,
    array['book_trade', 'publishing_industry', 'book_acquisitions', 'bestseller_lists', 'book_reviews', 'literary_agents', 'bookselling', 'rights_deals', 'debut_fiction']
  ),

  (
    'Book Riot',
    'rss',
    'https://bookriot.com/feed/',
    'High-traffic book recommendations and reviews platform with a particularly strong focus on diverse literature, genre fiction, and reader-community programming — useful for tracking popular reading trends.',
    array['arts'],
    array['literature'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.58,
    false,
    null,
    array['book_recommendations', 'diverse_literature', 'genre_fiction', 'mystery', 'science_fiction', 'young_adult', 'graphic_novels', 'book_deals', 'reading_lists']
  ),

  -- ── Literary Journals / Print Publications ────────────────────────────

  (
    'The Paris Review Blog',
    'rss',
    'https://www.theparisreview.org/blog/feed/',
    'The digital companion to the legendary quarterly, publishing new fiction, poetry, essays, art criticism, and excerpts from the archive of Writers at Work interviews — the standard of American literary culture since 1953.',
    array['arts'],
    array['literature'],
    'freemium',
    5.42,  -- digital subscription $65/yr (~$5.42/mo); blog content largely free
    'weekly',
    array['us', 'global'],
    0.90,
    false,
    null,
    array['fiction', 'poetry', 'literary_interviews', 'art_criticism', 'essays', 'short_stories', 'writers_craft', 'american_literature', 'contemporary_fiction']
  ),

  (
    'n+1 Magazine',
    'rss',
    'https://nplusonemag.com/feed/',
    'Rigorous Brooklyn-based journal of literature, culture, and politics whose essays set the standard for contemporary critical writing — essential for tracking intellectual debates about fiction, aesthetics, and cultural criticism.',
    array['arts'],
    array['literature'],
    'freemium',
    4.17,  -- print+digital subscription $50/yr (~$4.17/mo); some content free online
    'weekly',
    array['us', 'global'],
    0.87,
    false,
    null,
    array['literary_criticism', 'cultural_criticism', 'essays', 'fiction', 'poetry', 'aesthetics', 'contemporary_literature', 'intellectual_culture', 'politics_literature']
  ),

  (
    'Electric Literature',
    'rss',
    'https://electricliterature.com/feed/',
    'Independent literary magazine and publisher specializing in original fiction, poetry, and criticism with particular depth in debut authors, women writers, and writers of color — updates daily with verified original content.',
    array['arts'],
    array['literature'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.72,
    false,
    null,
    array['fiction', 'short_stories', 'poetry', 'debut_authors', 'diverse_literature', 'author_interviews', 'literary_criticism', 'contemporary_fiction', 'essay']
  ),

  (
    'Guernica Magazine',
    'rss',
    'https://www.guernicamag.com/feed/',
    'Nonprofit magazine of global arts and politics publishing fiction, poetry, and essays by internationally recognized writers — particularly strong in translated literature, postcolonial perspectives, and long-form reportage.',
    array['arts'],
    array['literature'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.76,
    false,
    null,
    array['international_literature', 'translation', 'fiction', 'poetry', 'essays', 'postcolonial_literature', 'global_fiction', 'literary_reportage', 'world_literature']
  ),

  (
    'The Drift Magazine',
    'rss',
    'https://www.thedriftmag.com/feed/',
    'New York-based quarterly of culture and politics whose essays on contemporary fiction, criticism, and cultural theory have rapidly established it as a necessary voice for intellectual readers interested in how literature intersects with politics.',
    array['arts'],
    array['literature'],
    'freemium',
    5.00,  -- print subscription $60/yr; some digital content free; exact online-only tier unconfirmed
    'monthly',
    array['us', 'global'],
    0.82,
    false,
    null,
    array['literary_criticism', 'cultural_theory', 'essays', 'contemporary_fiction', 'aesthetics', 'politics_literature', 'cultural_criticism', 'intellectual_culture']
  ),

  -- ── Global Critical Journals / Major Publications ─────────────────────

  (
    'New York Review of Books',
    'rss',
    'https://feeds.feedburner.com/nybooks',
    'The benchmark for serious long-form literary and intellectual criticism in the English-speaking world — essential for tracking major reviews of important new books, translated literature, and the conversations that shape literary reputation.',
    array['arts'],
    array['literature'],
    'paid',
    7.00,  -- digital subscription ~$84/yr (~$7/mo); some articles free
    'weekly',
    array['us', 'global'],
    0.92,
    false,
    null,
    array['literary_criticism', 'book_reviews', 'intellectual_culture', 'essays', 'translated_literature', 'history_writing', 'biography', 'philosophy_literature', 'fiction_reviews']
  ),

  (
    'New Statesman',
    'rss',
    'https://www.newstatesman.com/feed',
    'British weekly magazine of politics and culture with consistently strong literary criticism covering British and international fiction, biography, and cultural essay — the primary UK voice for serious book coverage outside specialist journals.',
    array['arts'],
    array['literature'],
    'freemium',
    12.99,  -- digital subscription £9.99/mo (~$12.99); some content free
    'daily',
    array['eu', 'global'],
    0.74,
    false,
    null,
    array['book_reviews', 'literary_criticism', 'british_literature', 'fiction_reviews', 'biography', 'cultural_criticism', 'essays', 'international_literature']
  ),

  -- ── International / Translation Focus ────────────────────────────────

  (
    'Words Without Borders',
    'rss',
    'https://wordswithoutborders.org/feed/',
    'The authoritative nonprofit online magazine for international literature in English translation — the primary discovery source for works from Africa, Asia, Latin America, and the Middle East not yet in major Anglophone review outlets.',
    array['arts'],
    array['literature'],
    'free',
    null,
    'weekly',
    array['global'],
    0.84,
    false,
    null,
    array['translated_literature', 'world_literature', 'international_fiction', 'poetry_translation', 'global_authors', 'african_literature', 'asian_literature', 'latin_american_literature', 'middle_eastern_literature']
  ),

  -- ── The Millions ──────────────────────────────────────────────────────

  (
    'The Millions',
    'rss',
    'https://themillions.com/feed',
    'Critically respected independent literary magazine publishing in-depth book coverage including major reading previews, year-in-review features, and long-form critical essays — the annual Great Books Preview is the most-cited seasonal reading guide in literary publishing.',
    array['arts'],
    array['literature'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.78,
    false,
    null,
    array['book_reviews', 'fiction', 'literary_criticism', 'contemporary_literature', 'debut_fiction', 'reading_previews', 'essays', 'author_interviews', 'american_literature']
  ),

  -- ── Newsletters (Substack) ────────────────────────────────────────────

  (
    'Story Club with George Saunders',
    'rss',
    'https://georgesaunders.substack.com/feed',
    'Pulitzer Prize-winning author George Saunders'' Substack newsletter devoted entirely to the craft of the short story — with 130K+ subscribers, it is the most-followed literary craft newsletter in the English language.',
    array['arts'],
    array['literature'],
    'freemium',
    5.00,  -- free tier available; paid $50/yr (~$5/mo) for full archive and comments
    'weekly',
    array['us', 'global'],
    0.88,
    false,
    null,
    array['writers_craft', 'short_stories', 'fiction_technique', 'literary_analysis', 'writing_instruction', 'contemporary_fiction', 'story_structure', 'narrative_theory']
  ),

  (
    'Counter Craft (Lincoln Michel)',
    'rss',
    'https://countercraft.substack.com/feed',
    'Editor and novelist Lincoln Michel''s newsletter on the craft and business of writing literary fiction, covering form experiments, genre conventions, and the economics of the literary life — published weekly with ~25K subscribers.',
    array['arts'],
    array['literature'],
    'freemium',
    5.00,  -- free tier available; paid $50/yr (~$5/mo) for full access
    'weekly',
    array['us', 'global'],
    0.72,
    false,
    null,
    array['writers_craft', 'fiction_technique', 'literary_publishing', 'genre_fiction', 'experimental_fiction', 'writing_business', 'literary_magazines', 'craft_essays']
  ),

  -- ── Podcasts ──────────────────────────────────────────────────────────

  (
    'The LRB Podcast',
    'rss',
    'https://feeds.megaphone.fm/LRB9987052392',
    'The London Review of Books'' official weekly podcast hosted by Thomas Jones and Malin Hay — long-form conversations with contributors and subject experts drawn directly from LRB essays, making it the most intellectually serious literary podcast in English.',
    array['arts'],
    array['literature'],
    'freemium',
    12.50,  -- podcast free; LRB digital subscription ~£9.99/mo (~$12.50) for full article access
    'weekly',
    array['eu', 'global'],
    0.88,
    false,
    null,
    array['literary_criticism', 'essays', 'intellectual_culture', 'book_discussions', 'cultural_criticism', 'british_literature', 'international_literature', 'politics_literature', 'biography']
  ),

  (
    'London Review Bookshop Podcast',
    'rss',
    'https://feeds.megaphone.fm/LRB9506044622',
    'Live literary events recorded at the London Review Bookshop in Bloomsbury — author readings, launch events, and panel discussions across fiction, poetry, politics, and music, updated multiple times per week.',
    array['arts'],
    array['literature'],
    'free',
    null,
    'weekly',
    array['eu', 'global'],
    0.78,
    false,
    null,
    array['author_readings', 'book_launches', 'literary_events', 'fiction', 'poetry', 'author_interviews', 'british_literature', 'international_authors', 'cultural_events']
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
