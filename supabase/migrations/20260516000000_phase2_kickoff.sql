-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 2 kickoff
-- ════════════════════════════════════════════════════════════════════
-- Closes the two WARN items from the Phase 1.5 audit
-- (.claude/checklists/phase-1-5-audit-2026-05-15.md §B) and lands the
-- per-user-per-article state table that the brief view will write to.
--
-- Three changes, all idempotent:
--   1. CREATE TABLE article_outcomes (+ enum, indexes, RLS, RPC, trigger).
--      Per-(user, article) deduped state — heart of the personal flywheel
--      per .claude/rules/data-flywheel.md §3 + §9 Phase A. Companion to
--      the existing behavioral_events stream (which stays append-only
--      for time-context analytics).
--   2. ALTER source_suggestions ADD prompt_version (TEXT, nullable) —
--      closes Phase 1.5 audit §B warn #1 (AI-output rows need
--      prompt_version per VIBE Rule 54).
--   3. ALTER source_suggestions ADD updated_at (TIMESTAMPTZ DEFAULT now())
--      + trigger reusing public.set_updated_at() — closes §B warn #2.
--
-- This file SUPERSEDES the 20260601000000_article_outcomes.sql draft
-- (file-only, never applied) — that filename moved earlier in time to
-- land alongside the source_suggestions audit-column fixes as a single
-- Phase 2 kickoff migration.
-- ════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════
-- 1. article_outcomes
-- ════════════════════════════════════════════════════════════════════

-- ─── Enum: outcome kind ──────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'article_outcome_kind') then
    create type public.article_outcome_kind as enum (
      'saved',          -- user marked the article worth keeping
      'dismissed',      -- user marked the article not worth their time
      'no_action',      -- viewed but no explicit signal (default)
      'action_taken'    -- user took an action template from this article (Phase 3+)
    );
  end if;
end$$;

-- ─── Table ───────────────────────────────────────────────────────────
create table if not exists public.article_outcomes (
  outcome_id          uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  article_id          uuid not null references public.raw_articles(id) on delete cascade,
  brief_id            uuid references public.briefs(id) on delete set null,
                                              -- which brief surfaced the article
  outcome             public.article_outcome_kind not null default 'no_action',
  rating              smallint check (rating between 1 and 5),
  worth_it            boolean,                -- the single most-important field
                                              -- per data-flywheel.md §3
  would_repeat        boolean,                -- "would I want more like this?"
  time_spent_seconds  integer
    check (time_spent_seconds between 0 and 86400),
                                              -- 0 to 24h sanity check
  triggered_action    boolean not null default false,
                                              -- did this article cause an action plan?
  notes               text,                   -- private free-text
  context             jsonb not null default '{}'::jsonb,
                                              -- domain context: device, time-of-day,
                                              -- referrer, mood (optional)
  prompt_version      text,                   -- for outcomes derived from AI-tagged
                                              -- recommendations; nullable for direct
                                              -- user actions
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One row per (user, article). Re-clicking save/dismiss upserts here.
  constraint article_outcomes_user_article_uq unique (user_id, article_id)
);

comment on table public.article_outcomes is
  'Per-(user, article) deduped outcome state. Phase 2+: input to per-user scoring weights. See .claude/rules/data-flywheel.md §3.';

-- ─── Indexes ─────────────────────────────────────────────────────────
create index if not exists article_outcomes_user_idx
  on public.article_outcomes (user_id, updated_at desc);

create index if not exists article_outcomes_article_idx
  on public.article_outcomes (article_id);

create index if not exists article_outcomes_brief_idx
  on public.article_outcomes (brief_id)
  where brief_id is not null;

-- Hot path: "what has this user saved recently" (Brain Phase 4 input)
create index if not exists article_outcomes_saved_idx
  on public.article_outcomes (user_id, updated_at desc)
  where outcome = 'saved';

-- ─── RLS: owner-only, private ────────────────────────────────────────
alter table public.article_outcomes enable row level security;

drop policy if exists "article_outcomes_owner_all" on public.article_outcomes;
create policy "article_outcomes_owner_all"
  on public.article_outcomes for all
  to authenticated
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- service_role retains full access (Phase 2 cron jobs that aggregate
-- outcomes into per-user scoring weights).
grant all on public.article_outcomes to service_role;
grant select, insert, update on public.article_outcomes to authenticated;

-- ─── updated_at maintenance ──────────────────────────────────────────
-- Reuse public.set_updated_at() (pinned to search_path = public, pg_temp
-- in 20260504000001_security_advisor_fixes).
drop trigger if exists article_outcomes_set_updated_at on public.article_outcomes;
create trigger article_outcomes_set_updated_at
  before update on public.article_outcomes
  for each row execute function public.set_updated_at();

