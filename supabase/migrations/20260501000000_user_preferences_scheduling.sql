-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1: extend user_preferences with scheduling + window knobs
-- ════════════════════════════════════════════════════════════════════
-- Captures the per-user-from-day-1 principle (factory CLAUDE.md §17,
-- VIBE Rule 55): every value that affects user experience lives in a
-- per-user settings column with a sensible default — never as a
-- hardcoded literal in code.
--
-- These columns drive the cron dispatcher (migration 20260501000001) and
-- the cron route handlers (src/app/api/cron/*). When code wants to know
-- "how long is the recency window," it reads `recency_window_minutes`
-- from this row, not a constant.
--
-- All defaults match the values that were previously hardcoded in code,
-- so existing users (and the system pipeline) keep working unchanged.
-- ════════════════════════════════════════════════════════════════════

alter table public.user_preferences
  add column if not exists timezone              text     not null default 'America/New_York',
  add column if not exists cadence_minutes       integer  not null default 30
    check (cadence_minutes in (15, 30, 60, 120, 240, 360, 720, 1440)),
  add column if not exists active_hours_start    integer  not null default 7
    check (active_hours_start between 0 and 23),
  add column if not exists active_hours_end      integer  not null default 23
    check (active_hours_end between 0 and 23),
  add column if not exists active_days           text[]   not null default '{mon,tue,wed,thu,fri}',
  add column if not exists recency_window_minutes integer not null default 120
    check (recency_window_minutes between 1 and 10080),     -- 1 min .. 1 week
  add column if not exists score_lookback_minutes integer not null default 240
    check (score_lookback_minutes between 1 and 10080),
  add column if not exists min_composite_score   numeric(4,3) not null default 0.45
    check (min_composite_score between 0 and 1),
  add column if not exists max_articles_per_brief integer not null default 15
    check (max_articles_per_brief between 1 and 100),
  add column if not exists max_per_category      integer  not null default 3
    check (max_per_category between 1 and 50),
  add column if not exists max_per_entity        integer  not null default 2
    check (max_per_entity between 1 and 50),
  add column if not exists last_run_at_by_step   jsonb    not null default '{}'::jsonb;
-- last_run_at_by_step example shape:
--   {
--     "ingest":   "2026-04-30T13:00:00Z",
--     "score":    "2026-04-30T13:05:00Z",
--     "curate":   "2026-04-30T13:10:00Z",
--     "enrich":   "2026-04-30T13:15:00Z",
--     "generate": "2026-04-30T13:20:00Z",
--     "deliver":  "2026-04-30T13:25:00Z"
--   }
-- The dispatcher reads this to enforce cadence per-user without a separate
-- pipeline_runs join.

-- ─── active_days CHECK ────────────────────────────────────────────────
-- Constrain to the 7 valid day-of-week tokens (lowercase 3-letter form
-- matches what the dispatcher's day-name lookup produces).
alter table public.user_preferences
  drop constraint if exists user_preferences_active_days_check;
alter table public.user_preferences
  add constraint user_preferences_active_days_check
  check (active_days <@ array['mon','tue','wed','thu','fri','sat','sun']);

-- ─── Index for the dispatcher's hot path ──────────────────────────────
-- The dispatcher runs every minute and needs to find users whose schedule
-- matches NOW. An index on (user_id) is already implicit (it's the PK).
-- Add a small partial index for scenarios where most users have a non-default
-- cadence — keeps the table scan fast even at thousands of users.
create index if not exists user_preferences_cadence_idx
  on public.user_preferences (cadence_minutes);

-- ─── Comment on columns for self-documenting schema ───────────────────
comment on column public.user_preferences.timezone               is 'IANA timezone (America/New_York). Drives "now in user tz" calc in dispatcher.';
comment on column public.user_preferences.cadence_minutes        is 'Minimum minutes between consecutive pipeline runs for this user. Allowed: 15, 30, 60, 120, 240, 360, 720, 1440.';
comment on column public.user_preferences.active_hours_start     is 'Hour-of-day (0-23, in user timezone) when pipeline is allowed to start. Inclusive.';
comment on column public.user_preferences.active_hours_end       is 'Hour-of-day (0-23) when pipeline must stop. Inclusive.';
comment on column public.user_preferences.active_days            is 'Array of day tokens (mon..sun) when pipeline runs. Default weekdays.';
comment on column public.user_preferences.recency_window_minutes is 'Ingest dedup horizon. Articles older than this are filtered out.';
comment on column public.user_preferences.score_lookback_minutes is 'Score step grabs unscored raw_articles created within this window.';
comment on column public.user_preferences.min_composite_score    is 'Articles below this composite score (0-1) do not enter the brief.';
comment on column public.user_preferences.max_articles_per_brief is 'Maximum stories per brief.';
comment on column public.user_preferences.max_per_category       is 'Max stories from any single diversity_category in one brief.';
comment on column public.user_preferences.max_per_entity         is 'Max stories about any single entity in one brief.';
comment on column public.user_preferences.last_run_at_by_step    is 'Last successful invocation per pipeline step. Read by dispatcher for cadence.';
