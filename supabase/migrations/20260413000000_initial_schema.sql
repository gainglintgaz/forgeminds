-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Initial Schema (Phase 0)
-- ════════════════════════════════════════════════════════════════════
-- Personal Intelligence OS — multi-tenant from day 1.
-- ~30 tables across 10 modules + shared services.
-- Every table has RLS, content_hash for dedup, prompt_version for AI audit.
-- Money stored as BIGINT cents.
-- ════════════════════════════════════════════════════════════════════

-- ─── Extensions ────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";       -- token encryption
create extension if not exists "pg_trgm";         -- full-text search
create extension if not exists "vector";          -- pgvector for embeddings
create extension if not exists "pg_cron";         -- scheduling
create extension if not exists "pg_net";          -- http calls from cron

-- ─── Enums ─────────────────────────────────────────────────────────
create type tier as enum ('explorer', 'builder', 'architect');

create type source_type as enum (
  'rss',
  'finnhub', 'benzinga', 'alpaca', 'alpha_vantage', 'coingecko',
  'reddit_home', 'reddit_subreddit',
  'x_timeline', 'x_list', 'x_bookmarks',
  'youtube_subscriptions',
  'discord_channel',
  'custom_api'
);

create type pipeline_status as enum (
  'fetched', 'scored', 'curated', 'enriched',
  'generated', 'delivered', 'rejected', 'archived'
);

create type sentiment as enum ('bullish', 'bearish', 'neutral', 'mixed');

create type asset_type as enum (
  'stock', 'etf', 'crypto', 'forex', 'index', 'commodity'
);

create type entity_type as enum (
  'company', 'person', 'crypto', 'index',
  'commodity', 'sector', 'topic'
);

create type brief_type as enum (
  'daily', 'weekly', 'breaking', 'research', 'custom'
);

create type content_type as enum (
  'social_x', 'social_linkedin', 'social_threads', 'social_facebook',
  'blog_draft', 'video_prompt', 'podcast_script',
  'email_snippet', 'newsletter', 'outreach_email'
);

create type draft_status as enum (
  'draft', 'pending_approval', 'approved',
  'published', 'rejected', 'scheduled', 'failed'
);

create type publish_method as enum (
  'ifttt', 'api_direct', 'manual', 'zapier'
);

create type delivery_type as enum (
  'email_digest', 'email_alert', 'push_notification',
  'dashboard_update', 'webhook'
);

create type delivery_status as enum (
  'pending', 'sent', 'delivered', 'opened', 'failed', 'bounced'
);

create type pipeline_step as enum (
  'ingest', 'score', 'curate', 'enrich',
  'generate', 'deliver', 'connect', 'analytics'
);

create type run_status as enum ('running', 'completed', 'failed', 'skipped');

create type goal_status as enum (
  'active', 'paused', 'completed', 'abandoned'
);

create type plan_status as enum (
  'suggested', 'accepted', 'in_progress', 'completed', 'abandoned'
);

create type interaction_action as enum (
  'view', 'click', 'save', 'share', 'dismiss',
  'approve', 'reject', 'edit', 'search', 'analyze'
);

create type feedback_type as enum (
  'too_high', 'too_low', 'just_right',
  'irrelevant', 'great_find'
);

create type notification_type as enum (
  'dot_connection', 'decay_alert', 'trust_prompt',
  'collective_insight', 'goal_milestone', 'system'
);

create type discovery_type as enum ('core', 'adjacent', 'wild_card');

create type oauth_provider as enum (
  'reddit', 'x', 'youtube', 'discord'
);

-- ════════════════════════════════════════════════════════════════════
-- 1. PROFILES — extends auth.users
-- ════════════════════════════════════════════════════════════════════
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text default 'America/New_York',
  tier tier default 'explorer' not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  onboarded_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index profiles_tier_idx on profiles(tier);

-- ════════════════════════════════════════════════════════════════════
-- 2. CONNECTED_ACCOUNTS — OAuth personal social feeds
-- ════════════════════════════════════════════════════════════════════
create table connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  provider oauth_provider not null,
  provider_user_id text not null,
  provider_username text,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  scopes text[] default '{}' not null,
  expires_at timestamptz,
  last_synced_at timestamptz,
  is_active boolean default true not null,
  error_count integer default 0,
  last_error text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, provider, provider_user_id)
);

create index connected_accounts_user_idx on connected_accounts(user_id, is_active);

