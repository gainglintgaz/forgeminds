export interface RawArticle {
  title: string;
  url: string;
  description: string;
  sourceType: string;
  sourceName: string;
  publishedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ScoredArticle extends RawArticle {
  id: string;
  rawArticleId: string;
  impactScore: number;
  depthScore: number;
  viralScore: number;
  compositeScore: number;
  category: string;
  tone: string;
  reason: string;
  isSerendipity: boolean;
  serendipityType?: "adjacent" | "wildcard";
}

export interface FetchResult {
  source: string;
  success: boolean;
  items: RawArticle[];
  error?: string;
}
