-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — sources UNIQUE (user_id, type, url) constraint
-- ════════════════════════════════════════════════════════════════════
-- Surfaced 2026-05-16 during Phase 2.1 acceptance test (no commit yet).
--
-- Failure mode: /api/onboarding/finalize/route.ts upserts into
-- public.sources with `onConflict: "user_id,type,url"` to be defensive
-- against the same source being added twice (once manually, once via
-- the wizard). But the live schema only had UNIQUE (user_id, name) —
-- so the upsert blew up at runtime with Postgres 42P10
--   "there is no unique or exclusion constraint matching the
--    ON CONFLICT specification."
-- This is the exact drift class that VIBE Rule 35 gate 5 (column-drift
-- grep) doesn't catch: verify:columns confirms column names exist, but
-- it doesn't know which (col, col, ...) tuples have UNIQUE constraints.
-- Static TS happy, lint happy, runtime broken — caught only when the
-- first real user runs the wizard.
--
-- Fix: add the missing constraint to match the code's dedup intent.
-- One (user_id, type, url) triple per row; same URL across different
-- types (e.g. a webpage user lists as both rss + atom by mistake) still
-- allowed, since the route grouping logic dispatches per-type.
--
-- Idempotent — uses NOT EXISTS guard so re-running is safe.
-- ════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.sources'::regclass
      and conname = 'sources_user_id_type_url_key'
  ) then
    alter table public.sources
      add constraint sources_user_id_type_url_key
      unique (user_id, type, url);
  end if;
end$$;

comment on constraint sources_user_id_type_url_key on public.sources is
  'One (type, url) source per user. Matches /api/onboarding/finalize upsert key.';
