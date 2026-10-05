import type { RawArticle, FetchResult } from "@/lib/types/articles";
import { scrubUrl } from "./url-scrub";

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
    // scrubUrl: forward-looking prevention — some runtimes' network-error
    // messages embed the full request URL (which carries `token=`); this
    // fetcher's error string may be persisted to sources.last_error /
    // pipeline_runs.metadata (H1 fix 6).
    return { source: "Finnhub", success: false, items: [], error: scrubUrl((error as Error).message) };
  }
}
