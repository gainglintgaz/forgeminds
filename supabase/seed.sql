-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Seed Data
-- ════════════════════════════════════════════════════════════════════
-- Global entities + aliases. User-specific seeds (Victor's sources)
-- live in app onboarding once auth is wired.
-- ════════════════════════════════════════════════════════════════════

-- ─── Indices ───────────────────────────────────────────────────────
insert into entities (name, type, ticker_symbol, description) values
  ('S&P 500',         'index',     'SPX', 'Standard & Poor''s 500 Index'),
  ('NASDAQ-100',      'index',     'NDX', 'NASDAQ-100 Index'),
  ('Dow Jones',       'index',     'DJI', 'Dow Jones Industrial Average'),
  ('Russell 2000',    'index',     'RUT', 'Russell 2000 Small-Cap Index')
on conflict (name, type) do nothing;

-- ─── Mega-cap stocks ───────────────────────────────────────────────
insert into entities (name, type, ticker_symbol) values
  ('Apple',         'company', 'AAPL'),
  ('Microsoft',     'company', 'MSFT'),
  ('Alphabet',      'company', 'GOOG'),
  ('Amazon',        'company', 'AMZN'),
  ('Nvidia',        'company', 'NVDA'),
  ('Meta',          'company', 'META'),
  ('Tesla',         'company', 'TSLA'),
  ('JPMorgan',      'company', 'JPM'),
  ('Visa',          'company', 'V'),
  ('Walmart',       'company', 'WMT'),
  ('UnitedHealth',  'company', 'UNH'),
  ('Salesforce',    'company', 'CRM'),
  ('AMD',           'company', 'AMD'),
  ('Intel',         'company', 'INTC'),
  ('Disney',        'company', 'DIS'),
  ('Netflix',       'company', 'NFLX'),
  ('Boeing',        'company', 'BA'),
  ('Goldman Sachs', 'company', 'GS'),
  ('Coinbase',      'company', 'COIN'),
  ('Palantir',      'company', 'PLTR')
on conflict (name, type) do nothing;

-- ─── Crypto ────────────────────────────────────────────────────────
insert into entities (name, type, ticker_symbol) values
  ('Bitcoin',   'crypto', 'BTC'),
  ('Ethereum',  'crypto', 'ETH'),
  ('Solana',    'crypto', 'SOL'),
  ('XRP',       'crypto', 'XRP'),
  ('Dogecoin',  'crypto', 'DOGE'),
  ('Cardano',   'crypto', 'ADA'),
  ('Avalanche', 'crypto', 'AVAX'),
  ('Polkadot',  'crypto', 'DOT'),
  ('Chainlink', 'crypto', 'LINK')
on conflict (name, type) do nothing;

-- ─── Commodities ───────────────────────────────────────────────────
insert into entities (name, type, ticker_symbol) values
  ('Gold',      'commodity', 'GC'),
  ('Silver',    'commodity', 'SI'),
  ('Crude Oil', 'commodity', 'CL')
on conflict (name, type) do nothing;

-- ─── Aliases ───────────────────────────────────────────────────────
-- Indices
insert into entity_aliases (entity_id, alias_text, source) values
  ((select id from entities where ticker_symbol='SPX'), 's&p 500',   'manual'),
  ((select id from entities where ticker_symbol='SPX'), 'sp500',     'manual'),
  ((select id from entities where ticker_symbol='SPX'), 'spy',       'manual'),
  ((select id from entities where ticker_symbol='NDX'), 'nasdaq',    'manual'),
  ((select id from entities where ticker_symbol='NDX'), 'qqq',       'manual'),
  ((select id from entities where ticker_symbol='DJI'), 'dow',       'manual'),
  ((select id from entities where ticker_symbol='DJI'), 'djia',      'manual'),
  ((select id from entities where ticker_symbol='RUT'), 'russell',   'manual')
on conflict (alias_text, entity_id) do nothing;

-- Crypto aliases
insert into entity_aliases (entity_id, alias_text, source) values
  ((select id from entities where ticker_symbol='BTC'),  'bitcoin',  'manual'),
  ((select id from entities where ticker_symbol='BTC'),  'btc',      'manual'),
  ((select id from entities where ticker_symbol='ETH'),  'ethereum', 'manual'),
  ((select id from entities where ticker_symbol='ETH'),  'ether',    'manual'),
  ((select id from entities where ticker_symbol='ETH'),  'eth',      'manual'),
  ((select id from entities where ticker_symbol='SOL'),  'solana',   'manual'),
  ((select id from entities where ticker_symbol='XRP'),  'ripple',   'manual'),
  ((select id from entities where ticker_symbol='DOGE'), 'dogecoin', 'manual'),
  ((select id from entities where ticker_symbol='DOGE'), 'doge',     'manual')
on conflict (alias_text, entity_id) do nothing;

-- Company aliases
insert into entity_aliases (entity_id, alias_text, source) values
  ((select id from entities where ticker_symbol='AAPL'), 'apple inc',         'manual'),
  ((select id from entities where ticker_symbol='GOOG'), 'google',            'manual'),
  ((select id from entities where ticker_symbol='GOOG'), 'alphabet inc',      'manual'),
  ((select id from entities where ticker_symbol='META'), 'facebook',          'manual'),
  ((select id from entities where ticker_symbol='META'), 'meta platforms',    'manual'),
  ((select id from entities where ticker_symbol='TSLA'), 'tesla inc',         'manual'),
  ((select id from entities where ticker_symbol='JPM'),  'jpmorgan chase',    'manual'),
  ((select id from entities where ticker_symbol='UNH'),  'unitedhealth group','manual')
on conflict (alias_text, entity_id) do nothing;
