-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Action Templates (Multi-Vector Action Engine)
-- ════════════════════════════════════════════════════════════════════
-- Templates are deterministic, human-authored playbooks. AI doesn't
-- invent vectors — it matches user profile + article facts to existing
-- templates. Every template's outputs are grounded in real data sources.
-- ════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────
create type action_vector as enum (
  'investment',     -- stock/crypto/options/ETF
  'build',          -- SaaS, app, plugin, library
  'content',        -- blog, social, video, podcast, newsletter
  'network',        -- LinkedIn, communities, conferences
  'learn',          -- courses, certs, gap-filling content
  'consulting',     -- client outreach, workshops, speaking
  'land_grab',      -- domains, trademarks, social handles
  'local_civic',    -- property, zoning, council, real estate
  'family',         -- education, scholarships, kids
  'travel',         -- routes, prices, family trips
  'health',         -- studies, doctor visits, family medical
  'career',         -- hiring signals, comp, talent flow
  'sports_fantasy', -- DFS, fantasy, betting, hot takes
  'legal_tax'       -- deadlines, advisory, regulatory
);

create type news_event_type as enum (
  'product_launch',          -- new product/SDK/API
  'earnings_report',         -- earnings beat/miss/guide
  'executive_change',        -- CEO/CFO change
  'ipo_funding',             -- IPO, raise, valuation
  'acquisition_merger',      -- M&A activity
  'regulatory_event',        -- approval, lawsuit, ruling
  'partnership',             -- strategic deal
  'patent_filing',           -- IP signal
  'study_research',          -- scientific/medical/policy study
  'price_drop',              -- travel/retail/ticker
  'route_launch',            -- airline/transport
  'local_civic_action',      -- council vote, zoning, bond
  'scholarship_program',     -- education opportunity
  'tax_legal_change',        -- regulation, deadline
  'sports_event',            -- injury, trade, schedule
  'comp_data',               -- salary survey, market data
  'cultural_moment',         -- viral story, trend
  'security_breach',         -- vuln, hack, leak
  'open_source_release',     -- repo, model, dataset
  'market_movement'          -- index/sector/macro shift
);

create type template_status as enum ('draft', 'active', 'deprecated');

create type run_outcome as enum (
  'suggested',       -- shown to user, no action yet
  'dismissed',       -- user clicked dismiss
  'accepted',        -- user clicked "do this"
  'completed',       -- user marked done
  'value_realized'   -- user reported outcome
);

-- ════════════════════════════════════════════════════════════════════
-- 32. ACTION_TEMPLATES — global library, human-authored
-- ════════════════════════════════════════════════════════════════════
create table action_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                           -- 'domain_land_grab'
  vector action_vector not null,
  triggers news_event_type[] not null,
  display_name text not null,
  description text not null,

  -- Profile/goal matching
  applies_to_profiles text[] default '{}',             -- ['consultant', 'creator', 'investor']
  applies_to_goals text[] default '{}',                -- ['build', 'audience', 'income']
  excludes_profiles text[] default '{}',

  -- Data sources required (Layer 1) — must all resolve before showing
  required_data_layers jsonb default '[]'::jsonb not null,
  -- example: [{"source": "whois_api", "purpose": "verify domain availability"},
  --          {"source": "uspto_api", "purpose": "trademark search"}]

  -- Output format
  output_template text not null,                       -- mustache-style template
  output_fields jsonb default '{}'::jsonb not null,    -- field schema for AI to populate

  -- Hallucination guard
  hallucination_risk integer default 0
    check (hallucination_risk between 0 and 10),       -- 0 = all facts verified, 10 = unverified
  fact_check_rules jsonb default '[]'::jsonb not null, -- post-generation validators

  -- Effort/value estimates (broad ranges)
  estimated_effort_minutes integer,
  estimated_value_cents bigint,
  estimated_value_label text,                          -- 'low_$', 'med_$$', 'high_$$$'
  time_sensitivity_hours integer,                      -- e.g. 72 for land-grab

  -- Versioning + lifecycle
  status template_status default 'draft' not null,
  version integer default 1 not null,
  author text,
  notes text,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index action_templates_vector_idx on action_templates(vector, status);
create index action_templates_triggers_gin on action_templates using gin(triggers);
create index action_templates_profiles_gin on action_templates using gin(applies_to_profiles);

-- ════════════════════════════════════════════════════════════════════
-- 33. ACTION_TEMPLATE_RUNS — per-user, per-article instances
-- ════════════════════════════════════════════════════════════════════
create table action_template_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  template_id uuid references action_templates(id) on delete cascade not null,
  article_id uuid references raw_articles(id) on delete cascade,
  brief_id uuid references briefs(id) on delete set null,

  -- Resolved facts from Layer 1 data sources
  resolved_data jsonb default '{}'::jsonb not null,
  -- example: {"available_domains": ["operatorhub.com", ...],
  --           "uspto_filings": [...]}

  -- Profile match score (Layer 3)
  match_score numeric(4,3) check (match_score between 0 and 1),
  match_reason text,

  -- Generated output (Layer 4)
  output_text text,
  output_html text,
  generation_model text,
  prompt_version text,

  -- Fact check pass/fail
  fact_check_passed boolean default false not null,
  fact_check_warnings text[] default '{}',

  -- Outcome tracking
  outcome run_outcome default 'suggested' not null,
  user_feedback text,
  realized_value_cents bigint,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index template_runs_user_idx on action_template_runs(user_id, created_at desc);
create index template_runs_template_idx on action_template_runs(template_id);
create index template_runs_outcome_idx on action_template_runs(user_id, outcome);
create index template_runs_article_idx on action_template_runs(article_id);

-- ════════════════════════════════════════════════════════════════════
-- 34. DATA_SOURCE_CACHE — cached results from Layer 1 calls
-- ════════════════════════════════════════════════════════════════════
-- Many templates query the same APIs (WHOIS, USPTO, LinkedIn).
-- Cache results to avoid duplicate API calls within a session.
create table data_source_cache (
  id uuid primary key default gen_random_uuid(),
  source text not null,                  -- 'whois', 'uspto', 'linkedin_2nd_degree'
  query_key text not null,               -- normalized lookup key
  result jsonb not null,
  fetched_at timestamptz default now() not null,
  expires_at timestamptz not null,
  unique(source, query_key)
);

create index data_source_cache_expires_idx on data_source_cache(expires_at);
create index data_source_cache_lookup_idx on data_source_cache(source, query_key);

-- ════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════
alter table action_templates       enable row level security;
alter table action_template_runs   enable row level security;
alter table data_source_cache      enable row level security;

-- action_templates is global library — read for all authenticated users
create policy "authenticated read templates"
  on action_templates for select
  using (auth.uid() is not null and status = 'active');

-- action_template_runs is per-user
create policy "own runs"
  on action_template_runs for all
  using (user_id = auth.uid());

-- data_source_cache is shared (same WHOIS result for any user) — read for all
create policy "authenticated read cache"
  on data_source_cache for select
  using (auth.uid() is not null);

-- ════════════════════════════════════════════════════════════════════
-- Triggers — auto-updated_at
-- ════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'action_templates','action_template_runs'
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
-- Cache cleanup — daily prune of expired cache rows
-- ════════════════════════════════════════════════════════════════════
create or replace function prune_data_source_cache()
returns void language plpgsql as $$
begin
  delete from data_source_cache where expires_at < now();
end;
$$;

-- Schedule daily at 3am UTC (will be activated when pg_cron is configured)
-- select cron.schedule('prune-data-source-cache', '0 3 * * *',
--   'select prune_data_source_cache()');
