-- 20260610000000_fix_cron_dispatch_use_http_get.sql
--
-- PARITY-ONLY migration. The live DB ALREADY has this function (applied by the
-- desktop Claude session via Supabase MCP on 2026-06-10). This file exists so a
-- clean `supabase db reset` / fresh checkout reproduces deployed reality. Do NOT
-- re-apply it manually.
--
-- Fix: the pg_cron dispatcher previously called net.http_post, but every
-- /api/cron/* route exports GET only (user_id in the query string, auth in the
-- Bearer header), so POST requests returned 405 and the pipeline stalled.
-- Aligned the dispatcher to net.http_get. Supersedes the http_post form created
-- in 20260604000000_reconcile_cron_app_config.sql.

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
  select value into base_url from private.app_config where key = 'forgeminds_base_url';
  if base_url is null or base_url = '' then
    raise exception 'forgeminds_base_url not set';
  end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if secret is null or secret = '' then
    raise exception 'cron_secret not present in vault';
  end if;
  -- Cron routes export GET (user_id in query string, auth in Bearer header).
  -- Was net.http_post -> GET-only routes returned 405. Aligned to GET.
  select net.http_get(
    url := base_url || '/api/cron/' || step || '?user_id=' || for_user_id::text,
    headers := jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),
    timeout_milliseconds := 60000
  ) into request_id;
  return request_id;
end;
$function$;
