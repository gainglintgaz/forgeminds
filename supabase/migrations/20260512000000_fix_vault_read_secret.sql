-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1 cron dispatcher hotfix
-- ════════════════════════════════════════════════════════════════════
-- Bug discovered 2026-05-12 during Phase 1 close (P1.0-G):
--   pg_cron job_run_details shows ~71% of dispatcher runs failing with:
--     ERROR:  function vault.read_secret(unknown) does not exist
--     CONTEXT: PL/pgSQL function invoke_forgeminds_cron(text,uuid) line 15
--
-- Root cause: the dispatcher migrations (20260501000001 +
-- 20260501000002) call `vault.read_secret('cron_secret')` to retrieve
-- the bearer token. Supabase's vault extension does NOT provide a
-- `vault.read_secret(text)` function — secrets are read via the
-- `vault.decrypted_secrets` view (the same one used to seed the secret
-- via `vault.create_secret(...)` in phase-1-project-bootstrap.sql).
--
-- The dispatcher had been quietly failing every minute since 2026-05-07.
-- Visible only via:
--   select status, return_message from cron.job_run_details
--    where jobid in (select jobid from cron.job where jobname like 'forgeminds%')
--    order by start_time desc;
--
-- This migration replaces the function definition with the correct
-- vault.decrypted_secrets read. Function signature + grants unchanged.
-- ════════════════════════════════════════════════════════════════════

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
  -- Read base URL from private.app_config (per 20260501000002 fix).
  select value into base_url
    from private.app_config
   where key = 'forgeminds_base_url';

  if base_url is null or base_url = '' then
    raise exception 'forgeminds_base_url not set; run: update private.app_config set value = ''https://forgeminds.app'' where key = ''forgeminds_base_url''';
  end if;

  -- Read cron_secret from vault.decrypted_secrets view. The previous
  -- `vault.read_secret('cron_secret')` call was wrong — that function
  -- does not exist in Supabase's vault extension. Secrets seeded via
  -- vault.create_secret(name, value) are readable through this view
  -- (postgres + service_role can decrypt; anon and authenticated
  -- cannot). SECURITY DEFINER + the postgres-owned function makes the
  -- read safe.
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
$$;

grant execute on function private.invoke_forgeminds_cron(text, uuid) to service_role;

-- ─── Verification ─────────────────────────────────────────────────────
-- After applying, wait ~60s for the next cron tick and check:
--   select status, count(*) from cron.job_run_details
--    where jobid in (select jobid from cron.job where jobname like 'forgeminds%')
--      and start_time > now() - interval '5 minutes'
--    group by status;
--
-- Expected: status='succeeded' for every recent run; no 'failed'.
-- ═════════════════════════════════════════════════════════════════════
