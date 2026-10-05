-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds source_catalog — finance / markets
-- Curated by source-catalog-curator subagent on 2026-06-15
-- All RSS feed URLs verified reachable + producing valid feed content
-- API-type rows (finnhub, benzinga, alpaca, alpha_vantage) are catalog
-- metadata entries for the existing fetchers in src/lib/pipeline/ingest/
-- ════════════════════════════════════════════════════════════════════
--
-- Subcategories covered:
--   markets_stocks   — equity markets news (WSJ, Yahoo Finance, Bloomberg, Benzinga, Seeking Alpha, Investing.com)
--   macro_economics  — macro/economic data APIs (Finnhub, Alpha Vantage, Alpaca)
--   crypto           — digital asset news (CoinDesk, The Block, Decrypt)
--   finance_data     — financial data APIs already wired in ingest layer
--
-- NOT duplicated from monetary_policy.sql:
--   Federal Reserve, ECB, BIS, Bank of Canada, Brookings, Bloomberg Economics RSS,
--   Chartbook / Calculated Risk Substack, Macro Musings podcast, Odd Lots podcast
--
-- Sources verified but REJECTED (listed at bottom of file)
-- ════════════════════════════════════════════════════════════════════

insert into public.source_catalog (
  name, type, url, description, categories, subcategories,
  paywall_tier, paywall_cost_usd_monthly, update_cadence, geography,
  quality_score, requires_oauth, oauth_provider, recommended_for_topics
) values

  -- ──────────────────────────────────────────────────────────────
  -- MARKETS / STOCKS NEWS  (RSS feeds)
  -- ──────────────────────────────────────────────────────────────

  (
    'WSJ Markets',
    'rss',
    'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    'Wall Street Journal markets desk RSS — equity, bonds, commodities, and currency coverage from a Pulitzer-standard newsroom; 20 items updated throughout the US trading day.',
    array['finance'],
    array['markets_stocks', 'macro_economics'],
    'freemium',
    null,
    'daily',
    array['us', 'global'],
    0.88,
    false,
    null,
    array['stock_market', 'equities', 'bonds', 'commodities', 'currencies', 'market_news', 'earnings', 'sp500', 'nasdaq']
  ),

  (
    'WSJ US Business',
    'rss',
    'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml',
    'Wall Street Journal US business news RSS — corporate strategy, M&A, executive decisions, and industry dynamics that drive equity valuations.',
    array['finance'],
    array['markets_stocks', 'macro_economics'],
    'freemium',
    null,
    'daily',
    array['us'],
    0.87,
    false,
    null,
    array['corporate_news', 'mergers_acquisitions', 'earnings', 'us_business', 'market_moving_news', 'aapl', 'msft', 'googl', 'amzn', 'meta']
  ),

  (
    'Yahoo Finance News',
    'rss',
    'https://finance.yahoo.com/news/rssindex',
    'Yahoo Finance aggregated markets RSS — 50 items pulling from Reuters, AP, Bloomberg, and Yahoo Finance editorial covering equities, macro, and earnings; highest raw volume of any verified finance feed.',
    array['finance'],
    array['markets_stocks', 'macro_economics', 'crypto'],
    'free',
    null,
    'hourly',
    array['us', 'global'],
    0.72,
    false,
    null,
    array['stock_market', 'equities', 'earnings', 'market_news', 'aapl', 'msft', 'nvda', 'tsla', 'googl', 'amzn', 'meta', 'spy', 'qqq', 'btc', 'eth']
  ),

  (
    'Bloomberg Markets',
    'rss',
    'https://feeds.bloomberg.com/markets/news.rss',
    'Bloomberg Markets RSS — 30 items from Bloomberg''s markets reporting team covering equities, credit, FX, commodities, and derivatives with the depth expected from a terminal-grade newsroom.',
    array['finance'],
    array['markets_stocks', 'macro_economics'],
    'freemium',
    null,
    'daily',
    array['us', 'global'],
    0.89,
    false,
    null,
    array['stock_market', 'equities', 'bonds', 'credit_markets', 'commodities', 'forex', 'derivatives', 'sp500', 'nasdaq', 'market_news']
  ),

  (
    'Benzinga News',
    'rss',
    'https://www.benzinga.com/feed',
    'Benzinga markets RSS — hourly updates covering pre-market movers, analyst rating changes, earnings beats/misses, and options flow; high signal for retail traders tracking specific tickers.',
    array['finance'],
    array['markets_stocks'],
    'freemium',
    null,
    'hourly',
    array['us'],
    0.68,
    false,
    null,
    array['stock_market', 'analyst_ratings', 'earnings', 'options_flow', 'pre_market_movers', 'aapl', 'msft', 'nvda', 'tsla', 'googl', 'amzn', 'meta']
  ),

  (
    'Seeking Alpha',
    'rss',
    'https://seekingalpha.com/feed.xml',
    'Seeking Alpha RSS — 40 items mixing sell-side-style analysis, earnings call presentations, and long-form investment theses from a contributor platform with over 16,000 analysts; quality varies but depth is high when on-topic.',
    array['finance'],
    array['markets_stocks'],
    'freemium',
    null,
    'daily',
    array['us', 'global'],
    0.65,
    false,
    null,
    array['stock_analysis', 'investment_thesis', 'earnings', 'dividend_stocks', 'growth_stocks', 'aapl', 'msft', 'nvda', 'tsla', 'spy', 'qqq']
  ),

  (
    'Investing.com Markets',
    'rss',
    'https://www.investing.com/rss/news_25.rss',
    'Investing.com global markets RSS — 10 items covering Asian markets, geopolitical market impacts, M&A, commodities, and institutional moves; strong on non-US market angles missing from US-centric feeds.',
    array['finance'],
    array['markets_stocks', 'macro_economics'],
    'freemium',
    null,
    'daily',
    array['global', 'us', 'eu'],
    0.66,
    false,
    null,
    array['global_markets', 'stock_market', 'commodities', 'mergers_acquisitions', 'asian_markets', 'geopolitical_market_impact', 'nikkei', 'market_news']
  ),

  -- ──────────────────────────────────────────────────────────────
  -- CRYPTO NEWS  (RSS feeds)
  -- ──────────────────────────────────────────────────────────────

  (
    'CoinDesk',
    'rss',
    'https://www.coindesk.com/arc/outboundfeeds/rss/',
    'CoinDesk RSS — 26 items from the longest-running crypto news organization; covers Bitcoin, Ethereum, DeFi, regulatory developments, and institutional crypto adoption with newsroom editorial standards.',
    array['finance'],
    array['crypto'],
    'free',
    null,
    'hourly',
    array['global', 'us'],
    0.80,
    false,
    null,
    array['crypto', 'bitcoin', 'ethereum', 'defi', 'crypto_regulation', 'nft', 'web3', 'institutional_crypto', 'btc', 'eth']
  ),

  (
    'The Block',
    'rss',
    'https://theblock.co/rss.xml',
    'The Block RSS — 20 items from a research-focused crypto newsroom; strongest on data-driven coverage of on-chain metrics, venture funding rounds, and regulatory filings affecting digital assets.',
    array['finance'],
    array['crypto'],
    'freemium',
    null,
    'daily',
    array['global', 'us'],
    0.78,
    false,
    null,
    array['crypto', 'bitcoin', 'ethereum', 'defi', 'crypto_venture_funding', 'on_chain_metrics', 'crypto_regulation', 'btc', 'eth']
  ),

  (
    'Decrypt',
    'rss',
    'https://decrypt.co/feed',
    'Decrypt RSS — 40 items targeting the mainstream crypto reader; covers Bitcoin and Ethereum price action, NFTs, Web3 gaming, and consumer-facing DeFi with clear explanatory writing style.',
    array['finance'],
    array['crypto'],
    'free',
    null,
    'hourly',
    array['global', 'us'],
    0.71,
    false,
    null,
    array['crypto', 'bitcoin', 'ethereum', 'nft', 'web3', 'defi', 'crypto_prices', 'btc', 'eth']
  ),

  -- ──────────────────────────────────────────────────────────────
  -- FINANCIAL DATA APIs  (catalog metadata for existing fetchers)
  -- These rows register the four ingest-layer fetchers that have
  -- no source_catalog entry; the url is the base API endpoint.
  -- paywall_tier='byos' means the user supplies their own API key.
  -- ──────────────────────────────────────────────────────────────

  (
    'Finnhub',
    'finnhub',
    'https://finnhub.io/api/v1',
    'Finnhub real-time stock API — company news, earnings surprises, analyst recommendations, SEC filings, and market news filtered by ticker; the primary per-ticker news source in the ForgeMinds ingest pipeline.',
    array['finance'],
    array['markets_stocks', 'macro_economics', 'finance_data'],
    'byos',
    null,
    'realtime',
    array['us', 'global'],
    0.85,
    false,
    null,
    array['stock_news', 'earnings', 'analyst_ratings', 'sec_filings', 'company_news', 'aapl', 'msft', 'nvda', 'tsla', 'googl', 'amzn', 'meta', 'spy', 'qqq']
  ),

  (
    'Benzinga API',
    'benzinga',
    'https://api.benzinga.com/api/v2',
    'Benzinga Pro API — structured news feed with per-ticker filtering, analyst ratings changes, and earnings calendars; higher fidelity than the public RSS and machine-parseable JSON.',
    array['finance'],
    array['markets_stocks', 'finance_data'],
    'byos',
    null,
    'realtime',
    array['us'],
    0.75,
    false,
    null,
    array['stock_news', 'analyst_ratings', 'earnings_calendar', 'options_flow', 'pre_market_movers', 'aapl', 'msft', 'nvda', 'tsla']
  ),

  (
    'Alpaca Markets News',
    'alpaca',
    'https://data.alpaca.markets/v1beta1',
    'Alpaca data API — broker-grade market news endpoint returning machine-readable JSON articles tagged by ticker symbol; pairs naturally with Alpaca trading data for ForgeMinds portfolio context.',
    array['finance'],
    array['markets_stocks', 'finance_data'],
    'byos',
    null,
    'realtime',
    array['us'],
    0.78,
    false,
    null,
    array['stock_news', 'market_news', 'ticker_news', 'aapl', 'msft', 'nvda', 'tsla', 'googl', 'amzn', 'meta', 'spy', 'qqq']
  ),

  (
    'Alpha Vantage',
    'alpha_vantage',
    'https://www.alphavantage.co/query',
    'Alpha Vantage API — fundamental data, time-series price data, forex, and economic indicators (CPI, GDP, unemployment, treasury yields) in structured JSON; the macro data backbone of the ForgeMinds ingest pipeline.',
    array['finance'],
    array['markets_stocks', 'macro_economics', 'finance_data'],
    'byos',
    null,
    'daily',
    array['us', 'global'],
    0.80,
    false,
    null,
    array['stock_prices', 'fundamental_data', 'economic_indicators', 'cpi', 'gdp', 'treasury_yields', 'unemployment', 'forex', 'commodities', 'spy', 'qqq']
  )

