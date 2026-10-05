-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1 hotfix: app_config table replaces GUC parameter
-- ════════════════════════════════════════════════════════════════════
-- The original 20260501000001_pg_cron_dispatcher.sql migration tried to
-- read base URL via `current_setting('app.forgeminds_base_url')`, expecting
-- ops to set it via `ALTER DATABASE postgres SET app.forgeminds_base_url = '…'`.
--
-- That ALTER requires SUPERUSER on Supabase's hosted Postgres, which the
-- `postgres` role explicitly lacks. SQL editor returns:
--   ERROR: 42501: permission denied to set parameter "app.forgeminds_base_url"
--
-- This migration replaces the GUC approach with a tiny key/value config
-- table that any role with INSERT permission can write to. The dispatcher
-- function reads the value from there.
--
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- ─── Config table ─────────────────────────────────────────────────────
-- Lives in private schema (already created by 20260501000001) so neither
-- anon nor authenticated can read it. The base URL isn't strictly secret
-- but keeping config out of public.* prevents accidental leakage.
create table if not exists private.app_config (
  key   text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update on private.app_config to service_role;

-- Seed an empty row for forgeminds_base_url so the bootstrap SQL can
-- UPDATE it without an additional INSERT-or-update branching logic.
insert into private.app_config (key, value)
values ('forgeminds_base_url', '')
on conflict (key) do nothing;

-- ─── Replace the dispatcher's per-user invoke ────────────────────────
-- Reads base URL from private.app_config instead of current_setting().
-- Vault read for the bearer secret stays unchanged.
create or replace function private.invoke_forgeminds_cron(
  step text,
  for_user_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = public, private, vault, net
as $$
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

-- ─── Verification ─────────────────────────────────────────────────────
-- After applying:
--   select * from private.app_config;
--     → 1 row: key='forgeminds_base_url', value=''  (empty until bootstrap)
--
--   \df private.invoke_forgeminds_cron
--     → function exists with security definer
