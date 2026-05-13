-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — lifestyle / longevity
-- Curated by source-catalog-curator subagent on 2026-05-13
-- All URLs verified reachable + producing valid feed content
--
-- Verification summary:
--   - Every URL curl-verified (HTTP 200) and WebFetch/content-verified
--     for ≥3 recent items before inclusion.
--   - Last-updated dates confirmed within 90 days for weekly sources,
--     30 days for daily sources.
--   - Paywall tiers reflect actual subscription requirements (May 2026
--     pricing where verifiable).
--   - Sources rejected on supplement-shilling grounds are documented
--     in the curator report (not in this file).
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  -- ── Government / Institutional ───────────────────────────────────────

  (
    'NIH News in Health',
    'rss',
    'https://newsinhealth.nih.gov/rss',
    'NIH''s consumer-health monthly bulletin translating peer-reviewed research into accessible articles on aging biology, prevention, chronic disease, and clinical advances — reviewed by NIH medical experts.',
    array['lifestyle', 'medicine'],
    array['longevity', 'preventive_health'],
    'free',
    null,
    'monthly',
    array['us', 'global'],
    0.88,
    false,
    null,
    array['longevity', 'aging_biology', 'preventive_health', 'disease_prevention', 'alzheimers', 'cardiovascular_health', 'healthy_aging', 'nih_research']
  ),

  (
    'Buck Institute for Research on Aging — News',
    'rss',
    'https://www.buckinstitute.org/feed/',
    'Research blog of the world''s largest independent aging-focused research institute, covering lab discoveries on senescent cells, mitochondrial aging, neurodegeneration, and lifespan biology.',
    array['lifestyle', 'sciences'],
    array['longevity'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.88,
    false,
    null,
    array['longevity', 'aging_biology', 'senescent_cells', 'healthspan', 'neurodegeneration', 'mitochondrial_aging', 'lifespan_research', 'geroscience']
  ),

  -- ── Peer-Reviewed Journals ────────────────────────────────────────────

  (
    'npj Aging',
    'rss',
    'https://www.nature.com/npjamd.rss',
    'Fully open-access Nature Publishing Group journal covering the biology of aging, clinical interventions affecting the aging process, and societal implications of longevity — all articles freely available.',
    array['lifestyle', 'sciences', 'medicine'],
    array['longevity'],
    'free',
    null,
    'weekly',
    array['global'],
    0.92,
    false,
    null,
    array['longevity', 'aging_biology', 'healthspan', 'lifespan_research', 'geroscience', 'aging_interventions', 'cellular_senescence', 'aging_genomics']
  ),

  (
    'Aging Cell',
    'rss',
    'https://onlinelibrary.wiley.com/feed/14749726/most-recent',
    'Wiley''s flagship aging-biology journal publishing research on molecular mechanisms of aging — mitochondrial dysfunction, epigenetic clocks, senescence pathways, and longevity interventions.',
    array['lifestyle', 'sciences', 'medicine'],
    array['longevity'],
    'paid',
    null,  -- institutional or individual Wiley subscription; abstracts free
    'monthly',
    array['global'],
    0.93,
    false,
    null,
    array['longevity', 'aging_biology', 'epigenetic_clocks', 'cellular_senescence', 'mitochondrial_aging', 'longevity_interventions', 'geroscience', 'molecular_aging']
  ),

  (
    'Cell Metabolism',
    'rss',
    'https://www.cell.com/cell-metabolism/current.rss',
    'Cell Press journal publishing high-impact research on metabolic pathways relevant to aging and longevity — caloric restriction, mTOR, NAD metabolism, circadian biology, and insulin signaling.',
    array['lifestyle', 'sciences', 'medicine'],
    array['longevity'],
    'paid',
    null,  -- subscription or institutional access; select open-access articles
    'monthly',
    array['global'],
    0.94,
    false,
    null,
    array['longevity', 'aging_biology', 'metabolic_health', 'caloric_restriction', 'mtor_pathway', 'nad_metabolism', 'circadian_biology', 'insulin_signaling', 'lifespan_research']
  ),

  -- ── Specialty Newsletters ─────────────────────────────────────────────

  (
    'Ground Truths by Eric Topol',
    'rss',
    'https://erictopol.substack.com/feed',
    'Weekly Substack newsletter by cardiologist and genomics researcher Dr. Eric Topol (Scripps Research) covering AI in medicine, longevity science, and evidence-based critiques of health claims — rigorous and free.',
    array['lifestyle', 'medicine', 'tech'],
    array['longevity', 'preventive_health'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.88,
    false,
    null,
    array['longevity', 'preventive_health', 'ai_in_medicine', 'precision_medicine', 'evidence_based_medicine', 'cardiovascular_health', 'aging_research', 'medical_ai']
  ),

  -- ── Physician-Led Websites / Blogs ────────────────────────────────────

  (
    'Peter Attia — Articles & Essays',
    'rss',
    'https://peterattiamd.com/feed/',
    'Evidence-based longevity writing from Dr. Peter Attia (Stanford/Hopkins/NIH-trained physician) covering cardiovascular risk, metabolic health, cancer screening, exercise science, and the science of living longer — some articles free, full archive requires membership.',
    array['lifestyle', 'medicine'],
    array['longevity', 'preventive_health'],
    'freemium',
    15.00,  -- "Early" membership ~$15/mo for full access; substantial free content available
    'weekly',
    array['us', 'global'],
    0.90,
    false,
    null,
    array['longevity', 'preventive_health', 'cardiovascular_health', 'metabolic_health', 'cancer_screening', 'exercise_science', 'sleep_science', 'lipids', 'insulin_resistance']
  ),

  -- ── Podcasts ──────────────────────────────────────────────────────────

  (
    'The Drive with Peter Attia',
    'rss',
    'https://rss.libsyn.com/shows/121729/destinations/713489.xml',
    'Weekly long-form podcast from physician-researcher Dr. Peter Attia featuring in-depth interviews with longevity scientists, cardiologists, and neuroscientists — episodes regularly exceed 2 hours with primary-source citations.',
    array['lifestyle', 'medicine'],
    array['longevity', 'preventive_health'],
    'freemium',
    15.00,  -- full podcast archive behind "Early" membership; recent episodes free
    'weekly',
    array['us', 'global'],
    0.90,
    false,
    null,
    array['longevity', 'preventive_health', 'cardiovascular_health', 'cancer_screening', 'metabolic_health', 'exercise_science', 'sleep', 'cognitive_health', 'healthspan']
  ),

  (
    'Huberman Lab',
    'rss',
    'https://feeds.megaphone.fm/hubermanlab',
    'Weekly science-based podcast by Stanford neuroscientist Dr. Andrew Huberman covering neuroscience of performance, sleep, stress, and longevity-adjacent physiology with academic citations — entirely free.',
    array['lifestyle', 'sciences'],
    array['longevity', 'preventive_health'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.78,
    false,
    null,
    array['longevity', 'sleep_science', 'stress_physiology', 'neuroplasticity', 'exercise_science', 'circadian_biology', 'testosterone', 'mental_health', 'preventive_health']
  ),

  (
    'FoundMyFitness with Rhonda Patrick',
    'rss',
    'https://podcast.foundmyfitness.com/rss.xml',
    'Podcast by Dr. Rhonda Patrick (PhD biochemistry, Salk Institute) featuring long-form interviews with leading aging researchers on topics including heat stress, micronutrients, epigenetics, and longevity biomarkers.',
    array['lifestyle', 'sciences'],
    array['longevity'],
    'freemium',
    null,  -- podcast episodes free; FoundMyFitness premium membership offers additional content
    'weekly',
    array['us', 'global'],
    0.82,
    false,
    null,
    array['longevity', 'aging_biology', 'epigenetics', 'heat_stress', 'exercise_science', 'micronutrients', 'nad_metabolism', 'sleep_science', 'healthspan']
  ),

  (
    'ZOE Science and Nutrition',
    'rss',
    'https://feeds.megaphone.fm/ZOELIMITED9301524082',
    'Weekly podcast from ZOE (Tim Spector, King''s College London) exploring gut microbiome research, nutrition science, and metabolic health with academic rigor — each episode cites peer-reviewed evidence.',
    array['lifestyle', 'medicine'],
    array['longevity', 'preventive_health'],
    'free',
    null,
    'weekly',
    array['eu', 'us', 'global'],
    0.80,
    false,
    null,
    array['longevity', 'gut_microbiome', 'nutrition_science', 'metabolic_health', 'preventive_health', 'sleep_science', 'dietary_patterns', 'personalized_nutrition']
  ),

  -- ── Trade / Science Journalism ────────────────────────────────────────

  (
    'STAT News — Aging',
    'rss',
    'https://www.statnews.com/topic/aging/feed/',
    'STAT News dedicated aging beat: daily journalism covering longevity science, FDA decisions on aging-related drugs, Medicare policy, geroscience trials, and the biotech companies targeting aging — updated same-day.',
    array['lifestyle', 'medicine', 'finance'],
    array['longevity', 'preventive_health'],
    'freemium',
    18.00,  -- STAT+ full access ~$18/mo; aging news largely free
    'daily',
    array['us', 'global'],
    0.82,
    false,
    null,
    array['longevity', 'aging_biology', 'fda_aging_drugs', 'geroscience', 'aging_biotech', 'medicare_policy', 'senolytic_drugs', 'rapamycin', 'longevity_trials']
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
