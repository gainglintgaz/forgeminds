-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1: pg_cron dispatcher pattern
-- ════════════════════════════════════════════════════════════════════
-- ARCHITECTURE: instead of one cron entry per (user, step) — which doesn't
-- scale past hundreds of users — we use ONE cron entry per step that ticks
-- every minute and dispatches per-user invocations to users whose schedule
-- matches NOW (in their timezone, within their active hours/days, and far
-- enough since their last run to satisfy cadence).
--
-- Captures factory CLAUDE.md §17 + VIBE Rule 55 (per-user-from-day-1).
--
-- Pre-condition: 20260501000000_user_preferences_scheduling.sql applied
-- (extends user_preferences with cadence/active_hours/etc).
--
-- Required vault secrets + GUCs:
--   select vault.create_secret('YOUR_CRON_SECRET', 'cron_secret');
--   alter database postgres set app.forgeminds_base_url = 'https://forgeminds.app';
--
-- Both are one-time setup steps, not committed in git.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ─── Schema for private helpers ───────────────────────────────────────
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to service_role;

-- ─── Per-user invoke (one HTTP POST to a cron route for one user) ────
create or replace function private.invoke_forgeminds_cron(
  step text,
  for_user_id uuid
)
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

  secret := vault.read_secret('cron_secret');

  select net.http_post(
    url := base_url || '/api/cron/' || step || '?user_id=' || for_user_id::text,
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

grant execute on function private.invoke_forgeminds_cron(text, uuid) to service_role;

-- ─── Dispatcher: find users matching NOW for a given step, invoke each ─
-- Logic (per row in user_preferences):
--   - in_active_hours: now-in-user-tz hour BETWEEN active_hours_start AND active_hours_end
--   - in_active_days:  now-in-user-tz dow short-name IN active_days
--   - cadence_due:     extract(epoch from (now() - last_run_at_for_step)) / 60 >= cadence_minutes
--                      OR last_run_at_for_step IS NULL (never run before)
--
-- Uses the user's timezone column (defaults to America/New_York). Day-of-week
-- tokens are 3-letter lowercase: mon, tue, wed, thu, fri, sat, sun.
create or replace function private.dispatch_forgeminds_cron(step text)
returns table (user_id uuid, request_id bigint)
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  rec record;
  rid bigint;
  dow_token text;
  hour_now int;
  last_run timestamptz;
begin
  for rec in
    select
      up.user_id,
      up.timezone,
      up.cadence_minutes,
      up.active_hours_start,
      up.active_hours_end,
      up.active_days,
      up.last_run_at_by_step
    from public.user_preferences up
  loop
    -- Compute "now in user's timezone" once per row.
    -- to_char(... , 'dy') returns 3-letter lowercase day-of-week token.
    dow_token := lower(to_char(now() at time zone rec.timezone, 'dy'));
    hour_now  := extract(hour from (now() at time zone rec.timezone))::int;

    -- Skip if today not in active_days.
    if not (dow_token = any(rec.active_days)) then
      continue;
    end if;

    -- Skip if outside active hours.
    if hour_now < rec.active_hours_start or hour_now > rec.active_hours_end then
      continue;
    end if;

    -- Skip if cadence not yet elapsed since last run.
    last_run := nullif(rec.last_run_at_by_step ->> step, '')::timestamptz;
    if last_run is not null
       and extract(epoch from (now() - last_run)) / 60 < rec.cadence_minutes
    then
      continue;
    end if;

    -- Fire it.
    rid := private.invoke_forgeminds_cron(step, rec.user_id);

    -- Stamp last_run so cadence holds for the next tick.
    update public.user_preferences
       set last_run_at_by_step = jsonb_set(
         coalesce(last_run_at_by_step, '{}'::jsonb),
         array[step],
         to_jsonb(now()),
         true
       )
     where user_preferences.user_id = rec.user_id;

    user_id := rec.user_id;
    request_id := rid;
    return next;
  end loop;
  return;
end;
$$;

grant execute on function private.dispatch_forgeminds_cron(text) to service_role;

-- ─── Unschedule any prior versions (idempotent re-runs) ───────────────
do $$
declare
  j record;
begin
  for j in select jobid from cron.job where jobname like 'forgeminds_%' loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

-- ─── Schedule one dispatcher per pipeline step ────────────────────────
-- Each dispatcher ticks every minute (the cheapest unit of cron resolution).
-- The dispatcher itself is fast (one indexed query + zero-or-more http_post
-- calls). Even at 10K users with default cadence_minutes=30, only ~333 users
-- match per minute — and most won't match because of the cadence cooldown.
--
-- Why every minute (not every 5 minutes):
--   - cadence_minutes can be as low as 15. A 5-min tick floor means users
--     setting cadence=15 effectively get cadence=15-20 (drift). 1-min tick
--     gives cadence-as-asked-for granularity.
--   - Idle dispatchers cost ~1ms (empty result set). Negligible at scale.
--
-- All jobs scheduled active=true. To pause the entire pipeline:
--   do $$ begin
--     perform cron.alter_job(jobid, active := false)
--     from cron.job where jobname like 'forgeminds_%';
--   end $$;

select cron.schedule(
  'forgeminds_dispatch_ingest',
  '* * * * *',
  $$select * from private.dispatch_forgeminds_cron('ingest');$$
);

select cron.schedule(
  'forgeminds_dispatch_score',
  '* * * * *',
  $$select * from private.dispatch_forgeminds_cron('score');$$
);

select cron.schedule(
  'forgeminds_dispatch_curate',
  '* * * * *',
  $$select * from private.dispatch_forgeminds_cron('curate');$$
);

select cron.schedule(
  'forgeminds_dispatch_enrich',
  '* * * * *',
  $$select * from private.dispatch_forgeminds_cron('enrich');$$
);

select cron.schedule(
  'forgeminds_dispatch_generate',
  '* * * * *',
  $$select * from private.dispatch_forgeminds_cron('generate');$$
);

select cron.schedule(
  'forgeminds_dispatch_deliver',
  '* * * * *',
  $$select * from private.dispatch_forgeminds_cron('deliver');$$
);

-- ─── Pause all jobs by default until base_url + vault secret are set ──
-- This prevents tick spam against an undeployed Vercel URL during development.
-- Re-enable after Vercel deploy + vault.create_secret + alter database:
--
--   do $$ begin
--     perform cron.alter_job(jobid, active := true)
--     from cron.job where jobname like 'forgeminds_%';
--   end $$;
do $$
declare
  j record;
begin
  for j in select jobid from cron.job where jobname like 'forgeminds_%' loop
    perform cron.alter_job(j.jobid, active := false);
  end loop;
end $$;

-- ─── Verification queries (paste into SQL editor after applying) ─────
--
-- List all dispatchers:
--   select jobname, schedule, active from cron.job where jobname like 'forgeminds_%' order by jobname;
--
-- See recent dispatcher runs (last hour):
--   select jobname, status, return_message, start_time
--   from cron.job_run_details
--   where start_time > now() - interval '1 hour'
--   order by start_time desc;
--
-- Test the dispatcher manually for one step (won't fire HTTP calls if no
-- users match):
--   select * from private.dispatch_forgeminds_cron('ingest');
--
-- Test a single per-user invoke without going through the dispatcher:
--   select private.invoke_forgeminds_cron('ingest', '<your-user-id>'::uuid);
