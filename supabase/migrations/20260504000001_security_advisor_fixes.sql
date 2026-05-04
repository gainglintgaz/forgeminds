-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1 close-out: Supabase advisor security fixes
-- ════════════════════════════════════════════════════════════════════
-- Phase 1 audit (manual step) ran the Supabase Advisor → Security tab and
-- surfaced 16 WARN-level findings. This migration clears 13 of them. The
-- remaining 3 (`extension_in_public` for pg_trgm/vector/pg_net) require a
-- dedicated migration that moves extensions out of `public` — deferred to
-- Phase 2 cleanup with a tracking entry in DECISIONS.md.
--
-- The 16th finding (`auth_leaked_password_protection`) is a Supabase
-- Dashboard toggle, not a SQL fix — Victor enables it manually in
-- Auth settings → Password protection.
--
-- Findings cleared by this migration:
--
--   Group A — function_search_path_mutable (4 fns)
--     - public.prune_old_behavioral_events
--     - public.refresh_brain_counts
--     - public.set_updated_at
--     - public.prune_data_source_cache
--   Each is SECURITY DEFINER without `SET search_path`. Without an explicit
--   search_path, a privileged user could be tricked into running a
--   malicious function injected via the role's search_path (CVE-class:
--   search_path injection in SECURITY DEFINER).
--
--   Groups C + D — public can execute SECURITY DEFINER (4 fns × 2 roles)
--     - public.forgeminds_columns()    (used by verify-columns.ts only)
--     - public.forgeminds_rls_state()  (used by verify-rls.ts only)
--     - public.handle_new_user()       (auth trigger, not REST endpoint)
--     - public.track_event(...)        (behavioral tracking — kept for authenticated)
--   These were callable via /rest/v1/rpc/<fn> by both anon and authenticated
--   roles. forgeminds_columns + forgeminds_rls_state + handle_new_user
--   are NEVER intended for client-side calls; revoke from both roles.
--   track_event IS client-callable but should require authentication;
--   revoke anon, keep authenticated.
--
-- Idempotent: ALTER FUNCTION SET and REVOKE are safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- ─── Group A: pin search_path on SECURITY DEFINER functions ──────────
-- Each ALTER pins search_path to `public, pg_temp` so the function looks
-- up tables/types only from public + tmp, ignoring the caller's role
-- search_path entirely. This is the standard remediation Supabase docs
-- recommend (https://supabase.com/docs/guides/database/database-linter?lint=0011).

alter function public.prune_old_behavioral_events()
  set search_path = public, pg_temp;

alter function public.refresh_brain_counts()
  set search_path = public, pg_temp;

alter function public.set_updated_at()
  set search_path = public, pg_temp;

alter function public.prune_data_source_cache()
  set search_path = public, pg_temp;

-- ─── Groups C+D: revoke EXECUTE on REST-exposed SECURITY DEFINER ─────
-- forgeminds_columns + forgeminds_rls_state — internal verify-script
-- helpers; only service_role needs them.
revoke execute on function public.forgeminds_columns()    from anon, authenticated, public;
revoke execute on function public.forgeminds_rls_state()  from anon, authenticated, public;
grant  execute on function public.forgeminds_columns()    to service_role;
grant  execute on function public.forgeminds_rls_state()  to service_role;

-- handle_new_user is the AFTER-INSERT trigger on auth.users. It runs as
-- the postgres role via trigger context; nothing should call it via REST.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- track_event is client-callable for behavioral analytics. Authenticated
-- users (signed-in) are allowed; anon must NOT be (lessons.md #97 — keep
-- public surface area minimal).
revoke execute on function public.track_event(
  public.behavioral_event_type,
  uuid, uuid, uuid, uuid, uuid,
  integer, integer,
  text, text,
  jsonb, text
) from anon, public;
grant execute on function public.track_event(
  public.behavioral_event_type,
  uuid, uuid, uuid, uuid, uuid,
  integer, integer,
  text, text,
  jsonb, text
) to authenticated, service_role;

-- ─── Verification (paste in SQL editor after applying) ───────────────
-- Confirm each function now has explicit search_path:
--
--   select proname, proconfig
--   from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and proname in ('prune_old_behavioral_events', 'refresh_brain_counts',
--                     'set_updated_at', 'prune_data_source_cache');
--   -- proconfig should show {search_path=public, pg_temp} for each
--
-- Confirm anon/authenticated cannot execute the 3 internal fns:
--
--   select n.nspname, p.proname,
--          has_function_privilege('anon',          (n.nspname || '.' || p.proname || '()')::regprocedure, 'EXECUTE')          as anon_can,
--          has_function_privilege('authenticated', (n.nspname || '.' || p.proname || '()')::regprocedure, 'EXECUTE')          as authed_can
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where p.proname in ('forgeminds_columns', 'forgeminds_rls_state', 'handle_new_user');
--   -- expect anon_can=false and authed_can=false for all three
--
-- Then re-run Supabase Advisor → Security: the 13 warnings cleared by
-- this migration should be gone. The 3 extension_in_public + 1 leaked
-- password warnings are tracked separately in DECISIONS.md.
