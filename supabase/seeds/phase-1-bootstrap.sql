-- ═══════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1 Bootstrap (post-migration setup)
-- ═══════════════════════════════════════════════════════════════════════
-- Run this ONCE in the Supabase SQL editor AFTER:
--   1. supabase/seeds/phase-1-cleanup.sql is run (clears partial state)
--   2. `npx supabase db push` applied both Phase 1 migrations:
--      - 20260501000000_user_preferences_scheduling.sql
--      - 20260501000001_pg_cron_dispatcher.sql
--
-- What this does:
--   1. Creates the cron_secret in Vault (you edit one line below)
--   2. Sets app.forgeminds_base_url database parameter
--   3. Applies tool_capabilities seed (if not already applied)
--   4. Inserts RSS feeds under YOUR user_id (not SYSTEM)
--   5. Sets your user_preferences row with your preferred scheduling
--   6. Enables the dispatcher cron jobs (they ship disabled)
--
-- Idempotent: every section is safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 0. Find your user_id ─────────────────────────────────────────────
-- Replace the email below with the address you signed up to ForgeMinds with.
-- (If you haven't signed up yet, go to https://forgeminds.app/signup, then
-- come back and run this.) The result tells you the UUID to paste in §3, §4, §5.
--
--   select id, email from auth.users where email = 'your-email@example.com';
--
-- Or, simpler — define a temporary helper that pulls it inline:
do $$
declare
  my_email text := 'REPLACE_WITH_YOUR_EMAIL@example.com';   -- ← edit this once
  my_user_id uuid;
begin
  select id into my_user_id from auth.users where email = my_email;
  if my_user_id is null then
    raise notice 'No auth user found for %. Sign up at https://forgeminds.app/signup first.', my_email;
  else
    raise notice 'Your user_id is: %', my_user_id;
  end if;
end $$;

-- ─── 1. Vault secret ──────────────────────────────────────────────────
-- IMPORTANT: REPLACE the placeholder with your actual CRON_SECRET value
-- from .env.local. The vault encrypts it at rest.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(
      'REPLACE_ME_WITH_YOUR_CRON_SECRET_FROM_ENV_LOCAL',
      'cron_secret'
    );
  end if;
end $$;

-- To rotate later:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'cron_secret'),
--     'NEW_CRON_SECRET_VALUE'
--   );

-- ─── 2. Base URL config row ───────────────────────────────────────────
-- Where pg_cron jobs send HTTP requests. The dispatcher reads this from
-- private.app_config (created by 20260501000002_app_config_table.sql).
-- We can't use ALTER DATABASE SET on Supabase (that requires superuser).
update private.app_config
   set value = 'https://forgeminds.app',
       updated_at = now()
 where key = 'forgeminds_base_url';
-- For local dev with an ngrok tunnel:
--   update private.app_config set value = 'https://your-tunnel.ngrok.app' where key = 'forgeminds_base_url';

-- ─── 3. Tool capabilities seed (only if not already applied) ──────────
-- Skip if `select count(*) from tool_capabilities` returns >0. Otherwise
-- paste the contents of supabase/seeds/tool_capabilities.sql below this line
-- before running the rest of the script. (Or run it as a separate command.)

-- ─── 4. RSS feeds for YOUR user ───────────────────────────────────────
-- Inserted under your real auth user_id. The dispatcher fires the ingest
-- route with ?user_id=<yours>; the route reads sources where user_id matches.
-- Idempotent via the (user_id, name) unique constraint from migration 1.
insert into public.sources (user_id, type, name, url, is_active, fetch_interval_minutes)
select
  u.id::uuid,
  source.type,
  source.name,
  source.url,
  true,
  30
