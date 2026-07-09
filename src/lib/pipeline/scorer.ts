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
  /** Ticker SYMBOLS the article is about (e.g. ['AAPL','BTC']); resolved to entity UUIDs downstream. */
  tickers: string[];
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
  /**
   * AI-returned items dropped at parse time because their id was not one of
   * the batch's input ids or wasn't UUID-shaped (Gemini occasionally echoes a
   * corrupted copy of a real article id — ERR-028). Recorded in
   * pipeline_runs.metadata so id-corruption frequency is observable.
   */
  mangledIdsDropped: number;
  /**
   * Batches whose AI call or JSON parse failed outright. Their articles get
   * NO scores (they stay 'fetched' and retry next tick) — never fabricated
   * defaults (ERR-027 golden rule; ERR-029 fail-loud).
   */
  batchesFailed: number;
}

/** Canonical UUID shape — guards the upsert against AI-mangled ids (ERR-028). */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The 13 canonical category slugs (single source of truth = source_catalog +
// the categories table). The model MUST choose exactly one of these. Layer-1
// universal taxonomy — NOT finance-specific (per ARCHITECTURE §1 layer boundary).
// Exported so curator.ts can resolve a user's excluded_topics against the same
// taxonomy (E1 fix 1) without duplicating the list.
export const CANONICAL_CATEGORIES = [
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
    return {
      scores: [],
      aiResponse: null,
      aiCallsMade: 0,
      aiTokensUsed: 0,
      aiCostUsd: 0,
      mangledIdsDropped: 0,
      batchesFailed: 0,
    };

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
  let mangledIdsDropped = 0;
  let batchesFailed = 0;

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

TICKERS: list the stock/crypto ticker SYMBOLS the article is directly about (uppercase, e.g. ["AAPL","NVDA","BTC"]); [] if none. Only real, well-formed symbols — never invent one.

Tones: neutral, bullish, bearish, mixed.

Return JSON: {"items":[{"id":"...","category":"<slug>","tickers":["..."],"relevance_score":N,"impact_score":N,"depth_score":N,"viral_score":N,"tone":"...","reason":"1 sentence"}]}

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

      // Anthropic has no strict JSON-mode toggle (see claude.ts) — the model
      // is instructed to skip code fences but doesn't always comply. Strip a
      // ```json ... ``` wrapper before parsing rather than failing the whole
      // batch on a formatting quirk (discovered live during E1 local
      // verification: every batch was silently failing this way, so no
      // article had ever gotten a real per-user relevance score locally).
      const jsonText = response.content
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(jsonText);
      const items = Array.isArray(parsed?.items) ? parsed.items : [];

      // Parse-time id validation (ERR-028 layer 1): the model may only echo an
      // id that was IN this batch's input. Anything else — a corrupted copy of
      // a real id (one hex char dropped), a hallucinated id, a non-UUID — is
      // dropped HERE, before it can become a ScoreResult. Never trust an
      // AI-returned identifier verbatim (lesson #105).
      const batchIds = new Set(batch.map((a) => a.id));

      for (const item of items) {
        if (
          typeof item?.id !== "string" ||
          !UUID_SHAPE.test(item.id) ||
          !batchIds.has(item.id)
        ) {
          mangledIdsDropped++;
          console.error(
            `[Scorer] Dropped AI item with mangled/unknown id: "${String(item?.id).slice(0, 45)}" (not in input batch)`
          );
          continue;
        }
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
          tickers: Array.isArray(item.tickers)
            ? Array.from(
                new Set(
                  item.tickers
                    .map((t: unknown) => String(t).trim().toUpperCase().replace(/^\$/, ""))
                    .filter((t: string) => /^\^?[A-Z]{1,6}$/.test(t))
                )
              ).slice(0, 5) as string[]
            : [],
          tone: item.tone || "neutral",
          reason: item.reason || "",
        });
      }
    } catch (error) {
      // FAIL-LOUD (ERR-029; ERR-027 golden rule: never swallow an AI/parse
      // failure into fabricated defaults). A failed batch contributes NO
      // scores — its articles stay 'fetched' and retry next tick. The old
      // behavior pushed default 5/5/5 scores here, which let a DEAD API KEY
      // masquerade as 16 days of "completed" runs (0 real AI calls).
      batchesFailed++;
      console.error(
        `[Scorer] Batch of ${batch.length} failed (no scores emitted — will retry): ${(error as Error).message}`
      );
    }
  }

  return {
    scores: allScores,
    aiResponse: lastAiResponse,
    aiCallsMade,
    aiTokensUsed,
    aiCostUsd,
    mangledIdsDropped,
    batchesFailed,
  };
}
