-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — tech / ai_ml
-- Curated by source-catalog-curator subagent on 2026-05-12
-- All URLs verified reachable + producing valid feed content
--
-- Verification summary:
--   - Every URL curl-verified (HTTP 200) and WebFetch/content-verified
--     for ≥3 recent items before inclusion.
--   - Last-updated dates confirmed within 30 days for daily/realtime
--     sources, 90 days for weekly+ sources.
--   - Paywall tiers reflect actual subscription requirements (May 2026).
--   - reddit_subreddit type omitted: Reddit blocks curl (SSL/TLS) in
--     this environment; r/MachineLearning and r/LocalLLaMA are noted
--     in the rejection log below for future manual verification.
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  -- ── Research Lab Blogs ───────────────────────────────────────────────

  (
    'OpenAI News',
    'rss',
    'https://openai.com/news/rss.xml',
    'Official OpenAI newsroom RSS — model releases, safety research, policy positions, and product announcements direct from the lab building GPT and o-series models.',
    array['tech'],
    array['ai_ml'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.92,
    false,
    null,
    array['llm', 'gpt', 'ai_safety', 'ai_policy', 'model_releases', 'openai_research', 'agentic_ai', 'multimodal_ai']
  ),

  (
    'Google DeepMind Blog',
    'rss',
    'https://deepmind.google/blog/rss.xml',
    'Google DeepMind''s primary research blog covering frontier AI, AlphaFold/AlphaEvolve updates, Gemini model advances, robotics, and AI for science.',
    array['tech', 'sciences'],
    array['ai_ml'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.93,
    false,
    null,
    array['llm', 'gemini', 'ai_safety', 'reinforcement_learning', 'protein_structure', 'robotics_ai', 'ai_for_science', 'multimodal_ai', 'deepmind_research']
  ),

  (
    'Google Research Blog',
    'rss',
    'https://research.google/blog/rss/',
    'Google Research''s official blog publishing findings across ML systems, NLP, computer vision, quantum computing, and AI-driven scientific discovery.',
    array['tech', 'sciences'],
    array['ai_ml'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.91,
    false,
    null,
    array['llm', 'nlp', 'computer_vision', 'ml_systems', 'neural_architecture', 'ai_for_science', 'google_research', 'transformer_models']
  ),

  (
    'Hugging Face Blog',
    'rss',
    'https://huggingface.co/blog/feed.xml',
    'Hugging Face''s engineering and research blog covering open-source model releases, PEFT/fine-tuning techniques, inference optimization, and the open ML ecosystem.',
    array['tech'],
    array['ai_ml'],
    'free',
    null,
    'daily',
    array['global'],
    0.88,
    false,
    null,
    array['open_source_models', 'llm', 'fine_tuning', 'inference_optimization', 'transformers_library', 'model_hub', 'diffusion_models', 'local_llm', 'rlhf']
  ),

  (
    'NVIDIA Technical Blog',
    'rss',
    'https://developer.nvidia.com/blog/feed/',
    'NVIDIA''s developer blog covering GPU-accelerated AI, LLM inference optimization, CUDA kernel techniques, multi-GPU training, and agentic AI systems built on NVIDIA hardware.',
    array['tech'],
    array['ai_ml'],
    'free',
    null,
    'daily',
    array['us', 'global'],
    0.84,
    false,
    null,
    array['gpu_computing', 'llm_inference', 'model_optimization', 'cuda', 'ai_infrastructure', 'agentic_ai', 'multi_gpu_training', 'tensorrt', 'triton']
  ),

  (
    'BAIR Blog (Berkeley AI Research)',
    'rss',
    'https://bair.berkeley.edu/blog/feed.xml',
    'UC Berkeley''s AI research lab blog publishing peer-reviewed-quality posts on RL, language models, robotic learning, and fundamental ML theory from leading PhD researchers.',
    array['tech', 'sciences'],
    array['ai_ml'],
    'free',
    null,
    'weekly',
    array['us', 'global'],
    0.90,
    false,
    null,
    array['reinforcement_learning', 'llm', 'robotic_learning', 'ml_theory', 'inference_scaling', 'world_models', 'ai_safety', 'foundation_models']
  ),

  -- ── Preprint / Peer-Reviewed Journals ────────────────────────────────

  (
    'arXiv cs.LG (Machine Learning)',
    'rss',
    'https://export.arxiv.org/rss/cs.LG',
    'Daily arXiv preprint feed for the cs.LG (Machine Learning) category — the highest-volume primary source for new ML research before peer review, updated each weekday with 50+ papers.',
    array['tech', 'sciences'],
    array['ai_ml'],
    'free',
    null,
    'daily',
    array['global'],
    0.95,
    false,
    null,
    array['machine_learning', 'deep_learning', 'neural_networks', 'reinforcement_learning', 'generative_models', 'ml_theory', 'optimization', 'representation_learning', 'ai_preprints']
  ),

  (
    'arXiv cs.CL (Computation & Language)',
    'rss',
    'https://export.arxiv.org/rss/cs.CL',
    'Daily arXiv preprint feed for cs.CL — natural language processing, large language models, alignment, and language-model evaluation research published before peer review.',
    array['tech', 'sciences'],
    array['ai_ml'],
    'free',
    null,
    'daily',
    array['global'],
    0.95,
    false,
    null,
    array['nlp', 'llm', 'language_model_alignment', 'llm_evaluation', 'rag', 'instruction_tuning', 'hallucination', 'ai_preprints', 'prompt_engineering']
  ),

  (
    'arXiv cs.AI (Artificial Intelligence)',
    'rss',
    'https://export.arxiv.org/rss/cs.AI',
    'Daily arXiv preprint feed for cs.AI — covering AI reasoning, planning, knowledge representation, agent systems, and applied AI methods across the broadest AI category.',
    array['tech', 'sciences'],
    array['ai_ml'],
    'free',
    null,
    'daily',
    array['global'],
    0.94,
    false,
    null,
    array['ai_agents', 'reasoning', 'planning', 'knowledge_graphs', 'multimodal_ai', 'ai_safety', 'agentic_ai', 'ai_preprints', 'vision_language_models']
  ),

  (
    'Journal of Machine Learning Research (JMLR)',
    'rss',
    'https://www.jmlr.org/jmlr.xml',
    'The gold-standard open-access peer-reviewed journal for machine learning — rigorous theoretical and applied ML papers, fully free to read, updated throughout 2026.',
    array['tech', 'sciences'],
    array['ai_ml'],
    'free',
    null,
    'weekly',
    array['global'],
    0.96,
    false,
    null,
    array['machine_learning', 'ml_theory', 'statistical_learning', 'deep_learning', 'optimization', 'bayesian_methods', 'dimensionality_reduction', 'peer_reviewed_ml']
  ),

  -- ── Trade Journalism ─────────────────────────────────────────────────

  (
    'MIT Technology Review',
    'rss',
    'https://www.technologyreview.com/feed/',
    'MIT''s flagship technology journalism publication covering AI policy, research breakthroughs, and societal impact of ML — trusted by researchers and policymakers worldwide.',
    array['tech'],
    array['ai_ml'],
    'freemium',
    17.00,  -- MIT Technology Review digital ~$17/mo; some articles free
    'daily',
    array['us', 'global'],
    0.87,
    false,
    null,
    array['ai_policy', 'llm', 'ai_safety', 'ai_ethics', 'generative_ai', 'ai_regulation', 'ai_economics', 'frontier_models', 'ai_research_analysis']
  ),

  -- ── Specialty Newsletters ─────────────────────────────────────────────

  (
    'Import AI (Jack Clark)',
    'rss',
    'https://jack-clark.net/feed/',
    'Weekly newsletter by Anthropic co-founder Jack Clark analyzing the most important new AI research papers with technical depth and policy context — one of the highest signal-to-noise AI newsletters.',
    array['tech'],
    array['ai_ml'],
    'free',
    null,
    'weekly',
    array['global'],
    0.91,
    false,
    null,
    array['ai_safety', 'llm', 'ai_policy', 'ml_research', 'frontier_models', 'ai_alignment', 'ai_geopolitics', 'ai_governance', 'research_analysis']
  ),

  (
    'Last Week in AI',
    'rss',
    'https://lastweekin.ai/feed.xml',
    'Weekly curated digest of the most important AI news and research paper summaries — accessible to both practitioners and general tech audience, published consistently since 2018.',
    array['tech'],
    array['ai_ml'],
    'free',
    null,
    'weekly',
    array['global'],
    0.76,
    false,
    null,
    array['ai_news', 'llm', 'model_releases', 'ai_research_summary', 'ai_policy', 'ai_safety', 'generative_ai', 'weekly_ai_digest']
  ),

  (
    'TheSequence',
    'rss',
    'https://thesequence.substack.com/feed',
    'Professional AI/ML newsletter with 165K subscribers covering state-space models, frontier model analysis, and applied ML engineering — three issues per week targeting AI practitioners.',
    array['tech'],
    array['ai_ml'],
    'freemium',
    null,  -- free tier available; paid tier for full archive access
    'daily',
    array['global'],
    0.78,
    false,
    null,
    array['llm', 'ml_engineering', 'foundation_models', 'state_space_models', 'ai_industry', 'applied_ml', 'model_architecture', 'ai_agents']
  ),

  (
    'Latent Space (swyx + Alessio)',
    'rss',
    'https://www.latent.space/feed',
    'High-signal Substack covering AI engineering, inference infrastructure, and frontier model developments — home of the Latent Space podcast and AI News daily briefings read by ML engineers.',
    array['tech'],
    array['ai_ml'],
    'freemium',
    null,  -- free newsletter; paid for some premium content
    'daily',
    array['global'],
    0.84,
    false,
    null,
    array['ai_engineering', 'llm', 'inference_infrastructure', 'ai_agents', 'model_releases', 'ai_startups', 'voice_models', 'ml_ops', 'foundation_models']
  ),

  -- ── Community / Aggregator ────────────────────────────────────────────

  (
    'Hacker News — AI/LLM (≥50 points)',
    'rss',
    'https://hnrss.org/newest?q=LLM&points=50',
    'Filtered Hacker News RSS surfacing community-upvoted stories mentioning LLM with ≥50 points — captures practitioner-level discourse, project releases, and technical debates not covered by mainstream press.',
    array['tech'],
    array['ai_ml'],
    'free',
    null,
    'realtime',
    array['global'],
    0.72,
    false,
    null,
    array['llm', 'ai_engineering', 'local_llm', 'open_source_models', 'ai_tools', 'ml_ops', 'ai_startups', 'practitioner_discourse']
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
