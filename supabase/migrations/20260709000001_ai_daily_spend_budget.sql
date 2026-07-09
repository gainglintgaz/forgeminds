-- H1 fix 4 — daily AI budget cap (docs/architecture/curation-hardening-vra.md
-- §7 assumptions 5-8, founder-approved 2026-07-09).
--
-- No circuit breaker exists today for a runaway AI bill. Adds a real
-- per-user column (VIBE Rule 55 — never a hardcoded "system default"
-- literal) for the daily cap, plus a small single-purpose table for the
-- atomic spend tally: `ai_daily_spend` exists specifically because summing
-- pipeline_runs.metadata->>'cost_estimate_usd' (unindexed JSONB) on every
-- route invocation doesn't scale past dogfood and gives no atomic-increment
-- primitive for the concurrent-tick race (two overlapping dispatcher ticks
-- both tallying spend near the cap). Reusing user_preferences (one row per
-- user, no date dimension) would need fragile reset-at-midnight logic on
-- every read instead — this is the minimal correct answer, not a scope
-- creep past "reuse existing columns" (architecture §7 assumption 8).
--
-- Additive only — no drops, no destructive ops.

-- ════════════════════════════════════════════════════════════════════
-- user_preferences: real per-user budget column, sane default
-- ════════════════════════════════════════════════════════════════════
alter table public.user_preferences
  add column if not exists daily_ai_budget_usd_cents integer not null default 50;

comment on column public.user_preferences.daily_ai_budget_usd_cents is
  'Daily cap on real AI spend (score + generate share ONE pool), in USD '
  'cents. Default 50c/day — recommend re-checking against observed spend '
  '(architecture §7 assumption 5) before raising/lowering per user. A '
  'Settings UI to edit this is explicitly deferred (architecture §8); the '
  'column exists with a real default the day it ships, satisfying VIBE '
  'Rule 55 even before any UI exists to edit it.';

-- ════════════════════════════════════════════════════════════════════
-- ai_daily_spend: atomic per-user-per-day spend tally
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.ai_daily_spend (
  user_id uuid not null references auth.users(id) on delete cascade,
  spend_date date not null,
  spent_cents integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, spend_date)
);

comment on table public.ai_daily_spend is
  'Atomic daily AI-spend tally per user (H1 fix 4). Incremented post-hoc, '
  'AFTER each real AI call, from routeAIRequest()''s actual costEstimateUsd '
  '— never estimated in advance (the router has no pre-call cost '
  'estimator). Entry-gate + post-hoc tally design (not full pre-reservation) '
  '— a single run can overshoot the cap by up to that run''s own spend '
  'before the NEXT tick''s entry gate refuses; bounded and self-correcting.';

alter table public.ai_daily_spend enable row level security;
create policy "own data" on public.ai_daily_spend for all using (user_id = (select auth.uid()));

-- ════════════════════════════════════════════════════════════════════
-- increment_ai_spend() — atomic upsert-increment, avoids the app-layer
-- read-modify-write race across two overlapping dispatcher ticks (Hostile
-- Architect finding — same class of race sweep_stale_pipeline_runs.sql
-- already guards against for pipeline_runs).
-- ════════════════════════════════════════════════════════════════════
create or replace function public.increment_ai_spend(
  p_user_id uuid,
  p_spend_date date,
  p_cents integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_total integer;
begin
  insert into public.ai_daily_spend (user_id, spend_date, spent_cents, updated_at)
  values (p_user_id, p_spend_date, greatest(p_cents, 0), now())
  on conflict (user_id, spend_date) do update
    set spent_cents = public.ai_daily_spend.spent_cents + greatest(p_cents, 0),
        updated_at = now()
  returning spent_cents into v_new_total;
  return v_new_total;
end;
$$;

grant execute on function public.increment_ai_spend(uuid, date, integer) to service_role;
revoke execute on function public.increment_ai_spend(uuid, date, integer) from public, anon, authenticated;

-- Prune rows older than 35 days (data-integrity.md's stale-data pattern, per
-- architecture §6 scale assumptions) — keeps the table small at 10K users;
-- follows the SAME schedule-every-N-minutes idempotent-reschedule pattern as
-- the existing sweep_stale_pipeline_runs.sql cron job.
create or replace function private.prune_ai_daily_spend()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  pruned integer;
begin
  delete from public.ai_daily_spend where spend_date < (current_date - interval '35 days');
  get diagnostics pruned = row_count;
  return pruned;
end;
$$;

grant execute on function private.prune_ai_daily_spend() to service_role;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'forgeminds_prune_ai_daily_spend';
exception when others then null;
end $$;

select cron.schedule(
  'forgeminds_prune_ai_daily_spend',
  '0 4 * * *', -- daily at 4am UTC
  $$select private.prune_ai_daily_spend();$$
);