-- ─── Upsert RPC ──────────────────────────────────────────────────────
-- Single round-trip from the browser. Atomically writes the state row
-- AND mirrors to behavioral_events via track_event() — keeps the EVENT
-- story (append-only stream) in sync with the STATE story (deduped row).
create or replace function public.upsert_article_outcome(
  p_article_id          uuid,
  p_brief_id            uuid default null,
  p_outcome             public.article_outcome_kind default null,
  p_rating              smallint default null,
  p_worth_it            boolean default null,
  p_would_repeat        boolean default null,
  p_time_spent_seconds  integer default null,
  p_notes               text default null,
  p_context             jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outcome_id uuid;
  v_event_type public.behavioral_event_type;
begin
  if auth.uid() is null then
    raise exception 'upsert_article_outcome requires authenticated user';
  end if;

  -- Upsert outcome row. Coalesce keeps existing values when caller
  -- passes null for a field — supports partial updates.
  insert into public.article_outcomes (
    user_id, article_id, brief_id, outcome, rating,
    worth_it, would_repeat, time_spent_seconds, notes, context
  ) values (
    auth.uid(), p_article_id, p_brief_id,
    coalesce(p_outcome, 'no_action'),
    p_rating, p_worth_it, p_would_repeat,
    p_time_spent_seconds, p_notes, coalesce(p_context, '{}'::jsonb)
  )
  on conflict (user_id, article_id) do update set
    brief_id = coalesce(excluded.brief_id, public.article_outcomes.brief_id),
    outcome = case
      -- 'no_action' is the default — don't let it overwrite a real
      -- outcome from a prior call that set 'saved' or 'dismissed'.
      when excluded.outcome = 'no_action' then public.article_outcomes.outcome
      else excluded.outcome
    end,
    rating = coalesce(excluded.rating, public.article_outcomes.rating),
    worth_it = coalesce(excluded.worth_it, public.article_outcomes.worth_it),
    would_repeat = coalesce(excluded.would_repeat, public.article_outcomes.would_repeat),
    time_spent_seconds = coalesce(excluded.time_spent_seconds, public.article_outcomes.time_spent_seconds),
    notes = coalesce(excluded.notes, public.article_outcomes.notes),
    context = public.article_outcomes.context || excluded.context,
    updated_at = now()
  returning outcome_id into v_outcome_id;

  -- Mirror to event stream.
  v_event_type := case p_outcome
    when 'saved'        then 'article_save'::public.behavioral_event_type
    when 'dismissed'    then 'article_dismiss'::public.behavioral_event_type
    when 'action_taken' then 'template_accepted'::public.behavioral_event_type
    else 'article_view'::public.behavioral_event_type
  end;

  perform public.track_event(
    p_event_type := v_event_type,
    p_article_id := p_article_id,
    p_brief_id   := p_brief_id,
    p_duration_ms := case
      when p_time_spent_seconds is not null
      then p_time_spent_seconds * 1000
      else null
    end,
    p_metadata := jsonb_build_object(
      'outcome_id', v_outcome_id,
      'rating', p_rating,
      'worth_it', p_worth_it,
      'would_repeat', p_would_repeat
    )
  );

  return v_outcome_id;
end;
$$;

revoke execute on function public.upsert_article_outcome(
  uuid, uuid, public.article_outcome_kind, smallint, boolean, boolean, integer, text, jsonb
) from anon, public;
grant execute on function public.upsert_article_outcome(
  uuid, uuid, public.article_outcome_kind, smallint, boolean, boolean, integer, text, jsonb
) to authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════
-- 2 + 3. source_suggestions: prompt_version + updated_at
-- ════════════════════════════════════════════════════════════════════
-- Closes Phase 1.5 audit §B warnings. Both columns nullable so the
-- ALTER is online-safe per .claude/rules/migration-strategy.md §3
-- (`ADD COLUMN ... NULL` with no default is instant in all Postgres
-- versions).

alter table public.source_suggestions
  add column if not exists prompt_version text;

comment on column public.source_suggestions.prompt_version is
  'AI prompt template version that produced this suggestion. Required for AI-generated rows per VIBE Rule 54. NULL for legacy rows.';

alter table public.source_suggestions
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists source_suggestions_set_updated_at on public.source_suggestions;
create trigger source_suggestions_set_updated_at
  before update on public.source_suggestions
  for each row execute function public.set_updated_at();

-- ─── Verification (paste in SQL editor after applying) ───────────────
--
--   -- article_outcomes RLS on:
--   select relname, relrowsecurity from pg_class where relname = 'article_outcomes';
--
--   -- source_suggestions has both new columns:
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema='public' and table_name='source_suggestions'
--     and column_name in ('prompt_version', 'updated_at');