-- ════════════════════════════════════════════════════════════════════
-- 3. SOURCES — configurable RSS/API feeds
-- ════════════════════════════════════════════════════════════════════
create table sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  connected_account_id uuid references connected_accounts(id) on delete cascade,
  name text not null,
  type source_type not null,
  url text,
  config jsonb default '{}'::jsonb not null,
  is_active boolean default true not null,
  fetch_interval_minutes integer default 60 not null,
  last_fetched_at timestamptz,
  next_fetch_at timestamptz,
  error_count integer default 0,
  last_error text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, name)
);

create index sources_user_active_idx on sources(user_id, is_active);
create index sources_next_fetch_idx on sources(next_fetch_at) where is_active = true;

-- ════════════════════════════════════════════════════════════════════
-- 4. ENTITIES — canonical entity registry
-- ════════════════════════════════════════════════════════════════════
create table entities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type entity_type not null,
  ticker_symbol text,
  description text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(name, type)
);

create index entities_ticker_idx on entities(ticker_symbol) where ticker_symbol is not null;
create index entities_type_idx on entities(type);

-- ════════════════════════════════════════════════════════════════════
-- 5. ENTITY_ALIASES — every alias resolves to a canonical entity
-- ════════════════════════════════════════════════════════════════════
create table entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references entities(id) on delete cascade not null,
  alias_text text not null,
  source text not null default 'manual',
  confidence numeric(4,3) default 1.0,
  created_at timestamptz default now() not null,
  unique(alias_text, entity_id)
);

create index entity_aliases_text_idx on entity_aliases(lower(alias_text));

-- ════════════════════════════════════════════════════════════════════
-- 6. RAW_ARTICLES — central pipeline table
-- ════════════════════════════════════════════════════════════════════
create table raw_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source_id uuid references sources(id) on delete set null,
  external_id text,
  title text not null,
  url text,
  summary text,
  full_text text,
  author text,
  published_at timestamptz,
  source_name text,
  source_type source_type,
  categories text[] default '{}' not null,
  raw_metadata jsonb default '{}'::jsonb not null,
  content_hash text not null,
  pipeline_status pipeline_status default 'fetched' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, content_hash)
);

create index raw_articles_user_status_idx on raw_articles(user_id, pipeline_status);
create index raw_articles_published_idx on raw_articles(user_id, published_at desc);
create index raw_articles_source_idx on raw_articles(source_id);

-- ════════════════════════════════════════════════════════════════════
-- 7. SCORED_ARTICLES — AI scoring results
-- ════════════════════════════════════════════════════════════════════
create table scored_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  article_id uuid references raw_articles(id) on delete cascade not null,
  relevance_score numeric(4,3) check (relevance_score between 0 and 1),
  impact_score numeric(4,3) check (impact_score between 0 and 1),
  novelty_score numeric(4,3) check (novelty_score between 0 and 1),
  credibility_score numeric(4,3) check (credibility_score between 0 and 1),
  composite_score numeric(4,3) check (composite_score between 0 and 1),
  sentiment sentiment,
  tickers text[] default '{}' not null,
  entity_ids uuid[] default '{}' not null,
  key_entities text[] default '{}' not null,
  one_line_summary text,
  is_curated boolean default false not null,
  curation_reason text,
  diversity_category text,
  discovery_type discovery_type default 'core',
  scoring_model text not null,
  prompt_version text not null,
  created_at timestamptz default now() not null,
  unique(user_id, article_id)
);

create index scored_user_curated_idx on scored_articles(user_id, is_curated, composite_score desc);
create index scored_tickers_gin on scored_articles using gin(tickers);
create index scored_entities_gin on scored_articles using gin(entity_ids);

-- ════════════════════════════════════════════════════════════════════
-- 8. TICKER_DATA — market data cache (BIGINT cents)
-- ════════════════════════════════════════════════════════════════════
create table ticker_data (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  name text,
  asset_type asset_type not null,
  price_cents bigint,
  change_cents bigint,
  change_percent numeric(8,4),
  volume bigint,
  market_cap_cents bigint,
  high_52w_cents bigint,
  low_52w_cents bigint,
  pe_ratio numeric(10,4),
  data_source text not null,
  fetched_at timestamptz default now() not null,
  -- Generated column ensures one snapshot per UTC day. IMMUTABLE-safe.
  fetched_date date generated always as ((fetched_at at time zone 'UTC')::date) stored
);

create unique index ticker_data_user_symbol_date_uniq
  on ticker_data (user_id, symbol, fetched_date);
