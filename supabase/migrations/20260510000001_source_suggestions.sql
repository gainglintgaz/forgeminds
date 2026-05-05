-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1.5: source_suggestions (AI proposals awaiting
--                          user confirmation)
-- ════════════════════════════════════════════════════════════════════
-- The conversational onboarding agent (and the post-onboarding source-
-- advisor cron) propose sources for users. Proposals stay in this table
-- until the user clicks "add" or "dismiss" — they are NOT auto-added to
-- `sources`.
--
-- Why a separate table (not just a UI in-memory list):
--   - Proposals come from multiple paths: onboarding agent (live),
--     weekly source-advisor cron (background), source-health daily cron
--     (replacements for broken feeds). All write to the same place.
--   - User might dismiss the dialog and re-open it later — proposals
--     should still be there.
--   - Audit trail: "why did the agent suggest this?" is answerable
--     because we store the reason + proposal_source.
--
-- RLS: own data. Each user sees only their own suggestions.
-- ════════════════════════════════════════════════════════════════════

-- ─── Enum: where the suggestion originated from ───────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'suggestion_source') then
    create type public.suggestion_source as enum (
      'onboarding_agent',     -- conversational agent during /onboarding/*
      'sidebar_chat',         -- post-onboarding chat advisor on /sources
      'weekly_advisor_cron',  -- forgeminds_source_advisor_weekly
      'health_check_cron',    -- forgeminds_source_health_daily (replacement for broken feed)
      'manual'                -- user typed "find me sources about X"
    );
  end if;
end$$;

-- ─── Enum: lifecycle status ───────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'suggestion_status') then
    create type public.suggestion_status as enum (
      'pending',    -- awaiting user decision
      'accepted',   -- user clicked "add" → row written to sources
      'dismissed',  -- user clicked "no thanks"
      'expired'     -- aged out (default 30 days), reduced as agent learns
    );
  end if;
end$$;

-- ─── Table ────────────────────────────────────────────────────────────
create table if not exists public.source_suggestions (
  id                  uuid primary key default gen_random_uuid(),

  -- Owner. Always the authenticated user the suggestion was generated for.
  user_id             uuid not null references auth.users(id) on delete cascade,

  -- Pointer into source_catalog if this is a curated entry. NULL when
  -- the source-validator subagent has approved a user-submitted custom
  -- URL (those go straight to sources, but the proposal stays here for
  -- audit).
  catalog_id          uuid references public.source_catalog(id) on delete set null,

  -- Denormalized snapshot of what the user is being shown. We store
  -- these explicitly (instead of always joining catalog_id) so the UI
  -- displays the proposal exactly as the agent meant it, even if the
  -- catalog row gets updated later.
  name                text not null,
  description         text not null,
  url                 text not null,
  type                public.source_type not null,
  paywall_tier        public.paywall_tier not null default 'free',
  paywall_cost_usd_monthly numeric(8,2),

  -- Why was this suggested? Plain-language reason the agent gives the
  -- user, e.g. "You mentioned biotech and want depth, so I'm suggesting
  -- Nature Medicine over headlines."
  reason              text not null,

  -- Provenance + lifecycle
  proposal_source     public.suggestion_source not null,
  status              public.suggestion_status  not null default 'pending',
  resulting_source_id uuid references public.sources(id) on delete set null,
                                              -- set when user accepts and
                                              -- the row is created in sources

  -- Score the agent assigned (0-1) — used to rank proposals in the UI
  -- when there are many. Computed by the catalog-rag step from the
  -- semantic similarity score of (user_intent_embedding, catalog.embedding).
  rank_score          numeric(4,3) check (rank_score between 0 and 1),

  -- Lifecycle
  created_at          timestamptz not null default now(),
  decided_at          timestamptz,
  expires_at          timestamptz not null default (now() + interval '30 days'),

  -- (Uniqueness for "no two pending suggestions of the same catalog row
  -- per user" enforced by a partial unique index below — avoids needing
  -- the btree_gist extension that EXCLUDE ... USING GIST would require.)
  constraint source_suggestions_paywall_cost_nonneg
    check (paywall_cost_usd_monthly is null or paywall_cost_usd_monthly >= 0)
);

-- A user shouldn't see the same catalog entry suggested twice with
-- pending status. Once dismissed, the same catalog_id can be re-
-- proposed later (different reason, different topic).
create unique index if not exists source_suggestions_unique_pending_per_user
  on public.source_suggestions (user_id, catalog_id)
  where status = 'pending' and catalog_id is not null;

comment on table public.source_suggestions is
  'AI-generated source proposals awaiting user confirmation. Written by onboarding agent + advisor crons. Read by /onboarding and /sources UI.';

-- ─── Indexes ──────────────────────────────────────────────────────────
create index if not exists source_suggestions_user_status_idx
  on public.source_suggestions (user_id, status, created_at desc);

create index if not exists source_suggestions_pending_expires_idx
  on public.source_suggestions (expires_at)
  where status = 'pending';

create index if not exists source_suggestions_proposal_source_idx
  on public.source_suggestions (proposal_source, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table public.source_suggestions enable row level security;

-- Users see + manage only their own suggestions.
drop policy if exists "source_suggestions_select_own" on public.source_suggestions;
create policy "source_suggestions_select_own"
  on public.source_suggestions for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "source_suggestions_update_own" on public.source_suggestions;
create policy "source_suggestions_update_own"
  on public.source_suggestions for update
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSERT comes from server-side routes (onboarding API + crons), which
-- run as service_role. No client INSERT policy = clients cannot fabricate
-- proposals.

-- DELETE is service_role only (cleanup of expired rows). Users dismiss
-- via UPDATE (status='dismissed'), they don't DELETE.

-- ─── Grants ───────────────────────────────────────────────────────────
grant select, update on public.source_suggestions to authenticated;
grant all            on public.source_suggestions to service_role;

-- ─── Trigger: maintain decided_at on status change ────────────────────
create or replace function public.set_decided_at_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if NEW.status is distinct from OLD.status
     and NEW.status in ('accepted', 'dismissed', 'expired') then
    NEW.decided_at := coalesce(NEW.decided_at, now());
  end if;
  return NEW;
end;
$$;

revoke execute on function public.set_decided_at_on_status_change() from anon, authenticated, public;
grant  execute on function public.set_decided_at_on_status_change() to service_role;

create trigger source_suggestions_set_decided_at
  before update on public.source_suggestions
  for each row execute function public.set_decided_at_on_status_change();