on conflict (type, url) do update set
  name                    = excluded.name,
  description             = excluded.description,
  categories              = excluded.categories,
  subcategories           = excluded.subcategories,
  paywall_tier            = excluded.paywall_tier,
  paywall_cost_usd_monthly = excluded.paywall_cost_usd_monthly,
  update_cadence          = excluded.update_cadence,
  quality_score           = excluded.quality_score,
  recommended_for_topics  = excluded.recommended_for_topics,
  updated_at              = now();

-- ════════════════════════════════════════════════════════════════════
-- REJECTED SOURCES — not included, reason documented
-- ════════════════════════════════════════════════════════════════════
--
-- MarketWatch RSS (feeds.marketwatch.com/marketwatch/topstories/)
--   REJECTED: WebFetch returned "unable to fetch" — feed blocked or gated.
--
-- MarketWatch RSS alternate (www.marketwatch.com/rss/topstories)
--   REJECTED: WebFetch returned "unable to fetch" — same block pattern.
--
-- CNBC Markets RSS (www.cnbc.com/id/100003114/device/rss/rss.html)
--   REJECTED: HTTP 403 Forbidden — CNBC blocks external RSS consumption.
--
-- CNBC US Business RSS (www.cnbc.com/id/15839069/device/rss/rss.html)
--   REJECTED: HTTP 403 Forbidden — same CNBC block.
--
-- Reuters Business RSS (feeds.reuters.com/reuters/businessNews)
--   REJECTED: WebFetch returned "unable to fetch" — Reuters has removed
--   public RSS; canonical content is now on reuters.com only.
--
-- BLS (Bureau of Labor Statistics) RSS (www.bls.gov/feed/rss_latest.xml)
--   REJECTED: HTTP 403 Forbidden — BLS blocks external RSS fetching.
--
-- BEA (Bureau of Economic Analysis) RSS (www.bea.gov/rss/homepage.xml)
--   REJECTED: HTTP 404 Not Found — feed URL does not exist.
--
-- BEA RSS alternate (www.bea.gov/rss/all.xml)
--   REJECTED: HTTP 404 Not Found.
--
-- US Treasury press releases RSS (home.treasury.gov/news/press-releases.xml)
--   REJECTED: HTTP timeout — feed unreachable within verification window.
--
-- US Treasury RSS alternate (home.treasury.gov/news/press-releases/feed)
--   REJECTED: HTTP timeout — same result.
--
-- Financial Times RSS (www.ft.com/?format=rss)
--   REJECTED: Claude Code domain block on www.ft.com — cannot verify.
--   NOTE: FT does publish an RSS feed; if verified via a different
--   verification method it would score ~0.88, paywall_tier='paid',
--   paywall_cost_usd_monthly=40.00 (FT Digital $39.99/mo as of 2026).
--
-- Reddit finance communities (r/investing, r/stocks, r/CryptoCurrency)
--   REJECTED: Claude Code domain block on www.reddit.com — cannot verify
--   via WebFetch as required by curator protocol. These subreddits are
--   well-known to be active (>10K posts/day combined) and would be
--   cataloged as type='reddit_subreddit' if verification were possible.
--
-- Finviz news feed (finviz.com/news_feed.ashx)
--   REJECTED: HTTP 404 Not Found.
--
-- Investing.com forex RSS (www.investing.com/rss/news_1.rss)
--   EXCLUDED: feed is forex-specific, not stock markets; irrelevant to
--   tracked tickers (AAPL, MSFT, NVDA, TSLA, GOOGL, AMZN, META, SPY,
--   QQQ, BTC, ETH). Would add noise to the ingest pipeline.
--
-- FRED API (api.stlouisfed.org)
--   EXCLUDED: already covered effectively by monetary_policy.sql via
--   the Federal Reserve feeds; additionally requires a user-supplied
--   API key. Alpha Vantage covers overlapping macro indicators. If a
--   direct FRED API integration is built, add as type='custom_api' then.
-- ════════════════════════════════════════════════════════════════════
