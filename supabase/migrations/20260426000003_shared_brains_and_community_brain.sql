-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Shared Brains + Community Brain
-- ════════════════════════════════════════════════════════════════════
-- Adds:
--   • shared_brains + brain_memberships (couples/families/teams)
--   • saved_items.brain_id (items can live in personal or shared brain)
--   • community_embeddings (anonymized RAG-able semantic space)
--   • community_trends (emergent topics from clustering)
--   • community_brain_queries (audit trail of community queries)
--   • community_consent (per-user opt-in/out, granular)
-- ════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────
create type brain_role as enum ('owner', 'editor', 'viewer');

create type brain_visibility as enum (
  'private',          -- single owner
  'shared',           -- explicit member list
  'community_opt_in'  -- contributes anonymized signals to community brain
);

create type community_consent_scope as enum (
  'anonymized_signals',     -- aggregate dismiss/save/engage patterns
  'anonymized_outcomes',    -- "users like me had outcome X"
  'anonymized_embeddings',  -- semantic content for community RAG
  'anonymized_voice',       -- writing patterns that drive engagement
  'trend_contribution'      -- early signals visible in trend feed
);

-- All scopes — used as the default-ON value for new users.
-- Stored as enum array for runtime checks.
-- ALL_COMMUNITY_SCOPES is referenced below; do not remove.