create index ticker_data_symbol_idx on ticker_data(user_id, symbol, fetched_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 9. BRIEFS — generated intelligence digests
-- ════════════════════════════════════════════════════════════════════
create table briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  brief_type brief_type default 'daily' not null,
  brief_date date not null,
  summary_html text,
  summary_text text,
  article_ids uuid[] default '{}' not null,
  ticker_symbols text[] default '{}' not null,
  article_count integer default 0,
  categories_covered text[] default '{}' not null,
  generation_model text,
  prompt_version text,
  is_delivered boolean default false not null,
  delivered_at timestamptz,
  delivery_method text,
  created_at timestamptz default now() not null,
  unique(user_id, brief_type, brief_date)
);

create index briefs_user_date_idx on briefs(user_id, brief_date desc);

-- ════════════════════════════════════════════════════════════════════
-- 10. CONTENT_DRAFTS — social, blog, podcast, video drafts
-- ════════════════════════════════════════════════════════════════════
create table content_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  brief_id uuid references briefs(id) on delete set null,
  article_id uuid references raw_articles(id) on delete set null,
  content_type content_type not null,
  platform text,
  title text,
  body text not null,
  media_urls text[] default '{}' not null,
  hashtags text[] default '{}' not null,
  status draft_status default 'pending_approval' not null,
  approved_at timestamptz,
  published_at timestamptz,
  scheduled_for timestamptz,
  rejection_reason text,
  generation_model text,
  prompt_version text,
  edit_count integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index drafts_user_status_idx on content_drafts(user_id, status);
create index drafts_scheduled_idx on content_drafts(scheduled_for) where status = 'scheduled';

-- ════════════════════════════════════════════════════════════════════
-- 11. PUBLISHED_ITEMS — what was posted where
-- ════════════════════════════════════════════════════════════════════
create table published_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  draft_id uuid references content_drafts(id) on delete cascade not null,
  platform text not null,
  external_id text,
  external_url text,
  publish_method publish_method not null,
  impressions integer,
  engagements integer,
  clicks integer,
  performance_data jsonb default '{}'::jsonb,
  published_at timestamptz default now() not null,
  unique(draft_id, platform)
);

create index published_user_idx on published_items(user_id, published_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 12. SAVED_ITEMS — Knowledge Base archive
-- ════════════════════════════════════════════════════════════════════
create table saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  item_type text not null,
  article_id uuid references raw_articles(id) on delete set null,
  brief_id uuid references briefs(id) on delete set null,
  draft_id uuid references content_drafts(id) on delete set null,
  external_url text,
  title text not null,
  notes text,
  tags text[] default '{}' not null,
  search_text text,
  is_pinned boolean default false not null,
  is_brain_item boolean default false not null,
  saved_at timestamptz default now() not null
);

create index saved_user_brain_idx on saved_items(user_id, is_brain_item, saved_at desc);
create index saved_tags_gin on saved_items using gin(tags);
create index saved_search_trgm on saved_items using gin(search_text gin_trgm_ops);

-- ════════════════════════════════════════════════════════════════════
-- 13. DOT_CONNECTIONS — links between knowledge items
-- ════════════════════════════════════════════════════════════════════
create table dot_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source_item_id uuid references saved_items(id) on delete cascade not null,
  target_article_id uuid references raw_articles(id) on delete cascade,
  target_item_id uuid references saved_items(id) on delete cascade,
  connection_type text not null,
  similarity_score numeric(4,3),
  explanation_text text,
  user_dismissed boolean default false,
  discovered_at timestamptz default now() not null,
  check (target_article_id is not null or target_item_id is not null)
);

