import type { RawArticle, FetchResult } from "@/lib/types/articles";
import { scrubUrl } from "./url-scrub";

export async function fetchAlphaVantageNews(): Promise<FetchResult> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) return { source: "AlphaVantage", success: false, items: [], error: "No API key" };

  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&limit=50&apikey=${apiKey}&sort=LATEST`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      return { source: "AlphaVantage", success: false, items: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    if (data?.Information) {
      return { source: "AlphaVantage", success: false, items: [], error: `API limit: ${data.Information}` };
    }

    const items: RawArticle[] = (data?.feed || [])
      .filter((item: Record<string, unknown>) => item.source_domain || item.source)
      .map((item: Record<string, unknown>) => {
        let publishedAt = new Date().toISOString();
        const t = item.time_published as string;
        if (t?.length >= 13) {
          const parsed = new Date(
            `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:00Z`
          );
          if (!isNaN(parsed.getTime())) publishedAt = parsed.toISOString();
        }

        return {
          title: (item.title as string) || "",
          url: (item.url as string) || "",
          description: ((item.summary as string)?.trim() || (item.title as string) || "").slice(0, 500),
          sourceType: "alpha_vantage",
          sourceName: `AlphaVantage (${item.source_domain || item.source})`,
          publishedAt,
          metadata: { sentiment: item.overall_sentiment_score },
        };
      });

    return { source: "AlphaVantage", success: true, items };
  } catch (error) {
    // scrubUrl: forward-looking prevention (H1 fix 6) — see finnhub.ts note.
    return { source: "AlphaVantage", success: false, items: [], error: scrubUrl((error as Error).message) };
  }
}