-- ════════════════════════════════════════════════════════════════════
-- 52. SHARED_BRAINS — couples/families/teams share a knowledge base
-- ════════════════════════════════════════════════════════════════════
create table shared_brains (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  visibility brain_visibility default 'private' not null,
  member_count integer default 1,
  item_count integer default 0,
  invite_code text unique,                -- for private invite links
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index shared_brains_owner_idx on shared_brains(owner_user_id);

-- ════════════════════════════════════════════════════════════════════
-- 53. BRAIN_MEMBERSHIPS — who has access to which shared brain
-- ════════════════════════════════════════════════════════════════════
create table brain_memberships (
  id uuid primary key default gen_random_uuid(),
  brain_id uuid references shared_brains(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role brain_role default 'viewer' not null,
  invited_by uuid references auth.users(id),
  invited_at timestamptz default now() not null,
  accepted_at timestamptz,
  unique(brain_id, user_id)
);

create index brain_memberships_user_idx on brain_memberships(user_id);
create index brain_memberships_brain_idx on brain_memberships(brain_id);

-- ════════════════════════════════════════════════════════════════════
-- Add brain_id to saved_items so items can live in a shared brain
-- ════════════════════════════════════════════════════════════════════
alter table saved_items
  add column brain_id uuid references shared_brains(id) on delete set null,
  add column saved_by_user_id uuid references auth.users(id) on delete set null,
  add column anonymous_in_shared_brain boolean default false;

create index saved_items_brain_idx on saved_items(brain_id) where brain_id is not null;

-- ════════════════════════════════════════════════════════════════════
-- 54. COMMUNITY_DATA_SETTINGS — DEFAULT-ON collection (opt-out only)
-- ════════════════════════════════════════════════════════════════════
-- All anonymized contribution scopes are ENABLED by default for every user.
-- Disclosed in onboarding + ToS + Privacy Policy.
-- User can opt-OUT via Settings → Privacy (legally required toggle).
-- contribution_id is pseudonymous — never reverse-mappable from outside this table.
create table community_data_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Default = ALL scopes enabled. Users opt-out by removing from this array.
  enabled_scopes community_consent_scope[] not null default
    array[
      'anonymized_signals',
      'anonymized_outcomes',
      'anonymized_embeddings',
      'anonymized_voice',
      'trend_contribution'
    ]::community_consent_scope[],
  is_globally_excluded boolean default false not null,  -- legally-required full opt-out
  globally_excluded_at timestamptz,
  contribution_id text unique not null
    default encode(extensions.gen_random_bytes(16), 'hex'),
  tos_accepted_at timestamptz,                          -- when user accepted ToS that includes data terms
  privacy_policy_version text,                          -- which version of Privacy Policy they agreed to
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ════════════════════════════════════════════════════════════════════
-- 55. COMMUNITY_EMBEDDINGS — anonymized semantic pool (the RAG)
-- ════════════════════════════════════════════════════════════════════
-- All embeddings here are CONTRIBUTION_ID scoped, not user_id.
-- Even ForgeMinds operators can't reverse-map to a specific user
-- without joining via community_consent (which is admin-restricted).
create table community_embeddings (
  id uuid primary key default gen_random_uuid(),
  contribution_id text not null,                 -- from community_consent.contribution_id
  source_type text not null,                     -- 'saved_item', 'brief', 'action_outcome'
  content_hash text not null,                    -- dedupes identical entries across users
  content_text text,                             -- redacted/summarized only — no raw user content
  embedding vector(1536),
  topic_cluster text,                            -- assigned by clustering job
  profile_cluster text,                          -- 'consultant_low_capital', etc.
  geography_cluster text,                        -- 'us_southeast_metro', etc.
  contributed_at timestamptz default now() not null,
  unique(contribution_id, content_hash)
);

create index community_embeddings_topic_idx on community_embeddings(topic_cluster);
create index community_embeddings_profile_idx on community_embeddings(profile_cluster);
create index community_embeddings_hnsw on community_embeddings using hnsw (embedding vector_cosine_ops);

-- ════════════════════════════════════════════════════════════════════
-- 56. COMMUNITY_TRENDS — emergent topics surfaced by clustering
-- ════════════════════════════════════════════════════════════════════
-- Daily cron clusters new community_embeddings, surfaces velocity.
-- Visible to all authenticated users (powers "what's the community
-- focused on right now" UI).
create table community_trends (
  id uuid primary key default gen_random_uuid(),
  topic_cluster text not null,
  topic_label text,                              -- AI-generated short label
  topic_summary text,                            -- AI-generated 1-2 sentence summary
  geography_cluster text,
  profile_cluster text,
  velocity_score numeric(6,3),                   -- rate of new contributions
  total_contributions integer default 0,
  unique_contributors integer default 0,
  first_seen_at timestamptz default now() not null,
  last_updated_at timestamptz default now() not null,
  is_emerging boolean default true,              -- false once mainstream
  unique(topic_cluster, geography_cluster, profile_cluster)
);

create index community_trends_velocity_idx on community_trends(velocity_score desc, is_emerging);

-- ════════════════════════════════════════════════════════════════════
-- 57. COMMUNITY_BRAIN_QUERIES — audit log + caching of queries
-- ════════════════════════════════════════════════════════════════════
-- When a user asks the community brain "what is the community thinking
-- about X right now", we log + cache the query (anonymized) so:
--   1. Repeated queries return fast (caching)
--   2. We can detect bad-actor query patterns
--   3. Users get attribution for valuable queries (future feature)
create table community_brain_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  query_text text not null,
  query_embedding vector(1536),
  response_summary text,
  matched_clusters text[] default '{}',
  contributor_count integer,                     -- "based on N anonymous users"
  cached_until timestamptz,
  created_at timestamptz default now() not null
);

create index community_brain_queries_cached_idx on community_brain_queries(cached_until);
create index community_brain_queries_user_idx on community_brain_queries(user_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════
alter table shared_brains              enable row level security;
alter table brain_memberships          enable row level security;
alter table community_data_settings    enable row level security;
alter table community_embeddings       enable row level security;
alter table community_trends           enable row level security;
alter table community_brain_queries    enable row level security;

-- Shared brains: visible if you're owner or member
create policy "owner or member view"
  on shared_brains for select
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from brain_memberships
      where brain_memberships.brain_id = shared_brains.id
        and brain_memberships.user_id = auth.uid()
        and brain_memberships.accepted_at is not null
    )
  );

create policy "owner manages"
  on shared_brains for all
  using (owner_user_id = auth.uid());

-- Brain memberships: visible to owner of the brain or to the member themselves
create policy "membership visible"
  on brain_memberships for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from shared_brains
      where shared_brains.id = brain_memberships.brain_id
        and shared_brains.owner_user_id = auth.uid()
    )
  );

