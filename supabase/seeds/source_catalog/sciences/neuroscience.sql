-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — sciences / neuroscience
-- Curated by source-catalog-curator subagent on 2026-05-15
-- All URLs verified reachable + producing valid feed content
--
-- Verification summary:
--   Every URL WebFetch-verified for HTTP 200 and ≥3 recent feed items
--   before inclusion. Verification performed 2026-05-15.
--
-- Rejections:
--   https://www.cell.com/neuron/rss/current.xml          — HTTP 403 (bot-blocked)
--   https://www.jneurosci.org/rss/current.xml            — HTTP 403 (bot-blocked)
--   https://www.cell.com/trends/neurosciences/rss/current.xml — HTTP 403 (bot-blocked)
--   https://www.cell.com/current-biology/rss/current.xml — HTTP 403 (bot-blocked)
--   https://biorxiv.org/rss/neuroscience                 — HTTP 403; use connect.biorxiv.org instead
--   https://www.thelancet.com/rssfeed/laneur_current.xml — HTTP 403 (bot-blocked)
--   https://www.pnas.org/rss/Neuroscience.xml            — HTTP 403 (bot-blocked)
--   https://elifesciences.org/rss/neuroscience.xml       — HTTP 404 (feed removed/moved)
--   https://www.nimh.nih.gov/news/science-news/rss       — HTTP 404 (broken URL)
--   https://www.ninds.nih.gov/index.php/rss-feeds        — HTTP 403
--   https://www.brainfacts.org/feed                      — HTTP 404 (site redesigned)
--   https://www.brainfacts.org/rss                       — HTTP 404
--   https://www.sfn.org/news-and-calendar/news           — No RSS feed available
--   https://neuronline.sfn.org/rss/sfn                   — HTTP 404
--   https://www.scientificamerican.com/mind-and-brain/feed/ — HTTP 404
--   https://www.scientificamerican.com/feed/category/mind/ — HTTP 404
--   https://feeds.feedburner.com/sciamMind               — HTTP 404
--   https://www.psychologicalscience.org/publications/psychological_science/feed — HTTP 403
--   https://www.apa.org/news/press/rss                   — HTTP 404
--   https://medicalxpress.com/rss-feed/neuroscience-news/ — HTTP 404
--   https://www.statnews.com/feed/?category=brain        — Feed returns 21 items but
--                                                          is NOT neuroscience-filtered;
--                                                          covers general health news
--   https://www.ncbi.nlm.nih.gov/feed/rss.cgi?ChanKey=neuroscience — URL valid but
--                                                          returns dbGaP genomics releases,
--                                                          not neuroscience-specific content
--   https://www.nature.com/subjects/neuroscience.rss     — Redirects to auth wall (login required)
--   https://www.nature.com/articles?type=news&subject=neuroscience&format=rss — Auth redirect
--   https://academic.oup.com/rss/site_5474/3112.xml      — HTTP 404
--   https://news.mit.edu/topic/neuroscience/rss          — HTTP 404 (wrong path)
--   https://feeds.feedburner.com/jneurosci               — HTTP 404
--   https://www.psychiatry.org/news-room/apa-blogs/rss   — HTTP 403
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  (
    'Nature Neuroscience',
    'rss',
    'https://www.nature.com/neuro.rss',
    'Flagship peer-reviewed journal from Nature Publishing Group covering the full breadth of neuroscience research, from molecular and cellular mechanisms to systems and cognitive neuroscience; publishes 8+ new research articles per week across areas including learning, memory, perception, and neurological disease.',
    array['sciences', 'medicine'],
    array['neuroscience'],
    'freemium',
    null,
    'weekly',
    array['global'],
    0.97,
    false,
    null,
    array['neuroscience_research', 'cognitive_neuroscience', 'cellular_neuroscience', 'synaptic_plasticity', 'neurological_disease', 'brain_aging', 'sensory_processing', 'neural_circuits']
  ),

  (
    'Nature Reviews Neuroscience',
    'rss',
    'https://www.nature.com/nrn.rss',
    'High-impact review journal from Nature Publishing Group that synthesizes recent progress in brain and nervous system research "from molecules to mind"; each issue provides authoritative deep-dives into rapidly evolving fields such as neuroimmunology, electrophysiology, and cognitive neuroscience, making it the premier resource for researchers needing comprehensive overviews.',
    array['sciences'],
    array['neuroscience'],
    'freemium',
    null,
    'weekly',
    array['global'],
    0.97,
    false,
    null,
    array['neuroscience_reviews', 'cognitive_neuroscience', 'neuroimmunology', 'electrophysiology', 'social_neuroscience', 'brain_development', 'neuroanatomy', 'auditory_neuroscience']
  ),

  (
    'eNeuro (Society for Neuroscience)',
    'rss',
    'https://www.eneuro.org/rss/current.xml',
    'Open-access journal published by the Society for Neuroscience (SfN) covering the full spectrum of neuroscience with rapid publication; freely available peer-reviewed research spanning microscopy methods, epilepsy, retinal function, cortical dynamics, and neuronal physiology, with a strong emphasis on reproducibility and methodological rigor.',
    array['sciences'],
    array['neuroscience'],
    'free',
    null,
    'weekly',
    array['global'],
    0.92,
    false,
    null,
    array['neuroscience_research', 'cortical_dynamics', 'epilepsy', 'retinal_neuroscience', 'neuronal_physiology', 'neuroscience_methods', 'open_access_science']
  ),

  (
    'bioRxiv Neuroscience Preprints',
    'rss',
    'https://connect.biorxiv.org/biorxiv_xml.php?subject=neuroscience',
    'Official RSS feed for the neuroscience subject collection on bioRxiv, Cold Spring Harbor Laboratory''s preprint server; surfaces 30+ new preprints per day covering visual cortex, speech comprehension, autism biomarkers, cerebellar function, and the full frontier of brain research before peer-reviewed publication, enabling real-time tracking of emerging science.',
    array['sciences'],
    array['neuroscience'],
    'free',
    null,
    'daily',
    array['global'],
    0.82,
    false,
    null,
    array['neuroscience_preprints', 'visual_cortex', 'speech_comprehension', 'autism_research', 'cerebellar_function', 'emerging_neuroscience', 'brain_research_frontier']
  ),

  (
    'Frontiers in Neuroscience',
    'rss',
    'https://www.frontiersin.org/journals/neuroscience/rss',
    'Open-access journal covering translational and basic neuroscience research across neurodegenerative diseases, brain imaging, stroke, epilepsy, psychiatric disorders, and neural engineering; publishes 20+ articles per week with a particular strength in Parkinson''s, Alzheimer''s, and frontotemporal dementia research from international laboratory and clinical settings.',
    array['sciences', 'medicine'],
    array['neuroscience'],
    'free',
    null,
    'daily',
    array['global'],
    0.78,
    false,
    null,
    array['neurodegenerative_disease', 'brain_imaging', 'stroke', 'epilepsy', 'psychiatric_disorders', 'neural_engineering', 'parkinsons', 'alzheimers', 'translational_neuroscience']
  ),

  (
    'PLOS Biology',
    'rss',
    'https://journals.plos.org/plosbiology/feed/atom',
    'Open-access flagship journal from the Public Library of Science publishing rigorous primary research across biological sciences, with consistent neuroscience coverage including cortical neuron morphology, ultrasound neuromodulation, premotor cortex function, and comparative neuroanatomy; peer-reviewed research is freely available globally with 25+ articles per issue.',
    array['sciences'],
    array['neuroscience'],
    'free',
    null,
    'weekly',
    array['global'],
    0.90,
    false,
    null,
    array['neuroscience_research', 'cortical_neurons', 'neuromodulation', 'premotor_cortex', 'neuroanatomy', 'comparative_neuroscience', 'open_access_science']
  ),

  (
    'Quanta Magazine — Neuroscience',
    'rss',
    'https://www.quantamagazine.org/tag/neuroscience/feed/',
    'Award-winning science journalism from Quanta Magazine covering neuroscience discoveries for an intelligent general audience; recent coverage includes neuroplasticity from single experiences, AI-assisted brain cell mapping, astrocyte regulatory roles, and spatial navigation in animals, written by specialists with accuracy standards matching peer-reviewed outlets.',
    array['sciences'],
    array['neuroscience'],
    'free',
    null,
    'weekly',
    array['global'],
    0.91,
    false,
    null,
    array['neuroscience_journalism', 'neuroplasticity', 'brain_mapping', 'astrocytes', 'spatial_navigation', 'cognitive_science', 'science_communication']
  ),

  (
    'ScienceDaily — Neuroscience',
    'rss',
    'https://www.sciencedaily.com/rss/mind_brain/neuroscience.xml',
    'Aggregated neuroscience research news from ScienceDaily covering 50+ stories per feed update across Alzheimer''s, Parkinson''s, ALS, memory formation, synaptic biology, mental health, and emerging neural implant technologies; draws directly from university and institutional press releases, making it a high-volume source for tracking what laboratories are publishing.',
    array['sciences', 'medicine'],
    array['neuroscience'],
    'free',
    null,
    'daily',
    array['global'],
    0.72,
    false,
    null,
    array['neuroscience_news', 'alzheimers', 'parkinsons', 'als', 'memory_research', 'synaptic_biology', 'mental_health', 'neural_implants', 'brain_aging']
  ),

  (
    'Neuroscience News',
    'rss',
    'https://neurosciencenews.com/feed/',
    'Dedicated neuroscience news outlet updating hourly with research summaries covering neurology, psychology, AI and brain science, mental health, robotics, and cognitive sciences; aggregates work from institutions including MIT, Oxford, and the Karolinska Institutet, providing 12+ curated stories per feed update for researchers and science-literate readers.',
    array['sciences', 'medicine'],
    array['neuroscience'],
    'free',
    null,
    'hourly',
    array['global'],
    0.68,
    false,
    null,
    array['neuroscience_news', 'neurology', 'cognitive_science', 'mental_health', 'brain_ai', 'robotics', 'neuroscience_research_summaries']
  ),

  (
    'MIT News — Neuroscience',
    'rss',
    'https://news.mit.edu/rss/topic/neuroscience',
    'Official MIT News RSS feed filtered to neuroscience research, featuring work primarily from the Picower Institute for Learning and Memory and affiliated labs; covers faculty research publications, student projects, and cross-disciplinary work at the intersection of AI and brain science, providing 12+ stories per update with institutional authority.',
    array['sciences'],
    array['neuroscience'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.88,
    false,
    null,
    array['neuroscience_research', 'learning_and_memory', 'picower_institute', 'ai_and_brain', 'university_research', 'computational_neuroscience', 'cognitive_neuroscience']
  ),

  (
    'Psychology Today — News',
    'rss',
    'https://www.psychologytoday.com/us/news/feed',
    'News feed from Psychology Today covering psychology, behavioral neuroscience, and cognitive science research for an educated general audience; 30 stories per update spanning memory mechanisms, Alzheimer''s risk factors, microplastics and cognition, psilocybin research, and behavioral science findings, with editorial focus on practical implications of brain research.',
    array['sciences'],
    array['neuroscience'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.62,
    false,
    null,
    array['behavioral_neuroscience', 'cognitive_science', 'memory_research', 'alzheimers_risk', 'psychedelics_research', 'mental_health', 'behavioral_science', 'psychology']
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
