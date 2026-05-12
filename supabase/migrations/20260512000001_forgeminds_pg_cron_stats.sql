-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — pg_cron stats RPC for verify:pg-cron-success gate
-- ════════════════════════════════════════════════════════════════════
-- Exposes a service-role-callable view of cron.job_run_details for
-- ForgeMinds dispatcher jobs.
--
-- The cron schema is owned by postgres and not exposed through
-- PostgREST by default. This SECURITY DEFINER function reads it on
-- behalf of service_role so the verify-pg-cron-success gate can check
-- dispatcher health without granting raw cron-schema access.
--
-- Added 2026-05-12 as part of the dispatcher hotfix (vault.read_secret
-- bug). The original bug — vault.read_secret() doesn't exist in
-- Supabase vault — caused 71% of dispatcher runs to fail silently for
-- 5 days. No existing gate caught it. This RPC is the data path for
-- the new gate.
--
-- Returns "last N runs per job" rather than a time window so the gate
-- reads CURRENT health regardless of historical failure backlog. A
-- fresh hotfix turns the gate green within ~10 dispatcher ticks
-- (~10 minutes) instead of waiting for a time window to roll past.
-- ════════════════════════════════════════════════════════════════════

-- Drop the prior signature (if any) before recreating. Renaming an input
-- parameter is treated as a signature conflict; CREATE OR REPLACE alone
-- fails with "cannot change name of input parameter". Idempotent for
-- fresh installs (DROP IF EXISTS) and for re-applies.
drop function if exists public.forgeminds_pg_cron_stats(int);

create or replace function public.forgeminds_pg_cron_stats(
  last_n_per_job int default 10
)
returns table(
  jobname text,
  total bigint,
  succeeded bigint,
  failed bigint,
  failed_message text
)
language sql
security definer
set search_path = public, cron, pg_temp
as $$
  with ranked as (
    select
      j.jobname::text,
      jrd.status,
      jrd.return_message,
      jrd.start_time,
      row_number() over (
        partition by j.jobname
        order by jrd.start_time desc
      ) as rn
    from cron.job j
    left join cron.job_run_details jrd
      on jrd.jobid = j.jobid
    where j.jobname like 'forgeminds%'
  ),
  windowed as (
    select * from ranked where rn <= last_n_per_job
  )
  select
    jobname,
    count(*) filter (where status is not null) as total,
    count(*) filter (where status = 'succeeded') as succeeded,
    count(*) filter (where status = 'failed') as failed,
    max(return_message) filter (where status = 'failed') as failed_message
  from windowed
  group by jobname
  order by jobname;
$$;

comment on function public.forgeminds_pg_cron_stats(int) is
  'Aggregate of cron.job_run_details for forgeminds_* dispatcher jobs over the last N runs per job. Used by verify:pg-cron-success gate. Last-N-runs (not time window) keeps the gate reading current health regardless of historical failures.';

-- service_role can call it; anon/authenticated cannot (security definer
-- means the function reads the cron schema regardless of caller).
revoke all on function public.forgeminds_pg_cron_stats(int) from public;
grant execute on function public.forgeminds_pg_cron_stats(int) to service_role;
