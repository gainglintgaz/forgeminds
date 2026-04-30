-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Behavioral Signal Capture (the moat fuel)
-- ════════════════════════════════════════════════════════════════════
-- Default-on capture of every user behavioral signal that's legally safe
-- to collect. Disclosed in ToS + Privacy Policy.
--
-- What we DO collect (default-on):
--   • Click events (article cards, buttons, links, navigation)
--   • Dwell time per article / page
--   • Search queries
--   • Save/dismiss/share/edit events
--   • Scroll depth on long content
--   • Time-of-day usage patterns
--   • Action template suggestions seen vs accepted
--   • Edit diffs in Draftpad (anonymized for community Voice DNA)
--
-- What we DON'T collect:
--   • Raw keystroke logging (legally fraught, marginal value)
--   • Continuous location data (only city-level if user opts in)
--   • Content of private external messages (their email, DMs)
--   • Biometric data of any kind
--   • Health data without explicit HIPAA-grade flow
-- ════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────
create type behavioral_event_type as enum (
  'page_view',           -- route navigated to
  'article_view',        -- article card opened
  'article_dwell',       -- time spent reading
  'article_save',        -- saved to brain
  'article_dismiss',     -- explicit dismissal
  'article_share',       -- shared/exported
  'article_analyze',     -- "Analyze" tier 1 click
  'article_research',    -- "Research deeper" tier 2 click
  'search_query',        -- search bar input
  'filter_applied',      -- topic/source filter changed
  'template_suggested',  -- template shown to user
  'template_accepted',   -- template's "do this" clicked
  'template_dismissed',  -- template card dismissed
  'template_completed',  -- user reported completed
  'draft_created',       -- new content draft generated
  'draft_edited',        -- user edited a draft
  'draft_published',     -- draft sent to publish
  'scroll_depth',        -- max scroll % on a long page
  'session_start',       -- app opened
  'session_end',         -- app closed (or 30min inactivity)
  'feature_used',        -- generic feature usage
  'error_encountered'    -- friction signal
);

-- ════════════════════════════════════════════════════════════════════
-- 58. BEHAVIORAL_EVENTS — append-only event log
-- ════════════════════════════════════════════════════════════════════
-- High volume table. Pruned/aggregated to community signals after 90 days.
-- Indexed for analytics queries.
create table behavioral_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  event_type behavioral_event_type not null,

  -- Target identifiers (any may be null depending on event_type)
  article_id uuid references raw_articles(id) on delete set null,
  template_run_id uuid references action_template_runs(id) on delete set null,
  draft_id uuid references content_drafts(id) on delete set null,
  saved_item_id uuid references saved_items(id) on delete set null,
  brief_id uuid references briefs(id) on delete set null,

  -- Event metadata
  duration_ms integer,                       -- for dwell, scroll, etc.
  scroll_depth_pct integer
    check (scroll_depth_pct between 0 and 100),
  search_query text,
  route text,                                -- page path
  metadata jsonb default '{}'::jsonb,        -- event-specific extras

  -- Session context
  session_id text,                           -- groups events into sessions
  user_agent_summary text,                   -- "desktop_chrome" not full UA string
  client_timezone text,

  created_at timestamptz default now() not null
);

-- Partition-friendly indexes
create index behavioral_events_user_time_idx on behavioral_events(user_id, created_at desc);
create index behavioral_events_type_time_idx on behavioral_events(event_type, created_at desc);
create index behavioral_events_article_idx on behavioral_events(article_id) where article_id is not null;
create index behavioral_events_template_idx on behavioral_events(template_run_id) where template_run_id is not null;
create index behavioral_events_session_idx on behavioral_events(session_id);

-- ════════════════════════════════════════════════════════════════════
-- 59. SESSION_SUMMARIES — daily rollups (cheap to query)
-- ════════════════════════════════════════════════════════════════════
-- Daily cron rolls behavioral_events into per-user-per-day summaries.
-- Powers "you read 12 articles, saved 3, dismissed 9" insights.
create table session_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  summary_date date not null,
  sessions_count integer default 0,
  total_active_minutes integer default 0,
  articles_viewed integer default 0,
  articles_saved integer default 0,
  articles_dismissed integer default 0,
  articles_analyzed integer default 0,
  searches_performed integer default 0,
  templates_accepted integer default 0,
  drafts_created integer default 0,
  drafts_edited integer default 0,
  computed_at timestamptz default now() not null,
  unique(user_id, summary_date)
);

