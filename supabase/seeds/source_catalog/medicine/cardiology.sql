-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — medicine / cardiology
-- Curated by source-catalog-curator subagent on 2026-05-15
-- All URLs verified reachable + producing valid feed content
--
-- Verification summary:
--   - Every URL WebFetch-verified (HTTP 200) and content-verified
--     for ≥3 recent items before inclusion.
--   - Last-updated dates confirmed within 30 days for daily sources,
--     90 days for weekly/conference-season sources.
--   - Paywall tiers reflect actual subscription requirements (May 2026).
--
-- Rejected candidates (URL failures or content failures):
--   - https://www.jacc.org/rss/journal/jacc — HTTP 403 (publisher blocks scrapers)
--   - https://www.ahajournals.org/action/showFeed?type=axatoc&feed=rss&jc=circ — HTTP 403
--   - https://www.nejm.org/action/showFeed?jc=nejm&type=etoc&feed=rss — HTTP 403
--   - https://www.escardio.org/rss/press-releases — HTTP 404; ESC has no discoverable public RSS
--   - https://www.escardio.org/rss/news — HTTP 404
--   - https://www.thelancet.com/rssfeed/lancet_online.xml — HTTP 403
--   - https://heart.bmj.com/rss/current.xml — HTTP 403 (BMJ blocks scrapers)
--   - https://www.medscape.com/rss/cardiology — HTTP 402 Payment Required
--   - https://www.cardiologyadvisor.com/feed/ — HTTP 403
--   - https://www.cardio vascularbusiness.com/feed — HTTP 403
--   - https://newsroom.heart.org/cats/scientific_statements_guidelines.xml — Only 4 items,
--       all in Spanish; last English item >90 days — excluded as primary source
--   - https://clinicaltrials.gov RSS attempts — all returned 400/500 errors
--   - https://www.nhlbi.nih.gov/feeds/nhlbi-news — HTTP 404
--   - STAT News (statnews.com/feed/) — confirmed working but no cardiology-specific
--       feed exists; general feed covers pharma/policy/ID, not cardiology
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  -- ── Top Peer-Reviewed Journals (via ScienceDirect RSS — verified 2026-05-15) ─

  (
    'JACC: Journal of the American College of Cardiology',
    'rss',
    'https://rss.sciencedirect.com/publication/science/07351097',
    'The flagship journal of the American College of Cardiology, publishing landmark clinical trials, guidelines, and original research across all cardiovascular subspecialties — one of the highest-impact cardiology journals globally (ISSN 0735-1097).',
    array['medicine'],
    array['cardiology'],
    'freemium',
    null,
    'weekly',
    array['global'],
    0.97,
    false,
    null,
    array['coronary_artery_disease', 'heart_failure', 'interventional_cardiology', 'cardiac_imaging', 'electrophysiology', 'lipidology', 'cardiovascular_risk', 'clinical_trials_cardiology', 'hypertension', 'atrial_fibrillation']
  ),

  (
    'American Heart Journal',
    'rss',
    'https://rss.sciencedirect.com/publication/science/00028703',
    'One of the oldest peer-reviewed cardiovascular journals, publishing original clinical research, systematic reviews, and trial results with a focus on practical cardiovascular medicine and outcomes (ISSN 0002-8703, Elsevier).',
    array['medicine'],
    array['cardiology'],
    'freemium',
    null,
    'daily',
    array['global'],
    0.94,
    false,
    null,
    array['myocardial_infarction', 'atrial_fibrillation', 'heart_failure', 'coronary_artery_disease', 'cardiovascular_outcomes', 'clinical_trials_cardiology', 'cardiac_imaging']
  ),

  (
    'Nature Reviews Cardiology',
    'rss',
    'https://www.nature.com/nrcardio.rss',
    'Monthly Nature Publishing Group journal covering commissioned reviews, news, and commentary on cardiovascular biology and clinical cardiology — the highest-impact review journal in the field, essential for understanding where the science is heading.',
    array['medicine', 'sciences'],
    array['cardiology'],
    'paid',
    null,
    'monthly',
    array['global'],
    0.96,
    false,
    null,
    array['atherosclerosis', 'cardiac_biology', 'heart_failure_mechanisms', 'cardiovascular_genetics', 'lipidology', 'cardiac_imaging', 'coronary_artery_disease', 'cardiovascular_pharmacology', 'interventional_cardiology']
  ),

  (
    'International Journal of Cardiology',
    'rss',
    'https://rss.sciencedirect.com/publication/science/01675273',
    'High-volume peer-reviewed journal (Elsevier) covering a broad spectrum of cardiovascular research including arrhythmia, heart failure, cardiomyopathy, and device therapy — strong for keeping pace with volume of global clinical research (ISSN 0167-5273).',
    array['medicine'],
    array['cardiology'],
    'freemium',
    null,
    'daily',
    array['global'],
    0.88,
    false,
    null,
    array['arrhythmia', 'heart_failure', 'cardiomyopathy', 'cardiac_devices', 'myocardial_infarction', 'cardiac_imaging', 'hypertension', 'coronary_artery_disease', 'atrial_fibrillation']
  ),

  (
    'Heart Rhythm (Heart Rhythm Society / Elsevier)',
    'rss',
    'https://rss.sciencedirect.com/publication/science/15475271',
    'The official journal of the Heart Rhythm Society, covering cardiac electrophysiology, catheter ablation, implantable devices, genetic arrhythmia syndromes, and sudden cardiac death — the primary subspecialty journal for electrophysiology (ISSN 1547-5271).',
    array['medicine'],
    array['cardiology'],
    'freemium',
    null,
    'weekly',
    array['global'],
    0.93,
    false,
    null,
    array['electrophysiology', 'atrial_fibrillation', 'catheter_ablation', 'implantable_devices', 'arrhythmia', 'sudden_cardiac_death', 'genetic_arrhythmia', 'cardiac_pacing']
  ),

  -- ── Cardiology Society / Institutional News ──────────────────────────

  (
    'ACC Latest in Cardiology',
    'rss',
    'https://www.acc.org/Feed/LatestCardiology?topicID=8d7f3960-0beb-4a23-b87d-661262d0bb4f',
    'The American College of Cardiology''s curated clinical news feed: journal scans, guideline summaries, trial digests, and expert commentary covering the full spectrum of cardiology practice — written for practicing cardiologists.',
    array['medicine'],
    array['cardiology'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.90,
    false,
    null,
    array['heart_failure', 'cardiovascular_risk', 'interventional_cardiology', 'cardiac_imaging', 'lipidology', 'hypertension', 'atrial_fibrillation', 'acc_guidelines', 'cardiometabolic']
  ),

  (
    'AHA Heart News (American Heart Association)',
    'rss',
    'https://newsroom.heart.org/cats/heart_news.xml',
    'The American Heart Association''s peer-reviewed science newsroom feed, publishing research findings, AHA grant announcements, and cardiovascular health studies — primary AHA outlet for scientific results aimed at both clinicians and health journalists.',
    array['medicine'],
    array['cardiology'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.91,
    false,
    null,
    array['heart_disease', 'stroke', 'cardiovascular_risk', 'aha_research', 'heart_failure', 'women_heart_health', 'hypertension', 'cardiovascular_epidemiology']
  ),

  (
    'AHA Scientific Conferences & Meetings',
    'rss',
    'https://newsroom.heart.org/cats/scientific_conferences_meetings.xml',
    'Official American Heart Association feed for late-breaking trial results and research abstracts from AHA''s major conferences (AHA Scientific Sessions, EPI|Lifestyle, BCVS, QCOR) — the authoritative source for AHA conference science as it breaks.',
    array['medicine'],
    array['cardiology'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.92,
    false,
    null,
    array['clinical_trials_cardiology', 'late_breaking_trials', 'cardiovascular_epidemiology', 'aha_scientific_sessions', 'heart_failure', 'hypertension', 'cardiovascular_risk', 'diabetes_cardiovascular']
  ),

  (
    'AHA Newsroom (General)',
    'rss',
    'https://newsroom.heart.org/rss.xml',
    'Broad American Heart Association newsroom feed covering press releases on cardiovascular science, advocacy, and community health programs — useful for monitoring AHA''s full public communications including CPR initiatives and Go Red campaigns.',
    array['medicine'],
    array['cardiology'],
    'free',
    null,
    'weekly',
    array['us'],
    0.82,
    false,
    null,
    array['cardiovascular_public_health', 'heart_disease_prevention', 'aha_advocacy', 'stroke_prevention', 'cpr_training', 'women_heart_health']
  ),

  -- ── Specialty Clinical/Interventional Cardiology Trade ───────────────

  (
    'TCTMD (The Cardiology Magazine)',
    'rss',
    'https://www.tctmd.com/feed',
    'Leading interventional cardiology publication produced by the Cardiovascular Research Foundation, covering clinical trial results, procedure innovations, device approvals, and conference news from major cardiology meetings (ACC, TCT, ESC, AHA) — 3-5 articles daily.',
    array['medicine'],
    array['cardiology'],
    'free',
    null,
    'daily',
    array['global'],
    0.89,
    false,
    null,
    array['interventional_cardiology', 'percutaneous_coronary_intervention', 'structural_heart_disease', 'tavr', 'clinical_trials_cardiology', 'coronary_artery_disease', 'device_therapy', 'heart_failure', 'late_breaking_trials']
  ),

  (
    'Healio Cardiology',
    'rss',
    'https://www.healio.com/rss/cardiology',
    'Healio''s cardiology vertical delivers clinical research summaries, trial results, and therapeutic updates targeted at practicing cardiologists — high-frequency coverage of cardiovascular studies from major journals and conferences.',
    array['medicine'],
    array['cardiology'],
    'freemium',
    null,
    'daily',
    array['us', 'global'],
    0.78,
    false,
    null,
    array['heart_failure', 'atrial_fibrillation', 'lipidology', 'cardiovascular_risk', 'coronary_artery_disease', 'cardiometabolic', 'hypertension', 'interventional_cardiology']
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
