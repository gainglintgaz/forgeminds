/**
 * Market-data fetchers for the enrich step (S3). Each call is defensive: a
 * provider/network failure returns null and is skipped, never throwing the run.
 * Free-tier shapes:
 *   - Finnhub /quote (price/change), /stock/profile2 (name, market cap),
 *     /stock/metric (52-week high/low, P/E, avg volume).
 *   - CoinGecko /simple/price for crypto (no key needed).
 *   - Alpaca IEX bars for the intraday chart series (S4 consumer).
 * Money is normalized to USD here; the route converts to BIGINT cents (Rule 14).
 */

const timeout = (ms: number) => AbortSignal.timeout(ms);

export interface StockQuote {
  name: string | null;
  priceUsd: number | null;
  changeUsd: number | null;
  changePct: number | null;
  volume: number | null;
  marketCapUsd: number | null;
  high52wUsd: number | null;
  low52wUsd: number | null;
  peRatio: number | null;
  source: string;
}

interface FinnhubQuoteResp { c: number; d: number | null; dp: number | null }

export async function fetchStockData(symbol: string, apiKey: string): Promise<StockQuote | null> {
  const enc = encodeURIComponent(symbol);
  // /quote is the must-have; profile2 + metric are best-effort enrichers.
  let quote: FinnhubQuoteResp | null = null;
  try {
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${enc}&token=${apiKey}`, { signal: timeout(10000) });
    if (r.ok) quote = (await r.json()) as FinnhubQuoteResp;
  } catch (e) { console.error(`[market-data] finnhub quote ${symbol}:`, (e as Error).message); }
  if (!quote || !quote.c || quote.c === 0) return null; // unknown symbol

  let name: string | null = null;
  let marketCapUsd: number | null = null;
  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${enc}&token=${apiKey}`, { signal: timeout(10000) });
    if (r.ok) {
      const p = await r.json();
      name = p?.name ?? null;
      // marketCapitalization is in millions USD.
      marketCapUsd = typeof p?.marketCapitalization === "number" ? p.marketCapitalization * 1_000_000 : null;
    }
  } catch (e) { console.error(`[market-data] finnhub profile2 ${symbol}:`, (e as Error).message); }

  let high52wUsd: number | null = null, low52wUsd: number | null = null, peRatio: number | null = null, volume: number | null = null;
  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${enc}&metric=all&token=${apiKey}`, { signal: timeout(10000) });
    if (r.ok) {
      const m = (await r.json())?.metric ?? {};
      high52wUsd = num(m["52WeekHigh"]);
      low52wUsd = num(m["52WeekLow"]);
      peRatio = num(m.peTTM) ?? num(m.peNormalizedAnnual) ?? num(m.peBasicExclExtraTTM);
      // 10DayAverageTradingVolume is in millions of shares.
      const avgVolM = num(m["10DayAverageTradingVolume"]);
      volume = avgVolM != null ? Math.round(avgVolM * 1_000_000) : null;
    }
  } catch (e) { console.error(`[market-data] finnhub metric ${symbol}:`, (e as Error).message); }

  return {
    name,
    priceUsd: quote.c,
    changeUsd: quote.d ?? null,
    changePct: quote.dp ?? null,
    volume,
    marketCapUsd,
    high52wUsd,
    low52wUsd,
    peRatio,
    source: "finnhub",
  };
}

// Symbol → CoinGecko id (free, no key). Extend as the crypto catalog grows.
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", XRP: "ripple", ADA: "cardano",
  DOGE: "dogecoin", BNB: "binancecoin", AVAX: "avalanche-2", DOT: "polkadot", LTC: "litecoin",
};

export async function fetchCryptoData(symbol: string): Promise<StockQuote | null> {
  const id = COINGECKO_IDS[symbol.toUpperCase()];
  if (!id) return null;
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
      { signal: timeout(10000), headers: { accept: "application/json" } }
    );
    if (!r.ok) return null;
    const d = (await r.json())?.[id];
    if (!d || typeof d.usd !== "number") return null;
    const price = d.usd as number;
    const changePct = num(d.usd_24h_change);
    return {
      name: id.charAt(0).toUpperCase() + id.slice(1),
      priceUsd: price,
      changeUsd: changePct != null ? (price * changePct) / 100 : null,
      changePct,
      volume: null,
      marketCapUsd: num(d.usd_market_cap),
      high52wUsd: null, // 52-week not in the simple endpoint; P/E n/a for crypto
      low52wUsd: null,
      peRatio: null,
      source: "coingecko",
    };
  } catch (e) {
    console.error(`[market-data] coingecko ${symbol}:`, (e as Error).message);
    return null;
  }
}

export interface IntradaySeries {
  source: string;
  timeframe: string;
  bars: Array<{ t: string; c: number }>;
}

/** Intraday 5-min bars via Alpaca IEX (free). Best-effort — null on any failure. */
export async function fetchIntradayAlpaca(
  symbol: string,
  keyId: string,
  secret: string
): Promise<IntradaySeries | null> {
  try {
    // Last ~2 days of 5-min IEX bars (covers the latest session incl. after-hours gaps).
    const start = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    const r = await fetch(
      `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=5Min&start=${start}&feed=iex&limit=200&sort=asc`,
      { signal: timeout(12000), headers: { "APCA-API-KEY-ID": keyId, "APCA-API-SECRET-KEY": secret } }
    );
    if (!r.ok) return null;
    const bars = (await r.json())?.bars;
    if (!Array.isArray(bars) || bars.length === 0) return null;
    return {
      source: "alpaca_iex",
      timeframe: "5Min",
      bars: bars.map((b: { t: string; c: number }) => ({ t: b.t, c: b.c })),
    };
  } catch (e) {
    console.error(`[market-data] alpaca bars ${symbol}:`, (e as Error).message);
    return null;
  }
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && !Number.isNaN(n) ? n : null;
}
