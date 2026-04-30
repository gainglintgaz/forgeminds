import type { RawArticle } from "@/lib/types/articles";

export function filterRecent(
  articles: RawArticle[],
  windowMinutes: number = 120
): { recent: RawArticle[]; dropped: number } {
  const cutoff = Date.now() - windowMinutes * 60 * 1000;

  const recent = articles.filter((article) => {
    const pubTime = new Date(article.publishedAt).getTime();
    return !isNaN(pubTime) && pubTime > cutoff;
  });

  return { recent, dropped: articles.length - recent.length };
}