create index dot_user_idx on dot_connections(user_id, discovered_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 14. TOPIC_EVOLUTION — how topics change over time
-- ════════════════════════════════════════════════════════════════════
create table topic_evolution (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_id uuid references entities(id) on delete cascade not null,
  snapshot_date date not null,
  sentiment_score numeric(4,3),
  volume_count integer,
  key_developments text[] default '{}' not null,
  created_at timestamptz default now() not null,
  unique(user_id, entity_id, snapshot_date)
);

-- ════════════════════════════════════════════════════════════════════
-- 15. USER_PREFERENCES — scoring weights, schedule, delivery
-- ════════════════════════════════════════════════════════════════════
create table user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  topics text[] default '{}' not null,
  excluded_topics text[] default '{}' not null,
  tracked_tickers text[] default '{}' not null,
  weight_relevance numeric(4,3) default 0.30 not null,
  weight_impact numeric(4,3) default 0.30 not null,
  weight_novelty numeric(4,3) default 0.20 not null,
  weight_credibility numeric(4,3) default 0.20 not null,
  schedule_days text[] default '{mon,tue,wed,thu,fri}' not null,
  schedule_times jsonb default '{"morning": "08:00", "evening": "16:00"}'::jsonb not null,
  delivery_email boolean default true not null,
  delivery_push boolean default false not null,
  auto_generate_content boolean default false not null,
  social_platforms text[] default '{}' not null,
  social_tone text default 'professional',
  serendipity_ratio jsonb default '{"core": 0.80, "adjacent": 0.15, "wild_card": 0.05}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ════════════════════════════════════════════════════════════════════
-- 16. USER_PROFILES_EXTENDED — living user model
-- ════════════════════════════════════════════════════════════════════
create table user_profiles_extended (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profession text,
  industry text,
  side_hustles text[] default '{}' not null,
  investment_style text,
  risk_tolerance text,
  content_creation_topics text[] default '{}' not null,
  hobbies text[] default '{}' not null,
  bio text,
  inferred_attributes jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ════════════════════════════════════════════════════════════════════
-- 17. USER_GOALS — explicit goals with timelines
-- ════════════════════════════════════════════════════════════════════
create table user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  target_date date,
  status goal_status default 'active' not null,
  progress_notes text,
  matched_actions_count integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index goals_user_status_idx on user_goals(user_id, status);

-- ════════════════════════════════════════════════════════════════════
-- 18. TRUST_LEVELS — per-action-type autonomy
-- ════════════════════════════════════════════════════════════════════
create table trust_levels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  action_type text not null,
  approval_count integer default 0 not null,
  rejection_count integer default 0 not null,
  edit_count integer default 0 not null,
  auto_threshold integer default 15 not null,
  is_autonomous boolean default false not null,
  last_evaluated_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, action_type)
);

-- ════════════════════════════════════════════════════════════════════
-- 19. VOICE_PROFILES — extracted writing style
-- ════════════════════════════════════════════════════════════════════
create table voice_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  profile_name text default 'default' not null,
  avg_sentence_length numeric(6,2),
  formality_score numeric(4,3),
  vocabulary_complexity numeric(4,3),
  tone_markers jsonb default '{}'::jsonb not null,
  structural_patterns jsonb default '{}'::jsonb not null,
  recurring_phrases text[] default '{}' not null,
  banned_phrases text[] default '{}' not null,
  sample_count integer default 0 not null,
  last_trained_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, profile_name)
);

-- ════════════════════════════════════════════════════════════════════
-- 20. VOICE_TRAINING_SAMPLES — edit diffs that train Voice DNA
-- ════════════════════════════════════════════════════════════════════
create table voice_training_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  voice_profile_id uuid references voice_profiles(id) on delete cascade,
  draft_id uuid references content_drafts(id) on delete set null,
  source_type text not null,
  original_text text,
  edited_text text not null,
  diff_analysis jsonb default '{}'::jsonb not null,
  learning_category text,
  content_hash text not null,
  created_at timestamptz default now() not null,
  unique(user_id, content_hash)
);

create index voice_samples_user_idx on voice_training_samples(user_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 21. ACTION_PLANS — generated plans matched to user goals
-- ════════════════════════════════════════════════════════════════════
create table action_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  article_id uuid references raw_articles(id) on delete set null,
  brief_id uuid references briefs(id) on delete set null,
  matched_goal_id uuid references user_goals(id) on delete set null,
  title text not null,
  rationale text,
  steps jsonb default '[]'::jsonb not null,
  estimated_effort_minutes integer,
  estimated_value_cents bigint,
  status plan_status default 'suggested' not null,
  outcome_notes text,
  outcome_value_cents bigint,
  generation_model text,
  prompt_version text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index action_plans_user_status_idx on action_plans(user_id, status);

-- ════════════════════════════════════════════════════════════════════
-- 22. NOTIFICATIONS — shared service, all modules write here
-- ════════════════════════════════════════════════════════════════════
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type notification_type not null,
  title text not null,
  message text,
  link_to text,
  is_read boolean default false not null,
  is_dismissed boolean default false not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

create index notifications_user_unread_idx on notifications(user_id, is_read, created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 23. USER_ANALYTICS — monthly outcome stats
-- ════════════════════════════════════════════════════════════════════
create table user_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  period_year integer not null,
  period_month integer not null check (period_month between 1 and 12),
  actions_taken integer default 0,
  content_published integer default 0,
  knowledge_items_added integer default 0,
  briefs_received integer default 0,
  ai_calls_made integer default 0,
  estimated_value_cents bigint default 0,
  collective_contribution_score numeric(6,3) default 0,
  computed_at timestamptz default now() not null,
  unique(user_id, period_year, period_month)
);

create index analytics_user_period_idx on user_analytics(user_id, period_year desc, period_month desc);

-- ════════════════════════════════════════════════════════════════════
-- 24. DELIVERY_LOG — what was sent when
-- ════════════════════════════════════════════════════════════════════
create table delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  brief_id uuid references briefs(id) on delete set null,
  delivery_type delivery_type not null,
  recipient text not null,
  status delivery_status default 'pending' not null,
  provider text,
  provider_message_id text,
  error_message text,
  sent_at timestamptz default now() not null,
  delivered_at timestamptz,
  opened_at timestamptz
);