from auth.users u
cross join (values
  ('rss', 'Investing.com — Markets',           'https://www.investing.com/rss/news_11.rss'),
  ('rss', 'WSJ — Markets Main',                'https://feeds.a.dj.com/rss/RSSMarketsMain.xml'),
  ('rss', 'Yahoo Finance — News',              'https://finance.yahoo.com/news/rssindex'),
  ('rss', 'Federal Reserve — Press',           'https://www.federalreserve.gov/feeds/press_all.xml'),
  ('rss', 'EIA — Today in Energy',             'https://www.eia.gov/rss/todayinenergy.xml'),
  ('rss', 'Nasdaq — Markets',                  'https://www.nasdaq.com/feed/rssoutbound?category=Markets'),
  ('rss', 'Investing.com — Stock Market News', 'https://www.investing.com/rss/news_1.rss'),
  ('rss', 'CoinDesk',                          'https://www.coindesk.com/arc/outboundfeeds/rss/'),
  ('rss', 'ConnectMoney — Economic Indicators','https://www.connectmoney.com/feed?story-market=economic-indicators'),
  ('rss', 'Cointelegraph',                     'https://www.cointelegraph.com/rss')
) as source(type, name, url)
where u.email = 'REPLACE_WITH_YOUR_EMAIL@example.com'   -- ← same email as §0
on conflict (user_id, name) do update set
  url = excluded.url,
  is_active = excluded.is_active,
  fetch_interval_minutes = excluded.fetch_interval_minutes,
  updated_at = now();

-- ─── 5. Your user_preferences scheduling row ──────────────────────────
-- The schema defaults work for any user, but you might want explicit values.
-- Adjust as you like — the dispatcher reads these every minute to decide
-- whether to fire your pipeline.
update public.user_preferences
   set timezone               = 'America/New_York',  -- IANA tz; default is fine
       cadence_minutes        = 30,                  -- 15 / 30 / 60 / 120 / 240 / 360 / 720 / 1440
       active_hours_start     = 7,                   -- earliest hour pipeline runs
       active_hours_end       = 23,                  -- latest hour
       active_days            = '{mon,tue,wed,thu,fri}'::text[],
       recency_window_minutes = 120,                 -- ingest dedup horizon
       score_lookback_minutes = 240,                 -- score grabs unscored within this window
       min_composite_score    = 0.45,                -- 0-1 scale; below this article doesn't make brief
       max_articles_per_brief = 15,
       max_per_category       = 3,
       max_per_entity         = 2,
       delivery_email         = true                 -- send email when brief generates
 where user_id = (select id from auth.users where email = 'REPLACE_WITH_YOUR_EMAIL@example.com');

-- ─── 6. Enable the dispatcher cron jobs ───────────────────────────────
-- The dispatcher migration shipped with all jobs disabled (active=false) to
-- avoid spamming an undeployed Vercel URL. Now that the secret + base URL
-- are set, enable them:
do $$
declare
  j record;
begin
  for j in select jobid from cron.job where jobname like 'forgeminds_dispatch_%' loop
    perform cron.alter_job(j.jobid, active := true);
  end loop;
end $$;

-- ─── 7. Verification queries ──────────────────────────────────────────
-- After running, paste these to confirm everything landed:

select
  'sources for you' as label,
  count(*) as count
from public.sources s
join auth.users u on u.id = s.user_id
where u.email = 'REPLACE_WITH_YOUR_EMAIL@example.com' and s.is_active = true
union all
select 'tool_capabilities rows', count(*) from public.tool_capabilities
union all
select 'cron jobs scheduled', count(*) from cron.job where jobname like 'forgeminds_dispatch_%'
union all
select 'cron jobs active', count(*) from cron.job where jobname like 'forgeminds_dispatch_%' and active = true
union all
select 'vault secret exists', count(*) from vault.decrypted_secrets where name = 'cron_secret'
union all
select 'base_url set', case when (select value from private.app_config where key = 'forgeminds_base_url') <> '' then 1 else 0 end;

-- Expected (after a successful bootstrap):
--   sources for you          → 10
--   tool_capabilities rows   → ~30
--   cron jobs scheduled      → 6
--   cron jobs active         → 6
--   vault secret exists      → 1
--   base_url set             → 1

-- ─── 8. Manual test invoke (optional, after bootstrap) ────────────────
-- Test that one user → one route works end-to-end without waiting for cron:
--
--   select private.invoke_forgeminds_cron(
--     'ingest',
--     (select id from auth.users where email = 'REPLACE_WITH_YOUR_EMAIL@example.com')
--   );
--
-- Watch the response in Vercel logs (or your Next.js dev server terminal).
