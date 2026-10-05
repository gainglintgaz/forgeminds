-- 20260615000000_entities_seed_ticker_enrichment.sql
--
-- S3 enrichment layer. Additive + idempotent. No destructive ops.
--
-- (1) Seed the entity ontology so the strict ticker/entity resolver has UUIDs to
--     resolve to (entities + entity_aliases were EMPTY). Covers the test user's
--     11 tracked tickers + the major indices.
-- (2) Extend ticker_data for the market read + chart series:
--     intraday_json (S4 charts), interpretation + interpretation_prompt_version (NL read).

-- ── Idempotency keys ──────────────────────────────────────────────────────
create unique index if not exists entities_ticker_uniq
  on public.entities(ticker_symbol) where ticker_symbol is not null;
create unique index if not exists entity_aliases_uniq
  on public.entity_aliases(entity_id, lower(alias_text));

-- ── Seed entities (canonical market identifiers) ──────────────────────────
insert into public.entities (name, type, ticker_symbol) values
  ('Apple Inc.','company','AAPL'),
  ('Microsoft Corporation','company','MSFT'),
  ('NVIDIA Corporation','company','NVDA'),
  ('Tesla, Inc.','company','TSLA'),
  ('Alphabet Inc.','company','GOOGL'),
  ('Amazon.com, Inc.','company','AMZN'),
  ('Meta Platforms, Inc.','company','META'),
  ('SPDR S&P 500 ETF Trust','index','SPY'),
  ('Invesco QQQ Trust','index','QQQ'),
  ('Bitcoin','crypto','BTC'),
  ('Ethereum','crypto','ETH'),
  ('S&P 500 Index','index','^GSPC'),
  ('Nasdaq Composite','index','^IXIC'),
  ('Dow Jones Industrial Average','index','^DJI')
on conflict (ticker_symbol) where ticker_symbol is not null do nothing;

-- ── Seed common-name aliases (join to resolve entity_id) ──────────────────
insert into public.entity_aliases (entity_id, alias_text, source, confidence)
select e.id, a.alias, 'seed', 1.0
from public.entities e
join (values
  ('AAPL','Apple'),('AAPL','Apple Inc'),
  ('MSFT','Microsoft'),
  ('NVDA','Nvidia'),
  ('TSLA','Tesla'),
  ('GOOGL','Alphabet'),('GOOGL','Google'),
  ('AMZN','Amazon'),
  ('META','Meta'),('META','Facebook'),
  ('SPY','S&P 500 ETF'),
  ('QQQ','Nasdaq 100'),('QQQ','Invesco QQQ'),
  ('BTC','Bitcoin'),
  ('ETH','Ethereum'),('ETH','Ether'),
  ('^GSPC','S&P 500'),('^GSPC','SP500'),
  ('^IXIC','Nasdaq'),('^IXIC','Nasdaq Composite'),
  ('^DJI','Dow Jones'),('^DJI','Dow Jones Industrial Average')
) a(ticker, alias) on a.ticker = e.ticker_symbol
on conflict (entity_id, lower(alias_text)) do nothing;

-- ── ticker_data: chart series + NL market read ────────────────────────────
alter table public.ticker_data
  add column if not exists intraday_json jsonb,
  add column if not exists interpretation text,
  add column if not exists interpretation_prompt_version text;
