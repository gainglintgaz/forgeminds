import type { RawArticle, FetchResult } from "@/lib/types/articles";

export async function fetchAlpacaNews(windowMinutes: number = 120): Promise<FetchResult> {
  const apiKey = process.env.ALPACA_API_KEY;
  const secretKey = process.env.ALPACA_SECRET_KEY;
  if (!apiKey || !secretKey) return { source: "Alpaca", success: false, items: [], error: "No API keys" };

  try {
    const start = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const response = await fetch(
      `https://data.alpaca.markets/v1beta1/news?start=${start}&limit=50`,
      {
        headers: {
          "APCA-API-KEY-ID": apiKey,
          "APCA-API-SECRET-KEY": secretKey,
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      return { source: "Alpaca", success: false, items: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    const items: RawArticle[] = (data?.news || []).map((item: Record<string, unknown>) => ({
      title: (item.headline as string) || "",
      url: (item.url as string) || "",
      description: ((item.summary as string)?.trim() || (item.headline as string) || "").slice(0, 500),
      sourceType: "alpaca",
      sourceName: "Alpaca",
      publishedAt: new Date(item.created_at as string).toISOString(),
    }));

    return { source: "Alpaca", success: true, items };
  } catch (error) {
    return { source: "Alpaca", success: false, items: [], error: (error as Error).message };
  }
}
