-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — E1 fix 3: scope test user 3707759d's sources to finance
-- ════════════════════════════════════════════════════════════════════
-- 2026-07-08-honest-audit.md root cause #3: the `sources` table (which
-- `ingest`/route.ts reads directly, per-user, is_active-filtered — NOT
-- `source_catalog`, which is a discovery/suggestion layer only) contained
-- generic bbci.co.uk/news/world + theguardian.com/world feeds competing for
-- category-diversity seats against Fed/ECB/markets content. Deactivate the
-- generic world feeds (soft, not deleted — data-protection.md §6, reversible)
-- and add curated markets/crypto RSS feeds already vetted in
-- supabase/seeds/source_catalog/finance/markets.sql.
--
-- Idempotent — the UPDATE is a no-op if already deactivated; the INSERT
-- upserts on the (user_id, type, url) unique constraint
-- (sources_user_id_type_url_key, migration 20260517000000).
-- ════════════════════════════════════════════════════════════════════

update public.sources
set is_active = false, updated_at = now()
where user_id = '3707759d-9863-4f69-a6d8-f40036fa15f1'
  and url in (
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.theguardian.com/world/rss'
  );

insert into public.sources (user_id, name, type, url, config, is_active)
values
  ('3707759d-9863-4f69-a6d8-f40036fa15f1', 'WSJ Markets', 'rss', 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', '{}'::jsonb, true),
  ('3707759d-9863-4f69-a6d8-f40036fa15f1', 'Yahoo Finance News', 'rss', 'https://finance.yahoo.com/news/rssindex', '{}'::jsonb, true),
  ('3707759d-9863-4f69-a6d8-f40036fa15f1', 'Bloomberg Markets', 'rss', 'https://feeds.bloomberg.com/markets/news.rss', '{}'::jsonb, true),
  ('3707759d-9863-4f69-a6d8-f40036fa15f1', 'CoinDesk', 'rss', 'https://www.coindesk.com/arc/outboundfeeds/rss/', '{}'::jsonb, true)
on conflict (user_id, type, url) do update set is_active = true, name = excluded.name;
