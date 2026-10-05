-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Brain Stack Architecture (the self-improving loop)
-- ════════════════════════════════════════════════════════════════════
-- The infrastructure that turns raw data into compounding intelligence.
-- Adds:
--   • prompt_versions — every AI prompt variant tracked
--   • prompt_outcomes — A/B test prompts against realized outcomes
--   • insight_distillations — periodic AI-summarized insights cached
--   • model_routing_rules — which model handles which task (with fallback)
--   • improvement_proposals — system-suggested changes awaiting review
--   • profile_clusters — derived clusters with auto-recomputed centroids
--   • topic_clusters — derived topic groupings
-- ════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────
create type prompt_status as enum (
  'experimental', 'active', 'champion', 'deprecated'
);

create type proposal_status as enum (
  'proposed', 'approved', 'rejected', 'auto_applied'
);

create type proposal_type as enum (
  'new_template', 'template_tweak', 'prompt_improvement',
  'source_addition', 'cluster_refinement', 'cost_optimization'
);

-- ════════════════════════════════════════════════════════════════════
-- 61. PROMPT_VERSIONS — every prompt variant we've ever shipped
-- ════════════════════════════════════════════════════════════════════
create table prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null,                         -- 'score_article', 'generate_brief', 'voice_match'
  version text not null,                            -- 'v1.0', 'v1.1-experiment-A'
  status prompt_status default 'experimental' not null,
  prompt_text text not null,
  system_message text,
  expected_output_schema jsonb,
  recommended_model text,                           -- 'claude-haiku-3.5', 'gemini-flash-2.0'
  recommended_temperature numeric(3,2),
  notes text,
  parent_version_id uuid references prompt_versions(id),
  champion_since timestamptz,                       -- when promoted to champion
  deprecated_at timestamptz,
  created_at timestamptz default now() not null,
  unique(prompt_key, version)
);

create index prompt_versions_key_status_idx on prompt_versions(prompt_key, status);

-- ════════════════════════════════════════════════════════════════════
-- 62. PROMPT_OUTCOMES — link prompts to realized outcomes for A/B
-- ════════════════════════════════════════════════════════════════════
-- Every AI generation logs which prompt_version was used.
-- When the resulting action gets an outcome, we link them.
-- Daily cron computes win rates per prompt for promotion decisions.
create table prompt_outcomes (
  id uuid primary key default gen_random_uuid(),
  prompt_version_id uuid references prompt_versions(id) on delete cascade not null,
  template_run_id uuid references action_template_runs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,

  -- Outcome dimensions (any can be null depending on prompt type)
  user_engaged boolean,                             -- did user view/save the output?
  user_accepted boolean,                            -- did user act on it?
  user_completed boolean,                           -- did they complete the action?
  realized_value_cents bigint,
  fact_check_passed boolean,
  user_satisfaction_score integer
    check (user_satisfaction_score between 1 and 5),

  -- Cost dimensions
  input_tokens integer,
  output_tokens integer,
  cost_cents integer,
  latency_ms integer,

  created_at timestamptz default now() not null
);

