// CoinGecko ingester — Phase 1 stub. FetchResult import will return when the
// stub becomes a real fetcher in Phase 1.

export interface CryptoPrice {
  symbol: string;
  name: string;
  currentPrice: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume: number;
  marketCap: number;
}

const TOP_CRYPTOS = "bitcoin,ethereum,solana,ripple,dogecoin,cardano,binancecoin,avalanche-2,polkadot,chainlink";

export async function fetchCryptoPrices(): Promise<{ success: boolean; prices: CryptoPrice[]; error?: string }> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${TOP_CRYPTOS}&order=market_cap_desc&sparkline=false`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      return { success: false, prices: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    const prices: CryptoPrice[] = (data || []).map((coin: Record<string, unknown>) => ({
      symbol: ((coin.symbol as string) || "").toUpperCase(),
      name: (coin.name as string) || "",
      currentPrice: (coin.current_price as number) || 0,
      changePercent24h: (coin.price_change_percentage_24h as number) || 0,
      high24h: (coin.high_24h as number) || 0,
      low24h: (coin.low_24h as number) || 0,
      volume: (coin.total_volume as number) || 0,
      marketCap: (coin.market_cap as number) || 0,
    }));

    return { success: true, prices };
  } catch (error) {
    return { success: false, prices: [], error: (error as Error).message };
  }
}
