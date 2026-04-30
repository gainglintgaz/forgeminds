-- ═══════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1 cleanup (run ONCE in Supabase SQL editor)
-- ═══════════════════════════════════════════════════════════════════════
-- The previous attempt at applying 20260501000000_pg_cron_schedules.sql
-- aborted mid-way. Some statements committed (cron jobs scheduled, schema
-- created), others didn't. This script reverts everything so the redesigned
-- migrations apply clean.
--
-- Run this BEFORE `npx supabase db push`.
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Unschedule any partial cron jobs from the previous failed apply.
do $$
declare
  j record;
begin
  for j in select jobid from cron.job where jobname like 'forgeminds_%' loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

-- 2. Drop the helper function and private schema if they were partially created.
drop function if exists private.invoke_forgeminds_cron(text);
drop function if exists private.dispatch_forgeminds_cron(text);
drop schema if exists private cascade;

-- 3. Clear the failed migration's record so `db push` will re-apply cleanly.
-- Idempotent: deletes 0 rows if the migration wasn't tracked.
delete from supabase_migrations.schema_migrations where version = '20260501000000';

-- 4. Verify cleanup.
select
  (select count(*) from cron.job where jobname like 'forgeminds_%') as remaining_jobs,
  (select count(*) from information_schema.schemata where schema_name = 'private') as private_schema_exists,
  (select count(*) from supabase_migrations.schema_migrations where version = '20260501000000') as failed_migration_rows;
-- Expected: all three columns return 0.
