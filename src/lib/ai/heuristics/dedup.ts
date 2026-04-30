import type { RawArticle } from "@/lib/types/articles";
import { createHash } from "crypto";

export function generateContentHash(article: RawArticle): string {
  const normalized = (article.url || article.title)
    .toLowerCase()
    .split("?")[0]
    .split("#")[0]
    .trim();

  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export function deduplicateArticles(articles: RawArticle[]): { unique: RawArticle[]; dropped: number } {
  const seen = new Map<string, RawArticle>();

  for (const article of articles) {
    const key = article.url
      ? article.url.split("?")[0].split("#")[0].toLowerCase()
      : article.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80);

    if (!key) continue;
    if (!seen.has(key)) {
      seen.set(key, article);
    }
  }

  const unique = Array.from(seen.values());
  return { unique, dropped: articles.length - unique.length };
}
