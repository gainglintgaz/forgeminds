-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Geographic Intelligence + Paywall + Moat Tables
-- ════════════════════════════════════════════════════════════════════
-- Extends Phase 0 schema with:
--   • geographic anchors (multi-scale: zip → county → state → country)
--   • paywall sources registry + user external subscriptions
--   • outcome aggregates (the moat: precomputed collective intelligence)
-- ════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────
create type geo_scale as enum (
  'zip', 'city', 'county', 'metro', 'state', 'country', 'continent', 'global'
);

create type access_method as enum (
  'cookie_vault',     -- encrypted browser session cookies
  'oauth',            -- OAuth flow (e.g., Substack)
  'api_key',          -- user-provided API key
  'platform_license', -- ForgeMinds-licensed for Architect tier
  'public_preview'    -- whatever's freely accessible
);

create type comfort_mode as enum (
  'online_only', 'in_person', 'b2b', 'b2c', 'async', 'sync'
);

-- ════════════════════════════════════════════════════════════════════
-- 35. GEOGRAPHIES — canonical geo entities
-- ════════════════════════════════════════════════════════════════════
create table geographies (
  id uuid primary key default gen_random_uuid(),
  scale geo_scale not null,
  name text not null,                  -- 'Spartanburg County'
  parent_id uuid references geographies(id) on delete set null,
  country_code text,                   -- 'US'
  state_code text,                     -- 'SC'
  zip_codes text[] default '{}',       -- ['29301', '29302', ...]
  centroid_lat numeric(10,6),
  centroid_lon numeric(10,6),
  bounding_box jsonb,                  -- GeoJSON bbox
  metadata jsonb default '{}'::jsonb,  -- population, median income, etc.
  created_at timestamptz default now() not null,
  unique(scale, name, country_code, state_code)
);

create index geographies_scale_idx on geographies(scale);
create index geographies_state_idx on geographies(country_code, state_code);
create index geographies_zip_gin on geographies using gin(zip_codes);

-- ════════════════════════════════════════════════════════════════════
-- 36. USER_GEOGRAPHIES — user's geographic anchors
-- ════════════════════════════════════════════════════════════════════
create table user_geographies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  geography_id uuid references geographies(id) on delete cascade not null,
  anchor_type text not null,           -- 'home', 'business', 'investment', 'family', 'travel'
  priority integer default 1,          -- 1 = primary, 2 = secondary, ...
  notes text,
  created_at timestamptz default now() not null,
  unique(user_id, geography_id, anchor_type)
);

create index user_geographies_user_idx on user_geographies(user_id, priority);

-- ════════════════════════════════════════════════════════════════════
-- 37. ARTICLE_GEOGRAPHIES — geo tags on articles
-- ════════════════════════════════════════════════════════════════════
create table article_geographies (
  article_id uuid references raw_articles(id) on delete cascade not null,
  geography_id uuid references geographies(id) on delete cascade not null,
  relevance numeric(4,3) default 1.0 check (relevance between 0 and 1),
  detected_by text default 'extraction',  -- 'extraction' | 'source_metadata' | 'manual'
  created_at timestamptz default now() not null,
  primary key (article_id, geography_id)
);

create index article_geographies_geo_idx on article_geographies(geography_id);

-- ════════════════════════════════════════════════════════════════════
-- 38. PAYWALL_SOURCES — registry of paywalled sites + access methods
-- ════════════════════════════════════════════════════════════════════
create table paywall_sources (
  id uuid primary key default gen_random_uuid(),
  domain text unique not null,                 -- 'wsj.com'
  display_name text not null,                  -- 'Wall Street Journal'
  access_methods access_method[] not null,
  byos_supported boolean default false,
  platform_licensed_tier text,                 -- 'architect' or null
  fetch_strategy text not null,                -- 'browser_session', 'api_oauth', 'rss_premium', 'archive_org'
  rss_premium_url text,                        -- if available with subscription
  notes text,
  is_active boolean default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index paywall_sources_active_idx on paywall_sources(is_active);

-- ════════════════════════════════════════════════════════════════════
-- 39. EXTERNAL_SUBSCRIPTIONS — user's BYOS credentials (encrypted)
-- ════════════════════════════════════════════════════════════════════
create table external_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  paywall_source_id uuid references paywall_sources(id) on delete cascade not null,
  access_method access_method not null,
  credentials_encrypted text,                  -- pgcrypto envelope
  is_active boolean default true,
  last_verified_at timestamptz,
  expires_at timestamptz,                      -- when credentials need refresh
  refresh_required boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, paywall_source_id)
);

create index external_subs_user_idx on external_subscriptions(user_id, is_active);

