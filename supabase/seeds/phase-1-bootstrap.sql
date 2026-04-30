-- ═══════════════════════════════════════════════════════════════════════
-- ForgeMinds — Phase 1 Bootstrap (post-migration setup)
-- ═══════════════════════════════════════════════════════════════════════
-- Run this ONCE in the Supabase SQL editor AFTER applying the pg_cron
-- migration (20260501000000_pg_cron_schedules.sql).
--
-- What it does:
--   1. Creates the cron_secret in Vault (you edit one line below)
--   2. Sets app.forgeminds_base_url database parameter
--   3. Applies tool_capabilities seed (if not already applied)
--   4. Inserts Victor's RSS feeds under the system user_id
--
-- Safe to re-run: every section is idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Vault secret ──────────────────────────────────────────────────
-- IMPORTANT: REPLACE the placeholder below with your actual CRON_SECRET
-- value from .env.local. The vault encrypts it at rest.
--
-- Skip this block if you've already created the secret. Vault rejects
-- duplicate names (use vault.update_secret instead in that case).
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

-- ─── 2. Base URL database parameter ───────────────────────────────────
-- Where pg_cron jobs send their HTTP requests. Change to your Vercel URL
-- once forgeminds.app is deployed. Localhost won't work — pg_cron lives
-- in Supabase's hosted DB which can't reach your laptop.
alter database postgres set app.forgeminds_base_url = 'https://forgeminds.app';
-- For ngrok tunnel testing during dev:
--   alter database postgres set app.forgeminds_base_url = 'https://your-tunnel.ngrok.app';

-- ─── 3. Tool capabilities seed ────────────────────────────────────────
-- The seed file is at supabase/seeds/tool_capabilities.sql. If you haven't
-- applied it, paste its contents here OR run:
--
--   \i supabase/seeds/tool_capabilities.sql   (psql)
--
-- Skip if `select count(*) from tool_capabilities` returns >0.

-- ─── 4. RSS feed sources for Phase 1 single-tenant pipeline ───────────
-- Inserted under system_user_id so the cron pipeline picks them up. When
-- Phase 2 makes ingest per-user, real users add their own via /sources UI.
--
-- Idempotent: ON CONFLICT DO NOTHING uses the (user_id, name) unique
-- constraint from migration 1.
insert into public.sources (user_id, type, name, url, is_active, fetch_interval_minutes)
values
  ('00000000-0000-0000-0000-000000000000'::uuid, 'rss', 'Investing.com — Markets',           'https://www.investing.com/rss/news_11.rss', true, 30),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'rss', 'WSJ — Markets Main',                'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', true, 30),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'rss', 'Yahoo Finance — News',              'https://finance.yahoo.com/news/rssindex', true, 30),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'rss', 'Federal Reserve — Press',           'https://www.federalreserve.gov/feeds/press_all.xml', true, 60),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'rss', 'EIA — Today in Energy',             'https://www.eia.gov/rss/todayinenergy.xml', true, 60),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'rss', 'Nasdaq — Markets',                  'https://www.nasdaq.com/feed/rssoutbound?category=Markets', true, 30),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'rss', 'Investing.com — Stock Market News', 'https://www.investing.com/rss/news_1.rss', true, 30),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'rss', 'CoinDesk',                          'https://www.coindesk.com/arc/outboundfeeds/rss/', true, 30),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'rss', 'ConnectMoney — Economic Indicators','https://www.connectmoney.com/feed?story-market=economic-indicators', true, 60),
  ('00000000-0000-0000-0000-000000000000'::uuid, 'rss', 'Cointelegraph',                     'https://www.cointelegraph.com/rss', true, 30)
on conflict (user_id, name) do update set
  url = excluded.url,
  is_active = excluded.is_active,
  fetch_interval_minutes = excluded.fetch_interval_minutes,
  updated_at = now();

-- ─── 5. Verification queries ──────────────────────────────────────────
-- Run after the bootstrap to confirm everything landed:
--
-- select count(*) from public.sources where is_active = true;
--   → should return 10
--
-- select jobname, schedule, active from cron.job where jobname like 'forgeminds_%';
--   → should return 6 jobs, all active=false (will toggle on after deploy)
--
-- select name from vault.decrypted_secrets where name = 'cron_secret';
--   → should return 'cron_secret'
--
-- select current_setting('app.forgeminds_base_url');
--   → should return 'https://forgeminds.app'
--
-- ─── 6. To enable cron jobs after Vercel deploy ───────────────────────
-- update cron.job set active = true where jobname like 'forgeminds_%';
