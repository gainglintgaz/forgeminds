-- ═══════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1 PROJECT-level bootstrap
-- ═══════════════════════════════════════════════════════════════════════
-- Run this ONCE per ForgeMinds deployment, in the Supabase SQL editor.
--
-- Scope: PROJECT infrastructure ONLY. Nothing here is user-specific. Every
-- value below applies equally to every user that ever signs up. Per-user
-- setup (sources, preferences, tickers, topics) happens through the app UI:
--   - /sources           → users add their own feeds via "Add RSS Feed" dialog
--   - /settings          → Phase 2 edit forms; defaults from migration 9 work for now
--   - /onboarding/*      → Phase 1.5 source-catalog picker walks new users through
--                          industry/topic-driven source suggestions
--
-- Pre-conditions:
--   1. supabase/seeds/phase-1-cleanup.sql ran (returned 0|0|0)
--   2. `npx supabase db push` applied:
--      - 20260501000000_user_preferences_scheduling.sql
--      - 20260501000001_pg_cron_dispatcher.sql
--      - 20260501000002_app_config_table.sql
--
-- Idempotent: safe to re-run; every section guards against duplicate work.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Vault secret: cron_secret ────────────────────────────────────
-- The bearer token pg_cron uses to authenticate against the project's
-- /api/cron/* routes. Same secret for every cron invocation; not user-tied.
--
-- ⚠️  EDIT ONE LINE BELOW: replace the placeholder with the value of
--     CRON_SECRET=… from your deployment's environment (.env.local during
--     dev; Vercel env var in production). The vault encrypts at rest.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(
      'REPLACE_ME_WITH_CRON_SECRET_FROM_DEPLOYMENT_ENV',
      'cron_secret'
    );
  end if;
end $$;

-- To rotate (e.g. after a leak):
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'cron_secret'),
--     'NEW_CRON_SECRET_VALUE'
--   );

-- ─── 2. Base URL: where pg_cron POSTs ─────────────────────────────────
-- Where the dispatcher (private.dispatch_forgeminds_cron) sends HTTP requests.
-- Same endpoint for every user; the dispatcher passes ?user_id=<uuid> per call.
-- Change this string when you deploy / move domains.
update private.app_config
   set value = 'https://forgeminds.app',
       updated_at = now()
 where key = 'forgeminds_base_url';

-- For local dev with an ngrok tunnel, set instead:
--   update private.app_config set value = 'https://your-tunnel.ngrok.app' where key = 'forgeminds_base_url';

-- ─── 3. tool_capabilities reference data ──────────────────────────────
-- Read-only registry of what tools/APIs can/cannot do (drives Phase 7's Build
-- Kick-off Packages, capability warnings, lessons-learned matching). Same
-- catalogue every user sees; not personal data.
--
-- If `select count(*) from tool_capabilities` returns 0, paste the contents
-- of `supabase/seeds/tool_capabilities.sql` separately in the SQL editor and
-- run it. Skip otherwise — already seeded.

-- ─── 4. Enable the 6 dispatcher cron jobs ─────────────────────────────
-- The dispatcher migration shipped jobs in active=false state to avoid
-- pinging a Vercel URL that didn't exist yet. Now that base_url is set and
-- the vault secret exists, enable them. Each job ticks every minute and
-- queries user_preferences for users matching NOW; only fires per-user
-- invocations for users actually due. Idle ticks are ~1ms.
do $$
declare
  j record;
begin
  for j in select jobid from cron.job where jobname like 'forgeminds_dispatch_%' loop
    perform cron.alter_job(j.jobid, active := true);
  end loop;
end $$;

-- ─── 5. Verification — paste the next block to confirm everything landed ─
select
  'vault secret exists' as label,
  count(*)::text as value
from vault.decrypted_secrets where name = 'cron_secret'
union all
select 'base_url set',
  case when (select value from private.app_config where key = 'forgeminds_base_url') <> ''
    then (select value from private.app_config where key = 'forgeminds_base_url')
    else 'NOT SET'
  end
union all
select 'tool_capabilities rows',
  count(*)::text from public.tool_capabilities
union all
select 'cron dispatcher jobs scheduled',
  count(*)::text from cron.job where jobname like 'forgeminds_dispatch_%'
union all
select 'cron dispatcher jobs active',
  count(*)::text from cron.job where jobname like 'forgeminds_dispatch_%' and active = true;

-- Expected:
--   vault secret exists             → 1
--   base_url set                    → https://forgeminds.app  (or your URL)
--   tool_capabilities rows          → ~30 (or 0 if seed not yet applied)
--   cron dispatcher jobs scheduled  → 6
--   cron dispatcher jobs active     → 6
--
-- Per-user data (sources, preferences, topics, tickers) is NOT touched
-- by this script. Users add sources through /sources UI and customize
-- preferences through /settings (Phase 2) and /onboarding (Phase 1.5).