create index prompt_outcomes_version_idx on prompt_outcomes(prompt_version_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 63. INSIGHT_DISTILLATIONS — AI-summarized insights cached
-- ════════════════════════════════════════════════════════════════════
-- Periodically, we ask Claude to summarize patterns: "What are the
-- top 10 emerging trends in the consultant cluster this week?"
-- Result is cached so the dashboard query is sub-100ms instead of
-- $0.50 of Claude per request.
create table insight_distillations (
  id uuid primary key default gen_random_uuid(),
  distillation_key text not null,                   -- 'weekly_consultant_trends'
  scope jsonb default '{}'::jsonb not null,         -- {profile_cluster, geography, time_window}
  summary_text text not null,
  source_data_hash text not null,                   -- hash of inputs — invalidate on change
  generated_by_prompt_version uuid references prompt_versions(id),
  cost_cents integer,
  cached_until timestamptz not null,
  created_at timestamptz default now() not null,
  unique(distillation_key, scope, source_data_hash)
);

create index insight_distillations_lookup on insight_distillations(distillation_key, cached_until desc);

-- ════════════════════════════════════════════════════════════════════
-- 64. MODEL_ROUTING_RULES — which model for which task (+ fallback)
-- ════════════════════════════════════════════════════════════════════
-- Centralized policy. Update routing without code changes.
-- Cost optimization decisions live here.
create table model_routing_rules (
  id uuid primary key default gen_random_uuid(),
  task_key text unique not null,                    -- 'score_article', 'voice_generate', etc.
  primary_model text not null,                      -- 'gemini-flash-2.0'
  fallback_models text[] default '{}',              -- ['gemini-flash-1.5', 'claude-haiku-3.5']
  max_cost_cents integer,                           -- cap per call
  user_tier_overrides jsonb default '{}'::jsonb,    -- architect tier may use claude-sonnet
  is_active boolean default true,
  notes text,
  updated_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

-- ════════════════════════════════════════════════════════════════════
-- 65. PROFILE_CLUSTERS — derived clusters with centroids
-- ════════════════════════════════════════════════════════════════════
-- Daily cron k-means clusters all user_context_matrix rows.
-- Each user gets assigned to nearest cluster.
-- Used for "users like you" matching and outcome aggregation.
create table profile_clusters (
  id uuid primary key default gen_random_uuid(),
  cluster_label text unique not null,               -- 'consultant_low_capital_high_time'
  centroid_vector vector(384),                      -- compressed user_profile vector
  member_count integer default 0,
  representative_traits jsonb default '{}'::jsonb,  -- AI-summarized traits
  recomputed_at timestamptz default now() not null,
  is_active boolean default true,
  created_at timestamptz default now() not null
);

create index profile_clusters_active_idx on profile_clusters(is_active);

-- ════════════════════════════════════════════════════════════════════
-- 66. USER_PROFILE_CLUSTER — current assignment per user
-- ════════════════════════════════════════════════════════════════════
create table user_profile_cluster (
  user_id uuid primary key references auth.users(id) on delete cascade,
  primary_cluster_id uuid references profile_clusters(id) on delete set null,
  secondary_cluster_id uuid references profile_clusters(id) on delete set null,
  similarity_score numeric(4,3),
  last_assigned_at timestamptz default now() not null
);

create index user_profile_cluster_primary_idx on user_profile_cluster(primary_cluster_id);

-- ════════════════════════════════════════════════════════════════════
-- 67. TOPIC_CLUSTERS — derived topic groupings
-- ════════════════════════════════════════════════════════════════════
-- Cousin of profile_clusters but for content. Articles get assigned
-- to their nearest topic cluster. Used for trend surfacing.
create table topic_clusters (
  id uuid primary key default gen_random_uuid(),
  cluster_label text unique not null,
  cluster_summary text,
  centroid_vector vector(1536),
  article_count integer default 0,
  velocity_7d numeric(6,3),                         -- how fast it's growing
  is_active boolean default true,
  recomputed_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

-- ════════════════════════════════════════════════════════════════════
-- 68. IMPROVEMENT_PROPOSALS — system-suggested improvements
-- ════════════════════════════════════════════════════════════════════
-- Background analysis surfaces opportunities:
-- "Template X has 89% acceptance in cluster Y but isn't being shown
--  to those users" → propose change.
-- Human reviews + approves/rejects. Approved → auto-applied.
create table improvement_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_type proposal_type not null,
  title text not null,
  rationale text not null,
  evidence jsonb default '{}'::jsonb,                -- supporting data + sample sizes
  proposed_change jsonb not null,                    -- the specific change to apply
  estimated_impact text,
  confidence_score numeric(4,3),
  status proposal_status default 'proposed' not null,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  applied_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index improvement_proposals_status_idx on improvement_proposals(status, created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 69. BRAIN_STACK_LAYERS — metadata about which table = which layer
-- ════════════════════════════════════════════════════════════════════
-- Reference table. Useful for documentation, metrics, and future
-- automated brain-stack health checks.
create table brain_stack_layers (
  id uuid primary key default gen_random_uuid(),
  layer_number integer not null check (layer_number between 0 and 5),
  layer_name text not null,
  description text not null,
  table_names text[] not null,
  refresh_frequency text,                            -- 'realtime', 'hourly', 'daily', 'weekly'
  created_at timestamptz default now() not null,
  unique(layer_number)
);

-- Seed the architecture documentation
insert into brain_stack_layers (layer_number, layer_name, description, table_names, refresh_frequency) values
(0, 'Raw Capture',
 'Everything legally collectable. Append-only. Pruned to aggregates after 90 days.',
 array['behavioral_events','raw_articles','voice_training_samples','delivery_log','community_brain_queries'],
 'realtime'),
(1, 'Structured',
 'Canonical entities + relationships. Wikidata-grounded. Exact lookup.',
 array['entities','entity_aliases','article_geographies','ticker_data','dot_connections','topic_evolution','user_geographies'],
 'realtime'),
(2, 'Semantic',
 'Vector embeddings + cluster centroids for fuzzy matching. Powers RAG.',
 array['embeddings','community_embeddings','voice_profiles','profile_clusters','topic_clusters'],
 'daily'),
(3, 'Insight',
 'Aggregated patterns + insights. Where the moat compounds.',
 array['outcome_aggregates','template_effectiveness','community_trends','community_behavioral_aggregates','collective_signals','collective_actions','event_chains','insight_distillations'],
 'daily'),
(4, 'Decision',
 'Active recommendations awaiting outcomes.',
 array['action_plans','briefs','content_drafts','notifications','action_template_runs'],
 'realtime'),
(5, 'Outcome',
 'Ground truth. What actually happened. Trains everything above.',
 array['action_template_runs','user_analytics','scoring_feedback','prompt_outcomes','session_summaries','published_items'],
 'realtime');

-- ════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════
alter table prompt_versions          enable row level security;
alter table prompt_outcomes          enable row level security;
alter table insight_distillations    enable row level security;
alter table model_routing_rules      enable row level security;
alter table profile_clusters         enable row level security;
alter table user_profile_cluster     enable row level security;
alter table topic_clusters           enable row level security;
alter table improvement_proposals    enable row level security;
alter table brain_stack_layers       enable row level security;

-- Reference data: read for all authenticated
create policy "auth read" on prompt_versions       for select using (auth.uid() is not null);
create policy "auth read" on insight_distillations for select using (auth.uid() is not null);
create policy "auth read" on model_routing_rules   for select using (auth.uid() is not null);
create policy "auth read" on profile_clusters      for select using (auth.uid() is not null);
create policy "auth read" on topic_clusters        for select using (auth.uid() is not null);
create policy "auth read" on brain_stack_layers    for select using (auth.uid() is not null);
create policy "public read" on improvement_proposals for select using (true);

-- User-owned
create policy "own cluster" on user_profile_cluster for select using (user_id = auth.uid());
create policy "own outcomes" on prompt_outcomes     for select using (user_id = auth.uid());

-- Updated_at triggers
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'prompt_versions','model_routing_rules','improvement_proposals'
  ])
  loop
    execute format('
      drop trigger if exists set_updated_at_trg on %I;
      create trigger set_updated_at_trg
        before update on %I
        for each row execute function set_updated_at();
    ', t, t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- Seed initial model routing rules
-- Favor cheap models + in-house tools; fall back to premium when needed.
-- Run through litellm proxy for unified API across providers.
-- ════════════════════════════════════════════════════════════════════
insert into model_routing_rules (task_key, primary_model, fallback_models, max_cost_cents, notes) values
('score_article',           'gemini-flash-2.0',          array['kimi-k2.6','claude-haiku-3.5'],   1,   'Bulk classification; cheapest viable'),
('extract_entities',        'gemini-flash-2.0',          array['kimi-k2.6','claude-haiku-3.5'],   1,   'Pulled during scoring step'),
('generate_brief',          'kimi-k2.6',                 array['claude-haiku-3.5'],               20,  'Kimi 6x cheaper than Claude at similar quality'),
('generate_social_post',    'grok-3',                    array['kimi-k2.6','claude-haiku-3.5'],   15,  'Grok for X cultural context; Kimi fallback'),
('generate_video_prompt',   'grok-3',                    array['kimi-k2.6'],                      15,  'Grok primary; Kimi fallback'),
('voice_match_content',     'claude-haiku-3.5',          array['kimi-k2.6'],                      50,  'Voice DNA quality matters'),
('deep_research',           'claude-sonnet-4.5',         array['kimi-k2.6'],                      500, 'Architect tier; willing to pay'),
('live_web_search',         'forgesearch',               array['perplexity-sonar'],               30,  'IN-HOUSE: Brave+Crawl4ai+re-rank ~$0.30/query'),
('fact_check_claim',        'forgesearch',               array['perplexity-sonar'],               20,  'IN-HOUSE: verify outputs against real sources'),
('find_similar_pages',      'pgvector_local',            array['forgesearch'],                    1,   'LOCAL: query embeddings table; zero API'),
('embedding',               'openai-text-embed-3-small', array['bge-large-local'],                5,   'OpenAI until $50/mo bill, then self-host BGE'),
('action_plan_generation',  'kimi-k2.6',                 array['claude-haiku-3.5'],               25,  'Action Engine output'),
('insight_distillation',    'kimi-k2.6',                 array['claude-haiku-3.5'],               100, 'Weekly trend summaries; cached aggressively'),
('improvement_proposal',    'claude-sonnet-4.5',         array['kimi-k2.6'],                      500, 'Rare; high-stakes; quality over cost'),
('build_kickoff_codegen',   'kimi-k2.6',                 array['claude-sonnet-4.5'],              200, 'Agent Swarm parallel file generation'),
('patent_viability_scoring','gemini-flash-2.0',          array['kimi-k2.6'],                      2,   'Bulk USPTO scan; cheapest model wins');
