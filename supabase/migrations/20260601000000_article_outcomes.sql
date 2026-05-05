-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 2 prep: article_outcomes (per-user-per-article state)
-- ════════════════════════════════════════════════════════════════════
-- Heart of the personal flywheel per .claude/rules/data-flywheel.md §3
-- + §9 Phase A. One row per (user, article). Upserted on every
-- save/dismiss/rate action from the brief view.
--
-- The companion event stream lives in `behavioral_events` (existing,
-- migration 20260426000004). article_outcomes is the deduped current
-- state.
--
-- Why both tables:
--   - behavioral_events = WHAT HAPPENED, WHEN, IN WHAT SESSION
--     (event stream, append-only, useful for time-context analytics
--     and session reconstruction)
--   - article_outcomes = HOW USER FEELS ABOUT THIS ARTICLE NOW
--     (deduped per (user, article) pair, the input to per-user
--     scoring weights starting at Phase 2)
--
-- The shape mirrors the universal pattern from
-- .claude/rules/data-flywheel.md §3.
--
-- Phase 2 prep status (2026-05-05): committed as wip(phase-2): so the
-- save/dismiss/rate UI in /briefs/[id] can land alongside. NOT applied
-- to the dev DB until Phase 2 starts (after Phase 1.0 + 1.5 close).
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

  -- Universal pattern from data-flywheel.md §3: one row per
  -- (user, article). Re-clicking save/dismiss upserts onto this.
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

-- service_role retains full access (for Phase 2 cron jobs that
-- aggregate outcomes into per-user scoring weights).
grant all on public.article_outcomes to service_role;
grant select, insert, update on public.article_outcomes to authenticated;

-- ─── updated_at maintenance ──────────────────────────────────────────
-- Reuse public.set_updated_at() (already pinned to search_path =
-- public, pg_temp in 20260504000001_security_advisor_fixes).
drop trigger if exists article_outcomes_set_updated_at on public.article_outcomes;
create trigger article_outcomes_set_updated_at
  before update on public.article_outcomes
  for each row execute function public.set_updated_at();

-- ─── Upsert RPC (recommended path; client uses this not raw .upsert) ──
-- Why an RPC instead of letting the client do .upsert() directly:
--   1. Single place to fan out to behavioral_events (track_event) so
--      the EVENT side of the story is captured atomically with the
--      STATE side.
--   2. SECURITY DEFINER lets the function call track_event() (which
--      runs in caller's RLS context) cleanly.
--   3. One round-trip from the browser instead of two.
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
  -- passes null for a field — supports partial updates (e.g. user
  -- clicks Save first, rates 1-5 second).
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

  -- Mirror to event stream — supports time-context analytics and
  -- per-session aggregations downstream. Uses existing track_event()
  -- RPC from migration 20260426000004 (already pinned + locked to
  -- authenticated).
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

-- Lock execution down. Authenticated users call from /briefs/[id]
-- save/dismiss/rate buttons. service_role can call for backfills.
revoke execute on function public.upsert_article_outcome(
  uuid, uuid, public.article_outcome_kind, smallint, boolean, boolean, integer, text, jsonb
) from anon, public;
grant execute on function public.upsert_article_outcome(
  uuid, uuid, public.article_outcome_kind, smallint, boolean, boolean, integer, text, jsonb
) to authenticated, service_role;

-- ─── Verification (paste in SQL editor after applying) ───────────────
--
--   -- Confirm table exists + RLS on:
--   select relname, relrowsecurity from pg_class
--   where relname = 'article_outcomes';
--   -- expect: 1 row, relrowsecurity = true
--
--   -- Confirm RPC exists with pinned search_path:
--   select proname, proconfig from pg_proc
--   where proname = 'upsert_article_outcome'
--     and pronamespace = 'public'::regnamespace;
--   -- proconfig should show {search_path=public, pg_temp}
--
--   -- Confirm anon cannot execute RPC:
--   select has_function_privilege('anon',
--     'public.upsert_article_outcome(uuid, uuid, public.article_outcome_kind, smallint, boolean, boolean, integer, text, jsonb)'::regprocedure,
--     'EXECUTE');
--   -- expect: false
--
--   -- Confirm authenticated CAN execute:
--   select has_function_privilege('authenticated',
--     'public.upsert_article_outcome(uuid, uuid, public.article_outcome_kind, smallint, boolean, boolean, integer, text, jsonb)'::regprocedure,
--     'EXECUTE');
--   -- expect: true
--
--   -- Smoke test as authenticated test user (in SQL editor with role
--   -- swap, or via JS SDK signed in):
--   select public.upsert_article_outcome(
--     '<a real article uuid>'::uuid,
--     '<a real brief uuid>'::uuid,
--     'saved'::public.article_outcome_kind,
--     5::smallint, true, true, 120
--   );
--   -- Confirm: 1 row in article_outcomes for (auth.uid(), article_id)
--   --          1 new row in behavioral_events with event_type='article_save'
