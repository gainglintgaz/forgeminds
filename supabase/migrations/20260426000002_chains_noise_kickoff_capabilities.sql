-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Event Chains + Noise Control + Build Kick-off + Tool Capabilities
-- ════════════════════════════════════════════════════════════════════
-- Adds:
--   • event_chains + event_chain_patterns (real-world action sequences)
--   • user_filter_preferences + engagement_decay (noise control)
--   • build_kickoff_packages + kickoff_templates (handoff to Claude Code/etc)
--   • tool_capabilities + tool_lessons_learned (honest reality registry)
-- ════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────
create type chain_relationship as enum (
  'predecessor',     -- A happened before B
  'consequence',     -- B caused by A
  'correlation',     -- A and B happen together but causation unclear
  'pattern_match'    -- A and B match a known pattern
);

create type signal_strength as enum ('weak', 'moderate', 'strong', 'verified');

create type filter_action as enum (
  'mute', 'boost', 'snooze', 'always_show', 'always_hide'
);

create type tool_category as enum (
  'ai_model',          -- Claude, Gemini, GPT, Grok
  'ai_coding',         -- Claude Code, Cursor, Lovable, Codex, Replit
  'mcp_server',        -- Supabase MCP, GitHub MCP, etc.
  'data_api',          -- Finnhub, Alpaca, CoinGecko
  'scraping',          -- Apify, ScraperAPI, Browserbase
  'hosting',           -- Vercel, Netlify, Cloudflare, AWS, Fly
  'database',          -- Supabase, Neon, PlanetScale, Firebase
  'auth',              -- Clerk, Auth0, Supabase Auth
  'payment',           -- Stripe, Paddle, LemonSqueezy
  'email',             -- Resend, SendGrid, Postmark
  'analytics',         -- PostHog, Mixpanel, Plausible
  'design',            -- Figma, Framer, v0
  'workflow',          -- Pipedream, n8n, Zapier, Make
  'social_post',       -- IFTTT, Buffer, Typefully
  'content',           -- Substack, Beehiiv, Ghost
  'observability'      -- Sentry, Datadog, LogRocket
);

create type capability_status as enum (
  'fully_supported',
  'partially_supported',
  'workaround_required',
  'not_supported',
  'forbidden'        -- ToS / legal / impossible
);

-- ════════════════════════════════════════════════════════════════════
-- 43. EVENT_CHAIN_PATTERNS — known patterns to detect
-- ════════════════════════════════════════════════════════════════════
create table event_chain_patterns (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                    -- 'datacenter_then_homes'
  display_name text not null,
  description text not null,

  -- Pattern definition
  trigger_event_type news_event_type not null,
  trigger_filters jsonb default '{}'::jsonb,    -- {min_value: 50000000, geo_scale: 'county'}
  consequence_event_types news_event_type[] not null,
  consequence_filters jsonb default '{}'::jsonb,
  time_window_days integer not null,            -- look-back window for pairing
  geographic_scope text default 'same_county',  -- 'same_zip', 'same_county', 'same_state', '5mi_radius'

  -- Required data source for verification (NEVER hallucinate the chain)
  verification_sources text[] not null,         -- e.g., ['county_property_records', 'sec_edgar']
  min_signal_strength signal_strength default 'moderate',

  -- Output template
  output_template text not null,
  output_fields jsonb default '{}'::jsonb,

  status template_status default 'draft' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index event_chain_patterns_trigger_idx on event_chain_patterns(trigger_event_type, status);

-- ════════════════════════════════════════════════════════════════════
-- 44. EVENT_CHAINS — detected real-world chain instances
-- ════════════════════════════════════════════════════════════════════
create table event_chains (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid references event_chain_patterns(id) on delete set null,

  -- Linked events (each must be backed by real article + real geography)
  trigger_article_id uuid references raw_articles(id) on delete cascade not null,
  consequence_article_ids uuid[] default '{}',
  geography_id uuid references geographies(id) on delete set null,

  -- Verified facts
  trigger_event_date date not null,
  consequence_event_dates date[] default '{}',
  verified_data jsonb default '{}'::jsonb,        -- e.g., {homes_purchased: 12, total_value_cents: 450000000}
  data_sources_used text[] not null,              -- which APIs/feeds backed this
  signal_strength signal_strength not null,

  -- Notification scope (which users see this chain in their feed)
  visible_to_users uuid[] default '{}',           -- precomputed from geography overlap
  detected_at timestamptz default now() not null
);

create index event_chains_pattern_idx on event_chains(pattern_id, detected_at desc);
create index event_chains_geography_idx on event_chains(geography_id);
create index event_chains_visible_gin on event_chains using gin(visible_to_users);

-- ════════════════════════════════════════════════════════════════════
-- 45. USER_FILTER_PREFERENCES — explicit mute/boost/snooze rules
-- ════════════════════════════════════════════════════════════════════
create table user_filter_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  action filter_action not null,
  target_type text not null,                      -- 'topic', 'source', 'entity', 'category', 'vector'
  target_value text not null,                     -- 'crypto', 'wsj.com', 'AAPL', 'investment'
  reason text,
  expires_at timestamptz,                         -- for snooze
  created_at timestamptz default now() not null,
  unique(user_id, target_type, target_value)
);

