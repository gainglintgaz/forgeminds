-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1: pg_cron schedules for the news pipeline
-- ════════════════════════════════════════════════════════════════════
-- Schedules every cron route to fire automatically. Each route is gated by
-- CRON_SECRET (matches the Authorization header check in src/app/api/cron/*).
--
-- Cadence (offsets staggered so each step finishes before the next starts):
--   ingest   @ :00 and :30  (every 30 min)        — fetch sources
--   score    @ :05 and :35  (5 min later)         — Gemini scoring
--   curate   @ :10 and :40  (10 min after ingest) — heuristic top-N
--   enrich   @ :15 and :45  (15 min after ingest) — Finnhub ticker quotes
--   generate @ :20 and :50  (20 min after ingest) — Gemini summary
--   deliver  @ :25 and :55  (25 min after ingest) — Resend email
--
-- Schedules are scoped to weekdays (Mon-Fri) 11:00-23:00 UTC = 7am-7pm ET.
-- Off-hours: no fetches, saves cost during periods nobody is reading.
--
-- Pre-condition: the `cron_secret` Vault secret MUST be inserted before this
-- migration runs. Insert via Supabase Dashboard → SQL editor:
--
--   select vault.create_secret('YOUR_CRON_SECRET_VALUE', 'cron_secret');
--
-- AND the production base URL must be set as a database parameter:
--
--   alter database postgres set app.forgeminds_base_url = 'https://forgeminds.app';
--
-- Both are one-time setup steps; no secrets land in this committed SQL file.
-- ════════════════════════════════════════════════════════════════════

-- Ensure required extensions are loaded (idempotent).
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- vault extension is already loaded in default Supabase projects; leave as-is.

-- ─── Helper: invoke a cron route with the bearer secret ─────────────
-- Centralizes the http_post pattern so every job stays a one-liner. Security
-- definer so ordinary roles can't read or wrap the secret outside this fn.
create or replace function private.invoke_forgeminds_cron(step text)
returns bigint
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  base_url text;
  secret text;
  request_id bigint;
begin
  base_url := current_setting('app.forgeminds_base_url', true);
  if base_url is null or base_url = '' then
    raise exception 'app.forgeminds_base_url not set; run: alter database postgres set app.forgeminds_base_url = ''https://forgeminds.app''';
  end if;

  -- vault.read_secret raises if the secret doesn't exist
  secret := vault.read_secret('cron_secret');

  select net.http_post(
    url := base_url || '/api/cron/' || step,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into request_id;

  return request_id;
end;
$$;

-- Make sure `private` schema exists and is locked down to service_role only.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to service_role;
grant execute on function private.invoke_forgeminds_cron(text) to service_role;

-- ─── Unschedule prior versions (idempotent re-runs) ─────────────────
do $$
declare
  job_name text;
begin
  for job_name in
    select jobname from cron.job
    where jobname like 'forgeminds_%'
  loop
    perform cron.unschedule(job_name);
  end loop;
end $$;

-- ─── Schedule each pipeline step ────────────────────────────────────
-- Cron format: minute hour dom month dow
-- Hours 11-23 UTC = 7am-7pm ET (weekdays only, dow 1-5).

select cron.schedule(
  'forgeminds_ingest_30m',
  '0,30 11-23 * * 1-5',
  $$select private.invoke_forgeminds_cron('ingest');$$
);

select cron.schedule(
  'forgeminds_score_30m',
  '5,35 11-23 * * 1-5',
  $$select private.invoke_forgeminds_cron('score');$$
);

select cron.schedule(
  'forgeminds_curate_30m',
  '10,40 11-23 * * 1-5',
  $$select private.invoke_forgeminds_cron('curate');$$
);

select cron.schedule(
  'forgeminds_enrich_30m',
  '15,45 11-23 * * 1-5',
  $$select private.invoke_forgeminds_cron('enrich');$$
);

select cron.schedule(
  'forgeminds_generate_30m',
  '20,50 11-23 * * 1-5',
  $$select private.invoke_forgeminds_cron('generate');$$
);

select cron.schedule(
  'forgeminds_deliver_30m',
  '25,55 11-23 * * 1-5',
  $$select private.invoke_forgeminds_cron('deliver');$$
);

-- ─── Verification queries (paste into SQL editor after applying) ─────
-- List all scheduled jobs:
--   select jobname, schedule, command from cron.job where jobname like 'forgeminds_%';
--
-- See recent runs (last 1 hour):
--   select jobname, status, return_message, start_time
--   from cron.job_run_details
--   where start_time > now() - interval '1 hour'
--   order by start_time desc;
--
-- Manually trigger a job for testing:
--   select private.invoke_forgeminds_cron('ingest');
--
-- Disable a job temporarily:
--   select cron.alter_job(
--     (select jobid from cron.job where jobname = 'forgeminds_ingest_30m'),
--     active := false
--   );