create index delivery_log_user_idx on delivery_log(user_id, sent_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 25. PIPELINE_RUNS — observability
-- ════════════════════════════════════════════════════════════════════
create table pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  step_name pipeline_step not null,
  status run_status default 'running' not null,
  started_at timestamptz default now() not null,
  completed_at timestamptz,
  duration_ms integer,
  items_processed integer default 0,
  items_created integer default 0,
  items_failed integer default 0,
  ai_calls_made integer default 0,
  ai_tokens_used integer default 0,
  error_message text,
  metadata jsonb default '{}'::jsonb not null
);

create index pipeline_runs_step_idx on pipeline_runs(step_name, started_at desc);
create index pipeline_runs_user_idx on pipeline_runs(user_id, started_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 26. INTERACTIONS (V1.1) — user engagement tracking
-- ════════════════════════════════════════════════════════════════════
create table interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  action interaction_action not null,
  target_type text not null,
  target_id uuid not null,
  dwell_time_seconds integer,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);

create index interactions_user_target_idx on interactions(user_id, target_type, target_id);
create index interactions_user_action_idx on interactions(user_id, action, created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 27. SCORING_FEEDBACK (V1.1) — explicit AI score feedback
-- ════════════════════════════════════════════════════════════════════
create table scoring_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  scored_article_id uuid references scored_articles(id) on delete cascade not null,
  feedback_type feedback_type not null,
  notes text,
  created_at timestamptz default now() not null,
  unique(user_id, scored_article_id)
);

-- ════════════════════════════════════════════════════════════════════
-- 28. EMBEDDINGS (V1.1) — pgvector semantic search
-- ════════════════════════════════════════════════════════════════════
create table embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source_type text not null,
  source_id uuid not null,
  content_text text,
  embedding vector(1536),
  model_name text default 'text-embedding-3-small' not null,
  created_at timestamptz default now() not null,
  unique(user_id, source_type, source_id)
);

create index embeddings_user_source_idx on embeddings(user_id, source_type);
create index embeddings_hnsw on embeddings using hnsw (embedding vector_cosine_ops);

-- ════════════════════════════════════════════════════════════════════
-- 29. COLLECTIVE_SIGNALS (V1.1) — anonymized aggregate patterns
-- ════════════════════════════════════════════════════════════════════
create table collective_signals (
  id uuid primary key default gen_random_uuid(),
  signal_type text not null,
  profession_cluster text,
  category text,
  signal_value numeric,
  signal_text text,
  sample_size integer not null,
  metadata jsonb default '{}'::jsonb not null,
  computed_at timestamptz default now() not null
);

create index collective_signals_type_idx on collective_signals(signal_type, computed_at desc);

-- ════════════════════════════════════════════════════════════════════
-- 30. COLLECTIVE_ACTIONS (V1.1) — anonymized action templates
-- ════════════════════════════════════════════════════════════════════
create table collective_actions (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  category text,
  template_text text not null,
  success_rate numeric(4,3),
  usage_count integer default 0 not null,
  avg_outcome_value_cents bigint,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ════════════════════════════════════════════════════════════════════
-- 31. SERENDIPITY_LOG (V1.1) — wild card discovery feedback
-- ════════════════════════════════════════════════════════════════════
create table serendipity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  scored_article_id uuid references scored_articles(id) on delete cascade not null,
  discovery_type discovery_type not null,
  user_engaged boolean,
  engagement_type text,
  created_at timestamptz default now() not null
);

