import { routeAIRequest } from "@/lib/ai/router";
import type { AIResponse } from "@/lib/types/ai";

interface ArticleToScore {
  id: string;
  title: string;
  description: string;
  sourceName: string;
}

export interface ScoreResult {
  articleId: string;
  impactScore: number;
  depthScore: number;
  viralScore: number;
  compositeScore: number;
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

export async function scoreArticles(
  articles: ArticleToScore[],
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

  for (const batch of batches) {
    const prompt = `Score these news items for a financial audience. Filter out market noise.

SCORING RULES:
- Routine price updates, market summaries, analyst ratings: Impact < 5, Depth < 5
- Routine earnings reports (just numbers): Depth < 5
- Deep analysis, novel insights, major events: Score >= 5
- Scandals, policy shifts, transformative M&A: Score 7+

For each item return: category, impact_score (1-10), depth_score (1-10), viral_score (1-10), tone, reason (1 sentence).

Categories: stock market, crypto, treasuries/bonds, commodities/forex, economic data/macro, earnings report, earnings analysis, corporate news, ETF/fund news, regulatory/policy, sector analysis, general finance, technology, AI/ML

Tones: neutral analysis, cautious/bearish, optimistic/bullish, dramatic/sensational, policy/technical

Return JSON: {"items":[{"id":"...","category":"...","impact_score":N,"depth_score":N,"viral_score":N,"tone":"...","reason":"..."}]}

Articles:
${JSON.stringify(batch.map((a) => ({ id: a.id, title: a.title, summary: a.description?.slice(0, 400) })))}`;

    try {
      const response = await routeAIRequest({
        task: "score",
        prompt,
        jsonMode: true,
      });

      lastAiResponse = response;
      aiCallsMade += 1;
      aiTokensUsed += (response.inputTokens || 0) + (response.outputTokens || 0);
      aiCostUsd += response.costEstimateUsd || 0;

      const parsed = JSON.parse(response.content);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      for (const item of items) {
        const impact = Math.min(10, Math.max(1, Number(item.impact_score) || 5));
        const depth = Math.min(10, Math.max(1, Number(item.depth_score) || 5));
        const viral = Math.min(10, Math.max(1, Number(item.viral_score) || 5));

        allScores.push({
          articleId: item.id,
          impactScore: impact,
          depthScore: depth,
          viralScore: viral,
          compositeScore: Number((impact * 0.35 + depth * 0.3 + viral * 0.35).toFixed(2)),
          category: item.category || "general finance",
          tone: item.tone || "neutral analysis",
          reason: item.reason || "",
        });
      }
    } catch (error) {
      console.error(`Scoring batch failed: ${(error as Error).message}`);
      // Default scores for failed batch
      for (const article of batch) {
        allScores.push({
          articleId: article.id,
          impactScore: 5,
          depthScore: 5,
          viralScore: 5,
          compositeScore: 5,
          category: "general finance",
          tone: "neutral analysis",
          reason: "Scoring failed — default scores applied",
        });
      }
    }
  }

  return { scores: allScores, aiResponse: lastAiResponse, aiCallsMade, aiTokensUsed, aiCostUsd };
}
