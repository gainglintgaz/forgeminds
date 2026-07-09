import { parseStringPromise } from "xml2js";
import type { RawArticle, FetchResult } from "@/lib/types/articles";

const FEED_TIMEOUT_MS = 12000;

const KNOWN_SOURCES: Record<string, string> = {
  "yahoo.com": "Yahoo",
  "nasdaq.com": "Nasdaq",
  "benzinga.com": "Benzinga",
  "wsj.com": "WSJ",
  "bloomberg.com": "Bloomberg",
  "reuters.com": "Reuters",
  "cnbc.com": "CNBC",
  "marketwatch.com": "MarketWatch",
  "seekingalpha.com": "SeekingAlpha",
  "fool.com": "MotleyFool",
  "investors.com": "IBD",
  "barrons.com": "Barrons",
  "coindesk.com": "CoinDesk",
  "cointelegraph.com": "CoinTelegraph",
  "decrypt.co": "Decrypt",
  "techcrunch.com": "TechCrunch",
  "apnews.com": "AP News",
};

function inferSource(feedUrl: string): string {
  for (const [domain, name] of Object.entries(KNOWN_SOURCES)) {
    if (feedUrl.includes(domain)) return name;
  }
  try {
    return new URL(feedUrl).hostname.replace("www.", "").split(".")[0].toUpperCase();
  } catch {
    return "UNKNOWN";
  }
}

export async function fetchRSSFeed(feedUrl: string): Promise<FetchResult> {
  const source = inferSource(feedUrl);

  try {
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "ForgeMinds/1.0 (RSS Reader)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { source, success: false, items: [], error: `HTTP ${response.status}` };
    }

    const text = await response.text();
    const parsed = await parseStringPromise(text);

    let rawItems: unknown[] = [];
    if (parsed?.rss?.channel?.[0]?.item) {
      rawItems = parsed.rss.channel[0].item;
    } else if (parsed?.feed?.entry) {
      rawItems = parsed.feed.entry;
    }

    const items: RawArticle[] = (rawItems as Record<string, unknown>[]).map((item: Record<string, unknown>) => {
      const titleArr = item.title as string[] | Array<{ _: string }> | undefined;
      const linkArr = item.link as string[] | Array<{ $: { href: string } }> | undefined;
      const guidArr = item.guid as string[] | Array<{ _: string }> | undefined;
      const descArr = item.description as string[] | Array<{ _: string }> | undefined;
      const summaryArr = item.summary as string[] | Array<{ _: string }> | undefined;
      const pubDateArr = item.pubDate as string[] | undefined;
      const publishedArr = item.published as string[] | undefined;
      const updatedArr = item.updated as string[] | undefined;

      const title = (
        (titleArr?.[0] as { _: string })?._  || titleArr?.[0] || ""
      ).toString().trim();

      const url = (
        (linkArr?.[0] as { $: { href: string } })?.$ ?.href ||
        linkArr?.[0] ||
        (guidArr?.[0] as { _: string })?._  ||
        guidArr?.[0] ||
        ""
      ).toString().trim();

      const description = (
        (descArr?.[0] as { _: string })?._  ||
        descArr?.[0] ||
        (summaryArr?.[0] as { _: string })?._  ||
        summaryArr?.[0] ||
        ""
      ).toString().replace(/<[^>]*>/g, "").slice(0, 500).trim();

      const publishedAt = (pubDateArr?.[0] || publishedArr?.[0] || updatedArr?.[0] || "").toString();

      return {
        title,
        url,
        description,
        sourceType: "rss",
        sourceName: source,
        publishedAt,
      };
    });

    return { source, success: true, items };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const msg = err.name === "TimeoutError"
      ? `Timeout (${FEED_TIMEOUT_MS}ms)`
      : err.message || "Unknown error";
    return { source, success: false, items: [], error: msg };
  }
}

/** Per-URL fetch outcome — lets the caller attribute a failure to the exact
 *  `sources` row it came from (H1 fix 2, architecture §7 assumption 2). This
 *  is the one non-additive signature change in the H1 slice, contained to
 *  this file + its single call site in ingest/route.ts. */
export interface RssUrlResult {
  url: string;
  success: boolean;
  error?: string;
}

export async function fetchAllRSSFeeds(feedUrls: string[]): Promise<{
  articles: RawArticle[];
  successCount: number;
  errorCount: number;
  errors: string[];
  results: RssUrlResult[];
}> {
  const results = await Promise.allSettled(
    feedUrls.map((url) => fetchRSSFeed(url))
  );

  const articles: RawArticle[] = [];
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];
  const perUrlResults: RssUrlResult[] = [];

  results.forEach((result, i) => {
    const url = feedUrls[i];
    const val = result.status === "fulfilled"
      ? result.value
      : { success: false, source: "unknown", items: [], error: (result.reason as Error)?.message };

    if (val.success) {
      articles.push(...val.items);
      successCount++;
      perUrlResults.push({ url, success: true });
    } else {
      errorCount++;
      errors.push(`${val.source}: ${val.error}`);
      perUrlResults.push({ url, success: false, error: val.error });
    }
  });

  return { articles, successCount, errorCount, errors, results: perUrlResults };
}