create index user_filters_user_idx on user_filter_preferences(user_id, action);

-- ════════════════════════════════════════════════════════════════════
-- 46. ENGAGEMENT_DECAY — auto-learned from dismissals
-- ════════════════════════════════════════════════════════════════════
-- If user dismisses 5 articles about Tesla in a row, system auto-downweights
-- without them having to explicitly mute it.
create table engagement_decay (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  signal_type text not null,                      -- 'topic', 'source', 'entity', 'category'
  signal_value text not null,
  dismiss_count integer default 0,
  engage_count integer default 0,
  decay_score numeric(4,3) default 0,             -- 0 = no penalty, 1 = max suppression
  last_updated timestamptz default now() not null,
  unique(user_id, signal_type, signal_value)
);

create index engagement_decay_user_idx on engagement_decay(user_id, decay_score desc);

-- ════════════════════════════════════════════════════════════════════
-- 47. NOTIFICATION_PREFERENCES — quiet hours, cadence, density
-- ════════════════════════════════════════════════════════════════════
create table notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Cadence
  brief_frequency text default 'daily',           -- 'daily' | '3x_week' | 'weekly' | 'breaking_only'
  brief_density integer default 7
    check (brief_density between 1 and 30),       -- stories per brief
  onboarding_ramp_phase integer default 1,        -- 1 (gentle) → 3 (full firehose)

  -- Quiet hours (user's timezone)
  quiet_hours_start time,
  quiet_hours_end time,
  weekend_quiet boolean default false,

  -- Channels
  email_enabled boolean default true,
  push_enabled boolean default false,
  dashboard_only_enabled boolean default false,

  -- Tone
  tone_preference text default 'neutral',         -- 'neutral' | 'energetic' | 'calm' | 'boring'
  hype_filter boolean default false,              -- strip "explosive growth" / "game-changing" / etc.

  -- Limits
  max_notifications_per_day integer default 5,
  pause_until timestamptz,                        -- global snooze

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ════════════════════════════════════════════════════════════════════
-- 48. TOOL_CAPABILITIES — honest registry of what tools can/can't do
-- ════════════════════════════════════════════════════════════════════
create table tool_capabilities (
  id uuid primary key default gen_random_uuid(),
  tool_name text not null,                        -- 'Claude Code', 'Cursor', 'Lovable'
  category tool_category not null,
  capability_area text not null,                  -- 'web_scraping', 'pdf_parsing', 'image_gen'
  status capability_status not null,
  notes text not null,                            -- specifics + workarounds
  workaround text,                                -- if status is workaround_required
  cost_floor_cents bigint,                        -- minimum monthly cost
  cost_ceiling_cents bigint,                      -- typical max
  cost_unit text,                                 -- 'monthly' | 'per_call' | 'per_token' | 'one_time'
  setup_complexity integer
    check (setup_complexity between 1 and 10),
  reliability_score integer
    check (reliability_score between 1 and 10),
  last_verified date,
  source text,                                    -- 'vibe_lesson_X', 'official_docs', 'community'
  is_active boolean default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(tool_name, capability_area)
);

create index tool_capabilities_tool_idx on tool_capabilities(tool_name, is_active);
create index tool_capabilities_status_idx on tool_capabilities(status, is_active);

-- ════════════════════════════════════════════════════════════════════
-- 49. TOOL_LESSONS_LEARNED — VictorForge battle scars
-- ════════════════════════════════════════════════════════════════════
create table tool_lessons_learned (
  id uuid primary key default gen_random_uuid(),
  project_name text,                              -- 'HuntHive', 'FinKeel', null for general
  tool_name text not null,
  capability_area text,
  severity text not null,                         -- 'blocker' | 'painful' | 'minor' | 'wisdom'
  what_failed text not null,
  why_it_failed text,
  what_worked text,                               -- workaround actually used
  takeaway text not null,                         -- one-sentence rule
  date_learned date,
  created_at timestamptz default now() not null
);

create index tool_lessons_severity_idx on tool_lessons_learned(severity);

-- ════════════════════════════════════════════════════════════════════
-- 50. KICKOFF_TEMPLATES — reusable build packages per tool combo
-- ════════════════════════════════════════════════════════════════════
create table kickoff_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                      -- 'nextjs_supabase_vercel'
  display_name text not null,
  description text not null,
  target_tools text[] not null,                   -- ['claude_code', 'cursor']
  target_stack jsonb not null,                    -- {frontend, backend, db, hosting, ...}

  -- Generated artifacts (markdown + config)
  claude_md_template text not null,               -- mustache-style with {{user_vars}}
  feature_backlog_template text not null,
  current_sprint_template text,
  env_example_template text,
  starter_repo_url text,                          -- optional GitHub template repo
  setup_steps jsonb default '[]'::jsonb not null, -- ordered list of CLI commands

  -- Tool/MCP recommendations
  recommended_mcp_servers text[] default '{}',
  recommended_skills text[] default '{}',
  recommended_scheduled_tasks jsonb default '[]'::jsonb,

  -- Cost preview
  estimated_monthly_cost_cents bigint,
  cost_breakdown jsonb default '{}'::jsonb,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ════════════════════════════════════════════════════════════════════
-- 51. BUILD_KICKOFF_PACKAGES — generated handoff packages per user
-- ════════════════════════════════════════════════════════════════════
create table build_kickoff_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  template_run_id uuid references action_template_runs(id) on delete cascade,
  kickoff_template_id uuid references kickoff_templates(id) on delete set null,

  -- Project metadata
  project_name text not null,
  project_description text not null,
  source_event_summary text,                      -- "Apple Vision Pro 2 SDK launched..."

  -- Personalized artifacts (generated for this user)
  claude_md text not null,
  feature_backlog text not null,
  current_sprint text,
  master_prompt text not null,                    -- the THE prompt to paste into Claude Code/Cursor
  env_example text,
  setup_commands text[],

  -- Tool selections (user-confirmed or AI-recommended)
  selected_tools text[] not null,
  selected_mcp_servers text[] default '{}',
  selected_skills text[] default '{}',
  estimated_monthly_cost_cents bigint,

  -- Honest reality checks (from tool_capabilities)
  capability_warnings text[] default '{}',        -- "Cannot scrape Amazon prices"
  scope_caveats text[] default '{}',              -- "This is software-only, no hardware"

  -- Export status
  exported_as text default 'pending',             -- 'zip' | 'github_repo' | 'gist' | 'pending'
  download_url text,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index kickoff_user_idx on build_kickoff_packages(user_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════
alter table event_chain_patterns        enable row level security;
alter table event_chains                enable row level security;
alter table user_filter_preferences     enable row level security;
alter table engagement_decay            enable row level security;
alter table notification_preferences    enable row level security;
alter table tool_capabilities           enable row level security;
alter table tool_lessons_learned        enable row level security;
alter table kickoff_templates           enable row level security;
alter table build_kickoff_packages      enable row level security;

-- Public reference data
create policy "public read" on event_chain_patterns for select using (status = 'active');
create policy "public read" on tool_capabilities    for select using (is_active = true);
create policy "public read" on tool_lessons_learned for select using (true);
create policy "public read" on kickoff_templates    for select using (true);

-- Event chains visible only to users in the geography
create policy "geo visible" on event_chains for select
  using (auth.uid() = any(visible_to_users));

-- User-owned tables
create policy "own data" on user_filter_preferences  for all using (user_id = auth.uid());
create policy "own data" on engagement_decay         for all using (user_id = auth.uid());
create policy "own data" on notification_preferences for all using (user_id = auth.uid());
create policy "own data" on build_kickoff_packages   for all using (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- Triggers
-- ════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'event_chain_patterns','tool_capabilities','kickoff_templates',
    'build_kickoff_packages','notification_preferences'
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

-- Extend handle_new_user trigger to create notification_preferences
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
  insert into public.notification_preferences (user_id) values (new.id);
  insert into public.user_context_matrix (user_id) values (new.id);

  return new;
end;
$$;
