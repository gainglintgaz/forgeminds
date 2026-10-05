-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1 cleanup: extend user_preferences with
-- pagination + batch-size columns to remove hardcoded literals
-- ════════════════════════════════════════════════════════════════════
-- Audit finding (phase-1-audit-2026-05-04, Blocker 6): four .limit(...)
-- values were hardcoded across cron routes + UI pages, violating
-- VIBE Rule 55 (every UX-affecting value is per-user-configurable from
-- day 1):
--
--   src/app/api/cron/score/route.ts:59       .limit(100)  // articles per tick
--   src/app/api/cron/deliver/route.ts:123    .limit(20)   // briefs per tick
--   src/app/(dashboard)/briefs/page.tsx:38   .limit(30)   // brief list page
--   src/app/(dashboard)/dashboard/page.tsx   .limit(50)   // feed page
--
-- All four added here as per-user prefs. Defaults match the prior
-- hardcoded values, so existing users keep current behavior.
-- ════════════════════════════════════════════════════════════════════

alter table public.user_preferences
  add column if not exists score_batch_size       integer not null default 100
    check (score_batch_size between 1 and 500),
  add column if not exists deliver_batch_size     integer not null default 20
    check (deliver_batch_size between 1 and 100),
  add column if not exists briefs_page_size       integer not null default 30
    check (briefs_page_size between 5 and 200),
  add column if not exists dashboard_feed_size    integer not null default 50
    check (dashboard_feed_size between 5 and 500);

comment on column public.user_preferences.score_batch_size     is 'Max articles processed per /api/cron/score tick. Higher = more thorough catch-up but bigger LLM cost per tick.';
comment on column public.user_preferences.deliver_batch_size   is 'Max briefs sent per /api/cron/deliver tick. Limits Resend API throughput and protects against accidental flood.';
comment on column public.user_preferences.briefs_page_size     is 'Number of briefs shown per page on /briefs. UX-only.';
comment on column public.user_preferences.dashboard_feed_size  is 'Number of articles shown on the /dashboard feed page. UX-only.';