create index session_summaries_user_date_idx on session_summaries(user_id, summary_date desc);

-- ════════════════════════════════════════════════════════════════════
-- 60. COMMUNITY_BEHAVIORAL_AGGREGATES — anonymized cross-user patterns
-- ════════════════════════════════════════════════════════════════════
-- Computed daily by joining behavioral_events with community_data_settings.
-- Only includes contributions from users whose enabled_scopes contains
-- 'anonymized_signals'. Output is fully anonymized via contribution_id.
--
-- This is what powers:
--   "73% of similar-profile users saved articles like this"
--   "Article dwell time on tech stories: avg 47s for consultants"
--   "Templates with highest acceptance per profile cluster"
create table community_behavioral_aggregates (
  id uuid primary key default gen_random_uuid(),
  signal_name text not null,              -- 'article_save_rate_by_topic'
  profile_cluster text,
  geography_cluster text,
  bucket_key text not null,               -- e.g., topic name, template slug
  metric_value numeric,
  sample_size integer not null,
  window_start date not null,
  window_end date not null,
  computed_at timestamptz default now() not null,
  unique(signal_name, profile_cluster, geography_cluster, bucket_key, window_start)
);

create index community_behav_signal_idx on community_behavioral_aggregates(signal_name, profile_cluster);

-- ════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════
alter table behavioral_events                  enable row level security;
alter table session_summaries                  enable row level security;
alter table community_behavioral_aggregates    enable row level security;

-- Users can see their own events + summaries
create policy "own events"
  on behavioral_events for select
  using (user_id = auth.uid());

-- Users cannot directly delete events (data integrity for moat).
-- They can use account-deletion path which cascades.
-- They can also revoke contribution which removes them from
-- community_behavioral_aggregates aggregations going forward.

create policy "own summaries"
  on session_summaries for select
  using (user_id = auth.uid());

-- Community aggregates: read for all authenticated (powers UI)
create policy "authenticated read"
  on community_behavioral_aggregates for select
  using (auth.uid() is not null);

-- ════════════════════════════════════════════════════════════════════
-- Insert function — clients use this instead of direct INSERTs.
-- Lets us add validation/sampling/rate-limit logic in one place.
-- ════════════════════════════════════════════════════════════════════
create or replace function track_event(
  p_event_type behavioral_event_type,
  p_article_id uuid default null,
  p_template_run_id uuid default null,
  p_draft_id uuid default null,
  p_saved_item_id uuid default null,
  p_brief_id uuid default null,
  p_duration_ms integer default null,
  p_scroll_depth_pct integer default null,
  p_search_query text default null,
  p_route text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_session_id text default null
)
returns uuid
security definer
set search_path = public
language plpgsql as $$
declare
  event_id uuid;
begin
  -- Caller's RLS context applies
  insert into behavioral_events (
    user_id, event_type,
    article_id, template_run_id, draft_id, saved_item_id, brief_id,
    duration_ms, scroll_depth_pct, search_query, route, metadata, session_id
  ) values (
    auth.uid(), p_event_type,
    p_article_id, p_template_run_id, p_draft_id, p_saved_item_id, p_brief_id,
    p_duration_ms, p_scroll_depth_pct, p_search_query, p_route, p_metadata, p_session_id
  )
  returning id into event_id;

  return event_id;
end;
$$;

grant execute on function track_event to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- Maintenance: prune raw events older than 90 days
-- Aggregates already captured all the moat-relevant signals by then.
-- ════════════════════════════════════════════════════════════════════
create or replace function prune_old_behavioral_events()
returns void language plpgsql as $$
begin
  delete from behavioral_events
  where created_at < now() - interval '90 days';
end;
$$;

-- Schedule prune daily at 4am UTC (will be activated when pg_cron is configured)
-- select cron.schedule('prune-behavioral-events', '0 4 * * *',
--   'select prune_old_behavioral_events()');
