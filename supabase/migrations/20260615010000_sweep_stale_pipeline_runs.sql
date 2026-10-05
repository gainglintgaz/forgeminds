-- 20260615010000_sweep_stale_pipeline_runs.sql
--
-- S3.1 unattended-execution hardening (ERR-026, ERR-025, lessons.md #104).
-- A heavy AI route killed mid-run by a constrained host (Cloudflare Workers
-- CPU/chunk limit) never reaches its catch block, so its pipeline_runs row
-- dangles in status='running' forever — the audit lies and the dispatcher's
-- cadence sees a "recent run" that never finished.
--
-- This sweep lives in the DB (pg_cron), so it works regardless of which host
-- the app runs on — it heals the audit even when the app host is dead. It marks
-- any 'running' row older than 10 minutes as 'failed' so the trail stays honest
-- and the next dispatch can retry. Additive; no destructive ops.

create or replace function private.sweep_stale_pipeline_runs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  swept integer;
begin
  update public.pipeline_runs
     set status = 'failed',
         error_message = left(coalesce(error_message, '') || ' [swept: stale running > 10min — host hang/crash]', 500),
         completed_at = now(),
         duration_ms = coalesce(duration_ms, (extract(epoch from (now() - started_at)) * 1000)::integer)
   where status = 'running'
     and started_at < now() - interval '10 minutes';
  get diagnostics swept = row_count;
  return swept;
end;
$$;

grant execute on function private.sweep_stale_pipeline_runs() to service_role;

-- Schedule every 5 minutes (idempotent: drop our own job first, never the dispatchers).
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'forgeminds_sweep_stale_runs';
exception when others then null;
end $$;

select cron.schedule(
  'forgeminds_sweep_stale_runs',
  '*/5 * * * *',
  $$select private.sweep_stale_pipeline_runs();$$
);
