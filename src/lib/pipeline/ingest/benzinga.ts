import type { RawArticle, FetchResult } from "@/lib/types/articles";
import { scrubUrl } from "./url-scrub";

export async function fetchBenzingaNews(windowMinutes: number = 120): Promise<FetchResult> {
  const apiKey = process.env.BENZINGA_API_KEY;
  if (!apiKey) return { source: "Benzinga", success: false, items: [], error: "No API key" };

  try {
    const dateFrom = new Date(Date.now() - windowMinutes * 60 * 1000)
      .toISOString()
      .replace("T", " ")
      .split(".")[0];

    const response = await fetch(
      `https://api.benzinga.com/api/v2/news?token=${apiKey}&display_output=full&date_from=${dateFrom}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      return { source: "Benzinga", success: false, items: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    const items: RawArticle[] = (data || []).map((item: Record<string, unknown>) => ({
      title: (item.title as string) || "",
      url: (item.url as string) || "",
      description: ((item.teaser as string)?.trim() || (item.title as string) || "").slice(0, 500),
      sourceType: "benzinga",
      sourceName: "Benzinga",
      publishedAt: new Date(item.created as string).toISOString(),
    }));

    return { source: "Benzinga", success: true, items };
  } catch (error) {
    // scrubUrl: forward-looking prevention (H1 fix 6) — see finnhub.ts note.
    return { source: "Benzinga", success: false, items: [], error: scrubUrl((error as Error).message) };
  }
}
