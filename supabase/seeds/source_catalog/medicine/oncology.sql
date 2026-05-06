-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — medicine / oncology
-- Curated by source-catalog-curator subagent on 2026-05-06
-- All URLs verified reachable + producing valid feed content
--
-- Verification summary:
--   - Every URL curl-verified (HTTP 200) and WebFetch/content-verified
--     for ≥3 recent items before inclusion.
--   - Last-updated dates confirmed within 90 days for weekly sources,
--     30 days for daily sources.
--   - Paywall tiers reflect actual subscription requirements (May 2026
--     pricing where verifiable).
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  -- ── Government / Institutional ───────────────────────────────────────

  (
    'NCI Cancer Currents Blog',
    'rss',
    'https://www.cancer.gov/publishedcontent/rss/news-events/cancer-currents-blog.rss',
    'Official blog of the National Cancer Institute publishing research updates, trial results, and NCI leadership commentary — the primary US government voice on cancer science.',
    array['medicine'],
    array['oncology'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.92,
    false,
    null,
    array['oncology', 'cancer_research', 'clinical_trials', 'nci_policy', 'cancer_prevention', 'immunotherapy', 'precision_oncology']
  ),

  -- ── Peer-Reviewed Journals ────────────────────────────────────────────

  (
    'Nature Cancer',
    'rss',
    'https://www.nature.com/natcancer.rss',
    'Nature''s dedicated oncology journal publishing high-impact original research on cancer biology, mechanisms, therapeutics, and translational findings across all cancer types.',
    array['medicine', 'sciences'],
    array['oncology'],
    'paid',
    null,  -- institutional/individual access varies; abstracts free
    'weekly',
    array['global'],
    0.96,
    false,
    null,
    array['oncology', 'cancer_biology', 'tumor_immunology', 'cancer_genomics', 'targeted_therapy', 'tumor_microenvironment', 'cancer_mechanisms']
  ),

  (
    'Nature Medicine',
    'rss',
    'https://www.nature.com/nm.rss',
    'Translational medicine journal publishing clinical and preclinical research including oncology breakthroughs, immunotherapy trials, and AI-assisted pathology.',
    array['medicine', 'sciences'],
    array['oncology', 'immunology', 'clinical_trials'],
    'paid',
    null,  -- abstracts free, full text requires institutional access
    'weekly',
    array['global'],
    0.95,
    false,
    null,
    array['oncology', 'immunotherapy', 'biotech_clinical_trials', 'drug_discovery', 'precision_medicine', 'cancer_ai', 'translational_oncology']
  ),

  (
    'Lancet Oncology',
    'rss',
    'https://www.thelancet.com/action/showFeed?jc=lanonc&type=etoc&feed=rss',
    'Leading oncology clinical journal with global readership, publishing phase 3 trial results, practice-changing reviews, and policy commentary on cancer care worldwide.',
    array['medicine'],
    array['oncology'],
    'paid',
    null,  -- subscription required; individual ~$198/yr; institutional varies
    'monthly',
    array['global'],
    0.95,
    false,
    null,
    array['oncology', 'cancer_clinical_trials', 'breast_cancer', 'lung_cancer', 'colorectal_cancer', 'cancer_policy', 'immunotherapy', 'targeted_therapy']
  ),

  (
    'Journal of Clinical Oncology (JCO)',
    'rss',
    'https://ascopubs.org/action/showFeed?type=etoc&feed=rss&jc=jco',
    'ASCO''s flagship peer-reviewed journal; the single most-cited source for clinical oncology trial results, treatment guidelines, and patient outcome research.',
    array['medicine'],
    array['oncology'],
    'paid',
    null,  -- ASCO member access; institutional; abstracts free
    'weekly',
    array['us', 'global'],
    0.95,
    false,
    null,
    array['oncology', 'cancer_clinical_trials', 'chemotherapy', 'immunotherapy', 'cancer_survivorship', 'hematologic_malignancies', 'solid_tumors', 'radiation_oncology']
  ),

  (
    'Annals of Oncology',
    'rss',
    'https://www.annalsofoncology.org/action/showFeed?jc=annonc&type=etoc&feed=rss',
    'ESMO''s official journal; European-weighted but globally respected for phase 3 trial publications, consensus guidelines, and breast/lung/GI cancer research.',
    array['medicine'],
    array['oncology'],
    'paid',
    null,  -- ESMO member or institutional subscription; abstracts free
    'weekly',
    array['eu', 'global'],
    0.93,
    false,
    null,
    array['oncology', 'breast_cancer', 'lung_cancer', 'gi_oncology', 'melanoma', 'esmo_guidelines', 'targeted_therapy', 'immunotherapy', 'cancer_clinical_trials']
  ),

  (
    'Cancer Cell',
    'rss',
    'https://www.cell.com/cancer-cell/current.rss',
    'Cell Press flagship oncology journal focused on cancer biology mechanisms — tumor microenvironment, cancer metabolism, resistance pathways, and translational discoveries.',
    array['medicine', 'sciences'],
    array['oncology'],
    'paid',
    null,  -- subscription or institutional; some open-access articles
    'monthly',
    array['global'],
    0.94,
    false,
    null,
    array['oncology', 'cancer_biology', 'tumor_microenvironment', 'cancer_metabolism', 'drug_resistance', 'cancer_genomics', 'cancer_immunology', 'translational_oncology']
  ),

  -- ── Trade Publications / Journalism ──────────────────────────────────

  (
    'STAT News — Cancer',
    'rss',
    'https://www.statnews.com/topic/cancer/feed/',
    'STAT News cancer desk: breaking coverage of FDA approvals, trial results, biotech deals, and health policy affecting oncology — essential for tracking industry and regulatory moves.',
    array['medicine'],
    array['oncology'],
    'freemium',
    18.00,  -- STAT+ full access ~$18/mo; most cancer news free
    'daily',
    array['us', 'global'],
    0.82,
    false,
    null,
    array['oncology', 'fda_drug_approvals', 'cancer_biotech', 'cancer_clinical_trials', 'oncology_policy', 'immunotherapy', 'car_t', 'cancer_funding']
  ),

  (
    'BioPharma Dive',
    'rss',
    'https://www.biopharmadive.com/feeds/news/',
    'Daily pharma and biotech industry news covering oncology drug development, FDA decisions, clinical readouts, and M&A activity across the cancer therapy landscape.',
    array['medicine', 'finance'],
    array['oncology', 'drug_development'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.72,
    false,
    null,
    array['oncology', 'cancer_drug_development', 'fda_drug_approvals', 'cancer_biotech', 'oncology_pipeline', 'pharma_deals', 'cancer_clinical_readouts']
  ),

  (
    'Endpoints News',
    'rss',
    'https://endpoints.news/feed/',
    'Industry-insider biotech and pharma newsroom covering oncology clinical data, regulatory filings, and biopharma deals with fast-turnaround expert analysis.',
    array['medicine', 'finance'],
    array['oncology', 'drug_development'],
    'freemium',
    null,  -- some content free; Endpoints+ premium tier available
    'daily',
    array['us', 'global'],
    0.74,
    false,
    null,
    array['oncology', 'cancer_biotech', 'fda_drug_approvals', 'oncology_pipeline', 'cancer_clinical_readouts', 'biopharma_deals', 'precision_oncology']
  ),

  -- ── Specialty Databases / APIs ────────────────────────────────────────

  (
    'ClinicalTrials.gov API',
    'custom_api',
    'https://clinicaltrials.gov/api/v2/studies?query.cond=cancer&pageSize=25',
    'US NIH registry of all FDA-regulated clinical trials; the authoritative real-time source for active oncology trial enrollment, phase, eligibility, and outcome data.',
    array['medicine'],
    array['oncology', 'clinical_trials'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.97,
    false,
    null,
    array['oncology', 'cancer_clinical_trials', 'trial_enrollment', 'cancer_research', 'clinical_trial_results', 'oncology_eligibility', 'nct_registry']
  ),

  -- ── Podcasts ──────────────────────────────────────────────────────────

  (
    'Journal of Clinical Oncology (JCO) Podcast',
    'rss',
    'https://jcopodcast.libsyn.com/rss',
    'ASCO''s official JCO podcast with oncologist hosts discussing published trial findings, translating peer-reviewed JCO research for practicing clinicians.',
    array['medicine'],
    array['oncology'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.88,
    false,
    null,
    array['oncology', 'cancer_clinical_trials', 'chemotherapy', 'immunotherapy', 'solid_tumors', 'hematologic_malignancies', 'oncology_clinical_practice']
  ),

  (
    'ASCO Daily News Podcast',
    'rss',
    'https://ascodailynews.libsyn.com/rss',
    'ASCO''s news podcast hosted by Dr. Monty Pal covering conference highlights, practice-changing trial results, and expert commentary on advances across oncology subspecialties.',
    array['medicine'],
    array['oncology'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.87,
    false,
    null,
    array['oncology', 'asco_conference', 'immunotherapy', 'targeted_therapy', 'lung_cancer', 'breast_cancer', 'genitourinary_oncology', 'oncology_clinical_practice']
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