create index serendipity_user_idx on serendipity_log(user_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — enable on all tables
-- ════════════════════════════════════════════════════════════════════

alter table profiles                  enable row level security;
alter table connected_accounts        enable row level security;
alter table sources                   enable row level security;
alter table entities                  enable row level security;
alter table entity_aliases            enable row level security;
alter table raw_articles              enable row level security;
alter table scored_articles           enable row level security;
alter table ticker_data               enable row level security;
alter table briefs                    enable row level security;
alter table content_drafts            enable row level security;
alter table published_items           enable row level security;
alter table saved_items               enable row level security;
alter table dot_connections           enable row level security;
alter table topic_evolution           enable row level security;
alter table user_preferences          enable row level security;
alter table user_profiles_extended    enable row level security;
alter table user_goals                enable row level security;
alter table trust_levels              enable row level security;
alter table voice_profiles            enable row level security;
alter table voice_training_samples    enable row level security;
alter table action_plans              enable row level security;
alter table notifications             enable row level security;
alter table user_analytics            enable row level security;
alter table delivery_log              enable row level security;
alter table pipeline_runs             enable row level security;
alter table interactions              enable row level security;
alter table scoring_feedback          enable row level security;
alter table embeddings                enable row level security;
alter table collective_signals        enable row level security;
alter table collective_actions        enable row level security;
alter table serendipity_log           enable row level security;

-- Standard policy: users own their data
create policy "own data" on profiles                  for all using (user_id = auth.uid());
create policy "own data" on connected_accounts        for all using (user_id = auth.uid());
create policy "own data" on sources                   for all using (user_id = auth.uid());
create policy "own data" on raw_articles              for all using (user_id = auth.uid());
create policy "own data" on scored_articles           for all using (user_id = auth.uid());
create policy "own data" on ticker_data               for all using (user_id = auth.uid());
create policy "own data" on briefs                    for all using (user_id = auth.uid());
create policy "own data" on content_drafts            for all using (user_id = auth.uid());
create policy "own data" on published_items           for all using (user_id = auth.uid());
create policy "own data" on saved_items               for all using (user_id = auth.uid());
create policy "own data" on dot_connections           for all using (user_id = auth.uid());
create policy "own data" on topic_evolution           for all using (user_id = auth.uid());
create policy "own data" on user_preferences          for all using (user_id = auth.uid());
create policy "own data" on user_profiles_extended    for all using (user_id = auth.uid());
create policy "own data" on user_goals                for all using (user_id = auth.uid());
create policy "own data" on trust_levels              for all using (user_id = auth.uid());
create policy "own data" on voice_profiles            for all using (user_id = auth.uid());
create policy "own data" on voice_training_samples    for all using (user_id = auth.uid());
create policy "own data" on action_plans              for all using (user_id = auth.uid());
create policy "own data" on notifications             for all using (user_id = auth.uid());
create policy "own data" on user_analytics            for all using (user_id = auth.uid());
create policy "own data" on delivery_log              for all using (user_id = auth.uid());
create policy "own data" on interactions              for all using (user_id = auth.uid());
create policy "own data" on scoring_feedback          for all using (user_id = auth.uid());
create policy "own data" on embeddings                for all using (user_id = auth.uid());
create policy "own data" on serendipity_log           for all using (user_id = auth.uid());

-- pipeline_runs: users see their own; service role bypasses RLS for system runs
create policy "own runs" on pipeline_runs for all
  using (user_id = auth.uid() or user_id is null);

-- entities + entity_aliases are global read, admin write (service role only)
create policy "public read" on entities for select using (true);
create policy "public read" on entity_aliases for select using (true);

-- collective_* are read-only for authenticated users (Architect tier check enforced in app)
create policy "authenticated read" on collective_signals for select using (auth.uid() is not null);
create policy "authenticated read" on collective_actions for select using (auth.uid() is not null);

-- ════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════════════

-- Auto-update updated_at on row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'profiles','connected_accounts','sources','entities',
    'raw_articles','content_drafts','user_preferences',
    'user_profiles_extended','user_goals','trust_levels',
    'voice_profiles','action_plans','collective_actions'
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

-- Auto-create profile + preferences + extended on user signup
create or replace function handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  insert into public.profiles (user_id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));

  insert into public.user_preferences (user_id) values (new.id);
  insert into public.user_profiles_extended (user_id) values (new.id);
  insert into public.voice_profiles (user_id) values (new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ════════════════════════════════════════════════════════════════════
-- DONE — 31 tables (1 more than planned: split shared connected_accounts
-- into its own table for cleaner OAuth handling)
-- ════════════════════════════════════════════════════════════════════
