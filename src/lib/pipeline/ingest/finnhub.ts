import type { RawArticle, FetchResult } from "@/lib/types/articles";

export async function fetchFinnhubNews(): Promise<FetchResult> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return { source: "Finnhub", success: false, items: [], error: "No API key" };

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      return { source: "Finnhub", success: false, items: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    const items: RawArticle[] = (data || []).map((item: Record<string, unknown>) => ({
      title: (item.headline as string) || "",
      url: (item.url as string) || "",
      description: ((item.summary as string)?.trim() || (item.headline as string) || "").slice(0, 500),
      sourceType: "finnhub",
      sourceName: "Finnhub",
      publishedAt: item.datetime
        ? new Date((item.datetime as number) * 1000).toISOString()
        : new Date().toISOString(),
    }));

    return { source: "Finnhub", success: true, items };
  } catch (error) {
    return { source: "Finnhub", success: false, items: [], error: (error as Error).message };
  }
}