-- ════════════════════════════════════════════════════════════════════
-- 40. USER_CONTEXT_MATRIX — extended profile (capital, time, comfort)
-- ════════════════════════════════════════════════════════════════════
create table user_context_matrix (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Capital
  capital_deployable_min_cents bigint,
  capital_deployable_max_cents bigint,
  capital_currency text default 'USD',

  -- Time
  hours_per_week_available integer,            -- 0-100+
  preferred_action_window text,                -- 'morning', 'evening', 'weekend', 'any'

  -- Risk
  risk_tolerance text,                         -- 'low', 'moderate', 'high', 'aggressive'
  risk_capacity text,                          -- 'low', 'moderate', 'high' (different from tolerance)

  -- Skills + tech
  skills text[] default '{}',                  -- ['react', 'sql', 'design', 'sales']
  tech_stack text[] default '{}',              -- ['nextjs', 'supabase', 'tailwind']

  -- Comfort modes
  comfort_modes comfort_mode[] default '{}',

  -- Business context
  business_structure text,                     -- 'sole_prop', 'llc', 'c_corp', 's_corp', 'w2_only'
  business_state text,                         -- '2-letter state for tax purposes'

  -- Connections
  has_linkedin_oauth boolean default false,
  has_github_oauth boolean default false,
  network_size_estimate integer,               -- self-reported or inferred

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ════════════════════════════════════════════════════════════════════
-- 41. OUTCOME_AGGREGATES — precomputed collective intelligence (THE MOAT)
-- ════════════════════════════════════════════════════════════════════
-- Anonymized rollups of action_template_runs. Updated daily by cron.
-- Powers "73% of similar users took this action and saw $147 avg" UI.
create table outcome_aggregates (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references action_templates(id) on delete cascade not null,
  trigger_type news_event_type,
  profile_cluster text not null,               -- 'consultant_low_capital', 'creator_audience_focus', etc.
  geography_scale geo_scale,
  geography_id uuid references geographies(id) on delete set null,

  -- Aggregates
  total_runs integer default 0,
  acceptance_rate numeric(4,3),                -- of suggested → accepted
  completion_rate numeric(4,3),                -- of accepted → completed
  avg_realized_value_cents bigint,
  median_realized_value_cents bigint,
  p90_realized_value_cents bigint,             -- top 10% outcome
  avg_effort_minutes integer,
  sample_size integer not null,

  -- Window
  window_start date not null,
  window_end date not null,
  computed_at timestamptz default now() not null,

  unique(template_id, trigger_type, profile_cluster, geography_id, window_start)
);

create index outcome_aggregates_template_idx on outcome_aggregates(template_id, profile_cluster);
create index outcome_aggregates_geo_idx on outcome_aggregates(geography_id) where geography_id is not null;

-- ════════════════════════════════════════════════════════════════════
-- 42. TEMPLATE_EFFECTIVENESS — per-cluster ranking signals
-- ════════════════════════════════════════════════════════════════════
-- Rolling effectiveness score per template per profile cluster.
-- Used to rank which templates fire for a given user.
create table template_effectiveness (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references action_templates(id) on delete cascade not null,
  profile_cluster text not null,
  effectiveness_score numeric(5,4) check (effectiveness_score between 0 and 1),
  confidence numeric(4,3),                     -- statistical confidence (sample-size driven)
  sample_size integer not null,
  last_updated timestamptz default now() not null,
  unique(template_id, profile_cluster)
);

create index template_effectiveness_score_idx on template_effectiveness(effectiveness_score desc);

-- ════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════
alter table geographies              enable row level security;
alter table user_geographies         enable row level security;
alter table article_geographies      enable row level security;
alter table paywall_sources          enable row level security;
alter table external_subscriptions   enable row level security;
alter table user_context_matrix      enable row level security;
alter table outcome_aggregates       enable row level security;
alter table template_effectiveness   enable row level security;

-- Geographies: global read (public reference data)
create policy "public read"             on geographies         for select using (true);
create policy "public read"             on paywall_sources     for select using (is_active = true);

-- User-owned tables
create policy "own data" on user_geographies      for all using (user_id = auth.uid());
create policy "own data" on external_subscriptions for all using (user_id = auth.uid());
create policy "own data" on user_context_matrix   for all using (user_id = auth.uid());

-- Article geographies: visible if user owns the article
create policy "own articles" on article_geographies for all using (
  exists (
    select 1 from raw_articles
    where raw_articles.id = article_geographies.article_id
    and raw_articles.user_id = auth.uid()
  )
);

-- Outcome aggregates + effectiveness: read for authenticated users (collective intel)
create policy "authenticated read" on outcome_aggregates    for select using (auth.uid() is not null);
create policy "authenticated read" on template_effectiveness for select using (auth.uid() is not null);

-- ════════════════════════════════════════════════════════════════════
-- Triggers
-- ════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'paywall_sources','external_subscriptions','user_context_matrix'
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
