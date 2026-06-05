-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — reconcile pg_cron dispatcher chain to deployed reality
-- ════════════════════════════════════════════════════════════════════
-- WHY THIS FILE EXISTS (2026-06-04 stalled-loop diagnosis):
--
-- The dispatcher is defined across THREE migrations whose end-state no
-- longer matches the live dev DB (ymgbjtgczgnooscigplb) in two ways:
--
--   20260501000001_pg_cron_dispatcher.sql   — original. invoke fn reads
--       base_url from a GUC (current_setting('app.forgeminds_base_url'))
--       and the file ENDS by pausing all 6 forgeminds_* cron jobs.
--   20260501000002_app_config_table.sql     — hotfix. Replaced the GUC
--       with private.app_config (the ALTER DATABASE ... SET approach
--       needs SUPERUSER, which Supabase's postgres role lacks). Seeds
--       forgeminds_base_url = '' (empty).
--   20260512000000_fix_vault_read_secret.sql — hotfix. Replaced the
--       nonexistent vault.read_secret() call with a read of
--       vault.decrypted_secrets. Function bodies now match live.
--
-- Remaining repo ≠ reality drift a fresh `supabase db reset` produces:
--
--   1. SEED VALUE: replay ends with forgeminds_base_url = '' (per 002),
--      while live holds the placeholder 'https://forgeminds.app'.
--      Reconciled below with a GUARDED upsert: overwrite ONLY when the
--      existing value is '' (the 002 seed). An ops-configured real URL
--      is never clobbered. (The diagnosis prompt suggested ON CONFLICT
--      DO NOTHING, but DO NOTHING leaves '' in place on fresh replays —
--      it would not reconcile. The guard achieves the intent safely.)
--
--   2. JOB ACTIVE STATE: replay ends with all 6 jobs active = false
--      (001 pauses them deliberately to avoid tick spam against an
--      undeployed URL); live has all 6 active = true (ops enabled them
--      2026-05-04). This migration INTENTIONALLY does NOT activate the
--      jobs: activation is a post-deploy ops step, gated on a real
--      base_url + vault cron_secret being present. To activate:
--
--        do $do$ begin
--          perform cron.alter_job(jobid, active := true)
--          from cron.job where jobname like 'forgeminds_%';
--        end $do$;
--
-- This file also snapshots BOTH live function definitions verbatim
-- (pulled via pg_get_functiondef on 2026-06-04) so the canonical state
-- lives in ONE place instead of being the mental merge of three files.
--
-- NOTE: the live DB already matches this file — do NOT re-apply it to
-- the existing dev project as part of this change; it exists so fresh
-- environments replay to deployed reality. Idempotent: safe to re-run.
-- NOTE: base_url stays the placeholder 'https://forgeminds.app' (does
-- not resolve). Repointing it to the real deployment is the separate,
-- interactive deploy fix — not this migration's job.
-- ════════════════════════════════════════════════════════════════════

-- ─── Prerequisites (no-ops on any DB that ran 001/002) ────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to service_role;

-- ─── Config table (live shape: key / value / updated_at) ─────────────
create table if not exists private.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update on private.app_config to service_role;

-- Seed-or-reconcile the base_url row. The guard (`where ... value = ''`)
-- upgrades only the empty 002 seed to the live placeholder; a real URL
-- set by ops is never overwritten.
insert into private.app_config (key, value)
values ('forgeminds_base_url', 'https://forgeminds.app')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now()
  where private.app_config.value = '';

-- ─── invoke_forgeminds_cron — verbatim live definition ────────────────
-- (pg_get_functiondef, dev project, 2026-06-04. Matches the semantics of
-- 20260512000000; body comments differ because the live function was
-- applied from a comment-stripped variant.)
CREATE OR REPLACE FUNCTION private.invoke_forgeminds_cron(step text, for_user_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'vault', 'net'
AS $function$
declare
  base_url text;
  secret text;
  request_id bigint;
begin
  select value into base_url
    from private.app_config
   where key = 'forgeminds_base_url';

  if base_url is null or base_url = '' then
    raise exception 'forgeminds_base_url not set; run: update private.app_config set value = ''https://forgeminds.app'' where key = ''forgeminds_base_url''';
  end if;

  select decrypted_secret into secret
    from vault.decrypted_secrets
   where name = 'cron_secret'
   limit 1;

  if secret is null or secret = '' then
    raise exception 'cron_secret not present in vault; run vault.create_secret(''<value>'', ''cron_secret'')';
  end if;

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
$function$;

grant execute on function private.invoke_forgeminds_cron(text, uuid) to service_role;

-- ─── dispatch_forgeminds_cron — verbatim live definition ──────────────
-- (pg_get_functiondef, dev project, 2026-06-04. Identical to the 001
-- definition — snapshotted here so this file alone is canonical.)
CREATE OR REPLACE FUNCTION private.dispatch_forgeminds_cron(step text)
 RETURNS TABLE(user_id uuid, request_id bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault', 'net'
AS $function$
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
$function$;

grant execute on function private.dispatch_forgeminds_cron(text) to service_role;

-- ─── Verification (read-only; paste into SQL editor) ─────────────────
--
-- Functions match this file:
--   select proname, pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'private'
--     and proname in ('invoke_forgeminds_cron','dispatch_forgeminds_cron');
--
-- Config row present:
--   select * from private.app_config where key = 'forgeminds_base_url';
--
-- Job state (live: 6 rows, active = true; fresh replay: active = false
-- until the post-deploy ops activation above):
--   select jobname, schedule, active from cron.job
--   where jobname like 'forgeminds_%' order by jobname;

-- ─── DOWN (commented; restore pre-reconcile repo end-state) ──────────
-- This migration is a reconciliation: on the live DB it is a no-op, so
-- the DOWN only matters for environments that replayed it fresh.
--
-- -- 1. Restore the 002 empty seed (only if this file set the placeholder):
-- -- update private.app_config
-- --    set value = '', updated_at = now()
-- --  where key = 'forgeminds_base_url'
-- --    and value = 'https://forgeminds.app';
-- --
-- -- 2. Function definitions: the bodies above are identical in behavior
-- --    to 20260512000000 (invoke) + 20260501000001 (dispatch); to revert,
-- --    re-run those two CREATE OR REPLACE statements from their files.
-- --
-- -- 3. Table/schema/extensions are shared with 001/002 — do NOT drop.
