-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — sciences / climate
-- Curated by source-catalog-curator subagent on 2026-05-12
-- All URLs verified reachable + producing valid feed content
--
-- Verification summary:
--   - Every URL curl-verified (HTTP 200) and WebFetch/content-verified
--     for ≥3 recent items before inclusion, except where noted.
--   - Lancet Planetary Health and GRL (Wiley): curl returns HTTP 200
--     with a browser User-Agent; WebFetch is blocked by Cloudflare CDN
--     protection on those domains. Feed structure confirmed via raw
--     curl content dump (GRL) and prior-session verification (LPH).
--   - Last-updated dates confirmed within 30 days for daily sources,
--     90 days for weekly/monthly sources.
--   - Paywall tiers reflect actual subscription requirements (May 2026).
--
-- Rejected candidates (see curator report for full reasoning):
--   NOAA Climate.gov RSS — archived June 25 2025; current URL structure
--     has no RSS endpoint (404 on all paths tried).
--   NASA Climate (climate.nasa.gov) — redirects to science.nasa.gov/
--     climate-change/ which has no RSS feed (404).
--   WMO RSS — wmo.int/rss/rss.xml chain resolves to 404.
--   NSIDC RSS — no RSS feed found at any path tried (404).
--   Nature Sustainability RSS — redirects to IDP auth gate (paywall
--     blocks RSS entirely; no usable feed URL).
--   Heatmap News RSS — /feed and /rss both return 404.
--   E&E News RSS — feed valid XML structure but 0 items (empty shell).
--   Bloomberg Green RSS — /feeds/green returns 404.
--   A Matter of Degrees (Megaphone/acast paths) — 404; resolved via
--     Apple Podcasts lookup to libsyn URL.
--   r/climate (.rss) — 403 (Reddit blocks unauthenticated RSS/curl).
--   Copernicus.eu root — redirects; C3S subdomain used instead.
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  -- ── Government / Intergovernmental ──────────────────────────────────

  (
    'IPCC',
    'rss',
    'https://www.ipcc.ch/feed/',
    'Official news feed of the Intergovernmental Panel on Climate Change — press releases, assessment report milestones, and expert review announcements that represent the global scientific consensus on climate.',
    array['sciences'],
    array['climate'],
    'free',
    null,
    'weekly',
    array['global'],
    0.97,
    false,
    null,
    array['climate_science', 'ipcc_reports', 'global_warming', 'climate_policy', 'sea_level_rise', 'climate_adaptation', 'climate_mitigation', 'carbon_budget']
  ),

  (
    'Copernicus Climate Change Service (C3S)',
    'rss',
    'https://climate.copernicus.eu/rss.xml',
    'ECMWF-operated EU climate monitoring service; publishes authoritative monthly global temperature bulletins, reanalysis data releases, and climate indicator updates used by policymakers worldwide.',
    array['sciences'],
    array['climate'],
    'free',
    null,
    'weekly',
    array['eu', 'global'],
    0.94,
    false,
    null,
    array['climate_data', 'global_temperature', 'climate_reanalysis', 'era5', 'sea_surface_temperature', 'arctic_sea_ice', 'carbon_cycle', 'climate_indicators']
  ),

  -- ── Peer-Reviewed Journals ────────────────────────────────────────────

  (
    'Nature Climate Change',
    'rss',
    'https://www.nature.com/nclimate.rss',
    'Nature''s flagship climate journal publishing original research on physical climate science, climate impacts, and mitigation pathways — the highest-impact dedicated climate journal by citation.',
    array['sciences'],
    array['climate'],
    'paid',
    null,  -- abstracts free; full text requires institutional or individual subscription (~$199/yr)
    'weekly',
    array['global'],
    0.97,
    false,
    null,
    array['climate_science', 'global_warming', 'carbon_cycle', 'climate_tipping_points', 'extreme_weather', 'sea_level_rise', 'climate_modeling', 'climate_attribution', 'climate_mitigation']
  ),

  (
    'Lancet Planetary Health',
    'rss',
    'https://www.thelancet.com/action/showFeed?jc=lanplh&type=etoc&feed=rss',
    'Lancet''s open-access journal at the intersection of climate, environmental degradation, and human health — publishing research on heat mortality, air pollution, food systems, and climate-health co-benefits.',
    array['sciences', 'medicine'],
    array['climate', 'public_health'],
    'free',
    null,  -- fully open-access; no subscription required
    'monthly',
    array['global'],
    0.93,
    false,
    null,
    array['climate_health', 'heat_stress', 'air_quality', 'climate_adaptation', 'food_security', 'vector_borne_disease', 'climate_mortality', 'planetary_health']
  ),

  (
    'Geophysical Research Letters',
    'rss',
    'https://agupubs.onlinelibrary.wiley.com/feed/19448007/most-recent',
    'AGU''s rapid-publication journal for high-impact geophysical findings; covers sea ice loss, ocean heat content, glacier mass balance, and atmospheric chemistry with turnaround of weeks from submission.',
    array['sciences'],
    array['climate', 'geosciences'],
    'freemium',
    null,  -- many articles open-access via AGU open-access mandate; full journal requires subscription
    'daily',
    array['global'],
    0.93,
    false,
    null,
    array['climate_science', 'sea_ice', 'ocean_heat', 'glacier_retreat', 'atmospheric_co2', 'climate_modeling', 'extreme_weather', 'climate_attribution', 'arctic_amplification']
  ),

  -- ── Trade Journalism ──────────────────────────────────────────────────

  (
    'Carbon Brief',
    'rss',
    'https://www.carbonbrief.org/feed/',
    'UK-based specialist climate science and policy publisher known for meticulous data journalism, weekly DeBriefed digest, and original analysis of IPCC reports, emissions data, and energy transition trends.',
    array['sciences'],
    array['climate'],
    'free',
    null,
    'daily',
    array['global', 'eu'],
    0.88,
    false,
    null,
    array['climate_science', 'climate_policy', 'emissions_data', 'energy_transition', 'renewable_energy', 'carbon_budget', 'climate_attribution', 'climate_models', 'net_zero']
  ),

  (
    'Inside Climate News',
    'rss',
    'https://insideclimatenews.org/feed/',
    'Pulitzer Prize-winning nonprofit newsroom dedicated entirely to climate and energy journalism; covers US climate politics, fossil fuel industry, and local climate impacts with investigative depth.',
    array['sciences'],
    array['climate'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.82,
    false,
    null,
    array['climate_policy', 'fossil_fuels', 'climate_politics', 'extreme_weather', 'climate_litigation', 'clean_energy', 'climate_impacts', 'climate_justice']
  ),

  -- ── Specialty Newsletters ─────────────────────────────────────────────

  (
    'Volts — David Roberts',
    'rss',
    'https://www.volts.wtf/feed',
    'David Roberts'' 93K-subscriber Substack covering clean energy policy, climate legislation, and the US energy transition with rigorous long-form analysis — ranked #2 in Climate & Environment on Substack.',
    array['sciences'],
    array['climate'],
    'freemium',
    8.00,  -- free tier available; Substack paid subscription ~$8/mo for full archive
    'weekly',
    array['us'],
    0.80,
    false,
    null,
    array['climate_policy', 'clean_energy', 'energy_transition', 'climate_legislation', 'power_sector', 'solar_wind', 'grid_modernization', 'inflation_reduction_act', 'climate_politics']
  ),

  (
    'By the Numbers — Hannah Ritchie',
    'rss',
    'https://hannahritchie.substack.com/feed',
    'Sustainability researcher Hannah Ritchie (Our World in Data) uses data and evidence to examine energy transitions, food systems, and climate metrics — a rigorous counterweight to climate doom narratives.',
    array['sciences'],
    array['climate'],
    'freemium',
    8.00,  -- free tier available; paid ~$8/mo
    'weekly',
    array['global'],
    0.79,
    false,
    null,
    array['climate_data', 'energy_transition', 'food_systems', 'climate_solutions', 'renewable_energy', 'deforestation', 'carbon_emissions', 'climate_progress']
  ),

  -- ── Podcasts ──────────────────────────────────────────────────────────

  (
    'A Matter of Degrees',
    'rss',
    'https://rss.libsyn.com/shows/614850/destinations/5361860.xml',
    'Weekly climate podcast hosted by Dr. Leah Stokes and Dr. Katharine Wilkinson (UC Santa Barbara / All We Can Save Project) examining climate science, justice, and solutions for general and expert audiences.',
    array['sciences'],
    array['climate'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.78,
    false,
    null,
    array['climate_science', 'climate_solutions', 'climate_justice', 'clean_energy', 'climate_policy', 'climate_communication', 'climate_action']
  ),

  (
    'Catalyst with Shayle Kann',
    'rss',
    'https://feeds.megaphone.fm/catalyst',
    'Investor Shayle Kann interviews founders, investors, and researchers across hard climate tech — carbon removal, advanced geothermal, green hydrogen, fusion, and industrial decarbonization.',
    array['sciences'],
    array['climate'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.76,
    false,
    null,
    array['climate_tech', 'clean_energy', 'carbon_removal', 'green_hydrogen', 'geothermal', 'industrial_decarbonization', 'climate_investing', 'cleantech_startups', 'fusion_energy']
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
