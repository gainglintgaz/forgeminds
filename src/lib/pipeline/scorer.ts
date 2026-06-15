import { routeAIRequest } from "@/lib/ai/router";
import type { AIResponse } from "@/lib/types/ai";

interface ArticleToScore {
  id: string;
  title: string;
  description: string;
  sourceName: string;
}

/**
 * The reader's interest graph (per-user, from user_preferences). Drives the
 * relevance dimension so the brief favors THIS user's topics/tickers instead of
 * whichever generic feed is loudest (ERR-020). Empty arrays = cold start →
 * relevance falls back to general importance (graceful, never fabricated).
 */
export interface UserInterest {
  topics: string[];
  trackedTickers: string[];
  excludedTopics: string[];
}

export interface ScoreResult {
  articleId: string;
  /** 1-10 match to the reader's declared interests (or general importance if none). */
  relevanceScore: number;
  impactScore: number;
  depthScore: number;
  viralScore: number;
  compositeScore: number;
  /** One of the 13 canonical category slugs (resolved downstream to a UUID). */
  category: string;
  tone: string;
  reason: string;
}

export interface ScoreRunTelemetry {
  scores: ScoreResult[];
  aiResponse: AIResponse | null;
  /** Count of AI router calls that returned a usable response (one per batch). */
  aiCallsMade: number;
  /** Sum of input+output tokens across every successful batch call. */
  aiTokensUsed: number;
  /** Sum of estimated USD cost across every successful batch call. */
  aiCostUsd: number;
}

// The 13 canonical category slugs (single source of truth = source_catalog +
// the categories table). The model MUST choose exactly one of these. Layer-1
// universal taxonomy — NOT finance-specific (per ARCHITECTURE §1 layer boundary).
const CANONICAL_CATEGORIES = [
  "finance",
  "tech",
  "sciences",
  "medicine",
  "health",
  "geopolitics",
  "civic",
  "legal_tax",
  "career",
  "education",
  "arts",
  "lifestyle",
  "sports",
] as const;

function buildInterestBlock(interest: UserInterest): string {
  const hasTopics = interest.topics.length > 0;
  const hasTickers = interest.trackedTickers.length > 0;
  const hasExcluded = interest.excludedTopics.length > 0;

  if (!hasTopics && !hasTickers && !hasExcluded) {
    return `READER INTERESTS: (none declared yet) — score relevance_score by general importance to an informed reader. Do NOT invent a preference.`;
  }
  const lines = ["READER INTERESTS — score relevance_score HIGH (8-10) for items that match these, LOW (1-3) for items that don't:"];
  if (hasTopics) lines.push(`- Topics the reader cares about: ${interest.topics.join("; ")}`);
  if (hasTickers) lines.push(`- Tickers/companies the reader tracks: ${interest.trackedTickers.join(", ")}`);
  if (hasExcluded) lines.push(`- Excluded topics (force relevance_score 1-2): ${interest.excludedTopics.join("; ")}`);
  return lines.join("\n");
}

export async function scoreArticles(
  articles: ArticleToScore[],
  interest: UserInterest = { topics: [], trackedTickers: [], excludedTopics: [] },
  batchSize: number = 15
): Promise<ScoreRunTelemetry> {
  if (articles.length === 0)
    return { scores: [], aiResponse: null, aiCallsMade: 0, aiTokensUsed: 0, aiCostUsd: 0 };

  const batches: ArticleToScore[][] = [];
  for (let i = 0; i < articles.length; i += batchSize) {
    batches.push(articles.slice(i, i + batchSize));
  }

  const allScores: ScoreResult[] = [];
  let lastAiResponse: AIResponse | null = null;
  // Telemetry gate (ERR-019 / lessons.md #104): the AI fired but was invisible
  // because pipeline_runs.ai_calls_made/ai_tokens_used were never populated.
  // Aggregate the real router usage across batches so the run can record it.
  let aiCallsMade = 0;
  let aiTokensUsed = 0;
  let aiCostUsd = 0;

  const interestBlock = buildInterestBlock(interest);

  for (const batch of batches) {
    const prompt = `You are a relevance + importance scorer for a personal intelligence brief.

${interestBlock}

SCORING (each 1-10):
- relevance_score: how well this matches the READER INTERESTS above (see rules there).
- impact_score: real-world significance. Routine price updates / market summaries / analyst ratings / routine earnings: < 5. Deep analysis, novel insight, major event: >= 5. Scandals, policy shifts, transformative M&A: 7+.
- depth_score: substance + source credibility (1 = headline/clickbait, 10 = deep reporting/primary source).
- viral_score: how new + talked-about this is.

CATEGORY: classify into EXACTLY ONE of these canonical slugs (output the slug verbatim, lowercase):
${CANONICAL_CATEGORIES.join(", ")}
If none fit, output "uncategorized". Never invent a category.

Tones: neutral, bullish, bearish, mixed.

Return JSON: {"items":[{"id":"...","category":"<slug>","relevance_score":N,"impact_score":N,"depth_score":N,"viral_score":N,"tone":"...","reason":"1 sentence"}]}

Articles:
${JSON.stringify(batch.map((a) => ({ id: a.id, title: a.title, summary: a.description?.slice(0, 400) })))}`;

    try {
      const response = await routeAIRequest({
        task: "score",
        prompt,
        jsonMode: true,
        // Headroom for a 15-item batch of structured scores (id + 4 dims +
        // category + tone + reason each). 2048 can truncate → parse failure.
        maxTokens: 4096,
      });

      lastAiResponse = response;
      aiCallsMade += 1;
      aiTokensUsed += (response.inputTokens || 0) + (response.outputTokens || 0);
      aiCostUsd += response.costEstimateUsd || 0;

      const parsed = JSON.parse(response.content);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      for (const item of items) {
        const relevance = Math.min(10, Math.max(1, Number(item.relevance_score) || 5));
        const impact = Math.min(10, Math.max(1, Number(item.impact_score) || 5));
        const depth = Math.min(10, Math.max(1, Number(item.depth_score) || 5));
        const viral = Math.min(10, Math.max(1, Number(item.viral_score) || 5));

        allScores.push({
          articleId: item.id,
          relevanceScore: relevance,
          impactScore: impact,
          depthScore: depth,
          viralScore: viral,
          // Relevance-weighted: personalization is the dominant ranking factor so
          // the brief favors the reader's interests (ERR-020).
          compositeScore: Number(
            (relevance * 0.45 + impact * 0.3 + depth * 0.15 + viral * 0.1).toFixed(2)
          ),
          category: (item.category || "uncategorized").toString(),
          tone: item.tone || "neutral",
          reason: item.reason || "",
        });
      }
    } catch (error) {
      console.error(`Scoring batch failed: ${(error as Error).message}`);
      // Default scores for failed batch (degraded — the route's fail-loud
      // watchdog flags a run that made 0 AI calls).
      for (const article of batch) {
        allScores.push({
          articleId: article.id,
          relevanceScore: 5,
          impactScore: 5,
          depthScore: 5,
          viralScore: 5,
          compositeScore: 5,
          category: "uncategorized",
          tone: "neutral",
          reason: "Scoring failed — default scores applied",
        });
      }
    }
  }

  return { scores: allScores, aiResponse: lastAiResponse, aiCallsMade, aiTokensUsed, aiCostUsd };
}