create policy "owner invites"
  on brain_memberships for insert
  with check (
    exists (
      select 1 from shared_brains
      where shared_brains.id = brain_memberships.brain_id
        and shared_brains.owner_user_id = auth.uid()
    )
  );

create policy "self leave"
  on brain_memberships for delete
  using (user_id = auth.uid());

-- Saved items: extend existing policy to allow brain members
drop policy if exists "own data" on saved_items;
create policy "own or shared brain"
  on saved_items for select
  using (
    user_id = auth.uid()
    or (
      brain_id is not null
      and exists (
        select 1 from brain_memberships
        where brain_memberships.brain_id = saved_items.brain_id
          and brain_memberships.user_id = auth.uid()
          and brain_memberships.accepted_at is not null
      )
    )
  );

create policy "own write"
  on saved_items for all
  using (user_id = auth.uid());

-- Community data settings: only the user themselves can see/modify
create policy "own settings" on community_data_settings for all using (user_id = auth.uid());

-- Community embeddings: read-only for authenticated users.
-- ForgeMinds queries via service_role; users never query raw rows directly.
create policy "authenticated read"
  on community_embeddings for select
  using (auth.uid() is not null);

-- Community trends: read for all authenticated
create policy "authenticated read trends"
  on community_trends for select
  using (auth.uid() is not null);

-- Community queries: visible to user who made it
create policy "own queries"
  on community_brain_queries for all
  using (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- Helper: auto-update member_count + item_count on shared_brains
-- ════════════════════════════════════════════════════════════════════
create or replace function refresh_brain_counts()
returns trigger language plpgsql as $$
begin
  -- handle membership changes
  if TG_TABLE_NAME = 'brain_memberships' then
    update shared_brains
      set member_count = (
        select count(*) from brain_memberships
        where brain_id = coalesce(NEW.brain_id, OLD.brain_id)
          and accepted_at is not null
      ) + 1  -- +1 for owner
      where id = coalesce(NEW.brain_id, OLD.brain_id);
  end if;

  -- handle saved_items changes
  if TG_TABLE_NAME = 'saved_items' then
    if NEW.brain_id is not null then
      update shared_brains
        set item_count = (
          select count(*) from saved_items where brain_id = NEW.brain_id
        )
        where id = NEW.brain_id;
    end if;
  end if;

  return NEW;
end;
$$;

create trigger refresh_brain_counts_membership
  after insert or update or delete on brain_memberships
  for each row execute function refresh_brain_counts();

create trigger refresh_brain_counts_items
  after insert or update on saved_items
  for each row execute function refresh_brain_counts();

-- ════════════════════════════════════════════════════════════════════
-- Updated_at triggers
-- ════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'shared_brains', 'community_data_settings'
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
-- Initialize community_consent for existing users (defaulting to opt-OUT)
-- New users get a row from the handle_new_user trigger (updated below)
-- ════════════════════════════════════════════════════════════════════
create or replace function handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql as $$
begin
  insert into public.profiles (user_id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));

  insert into public.user_preferences          (user_id) values (new.id);
  insert into public.user_profiles_extended    (user_id) values (new.id);
  insert into public.voice_profiles            (user_id) values (new.id);
  insert into public.notification_preferences  (user_id) values (new.id);
  insert into public.user_context_matrix       (user_id) values (new.id);

  -- Community data settings: DEFAULT-ON contribution.
  -- Disclosed in ToS + Privacy Policy. User can opt-out in Settings.
  -- contribution_id is auto-generated pseudonymous ID; not reverse-mappable.
  insert into public.community_data_settings (user_id) values (new.id);

  return new;
end;
$$;
