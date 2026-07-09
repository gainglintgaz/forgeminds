import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scoreArticles } from "@/lib/pipeline/scorer";
import { loadCategoryResolver } from "@/lib/pipeline/category-resolver";
import { getResolver } from "@/lib/entities/resolver";
import { PROMPT_VERSION } from "@/lib/ai/router";
import { resolveUserId, loadPrefs, SYSTEM_USER_ID } from "@/lib/pipeline/user-prefs";
import { checkDailyAiBudget, recordAiSpend } from "@/lib/pipeline/ai-budget";

export const maxDuration = 120;

// Map the scorer's internal 1-10 dimensions onto the schema's 0-1 dimensions.
// scorer.ts produces (impact, depth, viral); schema has (relevance, impact,
// novelty, credibility). Pragmatic mapping for Phase 0:
//   relevance_score   ← impact (the prompt currently optimises for this)
//   impact_score      ← impact
//   credibility_score ← depth (depth ≈ source/content trustworthiness)
//   novelty_score     ← viral (viral ≈ "this is new and people are talking")
// Phase 1 will rewrite the scoring prompt to produce the canonical 4 dims natively.
const toFraction = (n: number) => Math.max(0, Math.min(1, n / 10));

// Map scorer's free-text tone to the sentiment enum.
function toneToSentiment(tone: string): "bullish" | "bearish" | "neutral" | "mixed" {
  const t = (tone || "").toLowerCase();
  if (t.includes("bull") || t.includes("optimist")) return "bullish";
  if (t.includes("bear") || t.includes("cautious") || t.includes("dramatic")) return "bearish";
  if (t.includes("mixed")) return "mixed";
  return "neutral";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = await createServiceClient();

  const userId = resolveUserId(request);
  const prefs = await loadPrefs(supabase, userId);

  // SYSTEM_USER_ID → null in audit row (FK to auth.users). See ingest/route.ts.
  const auditUserId = userId === SYSTEM_USER_ID ? null : userId;

  // Audit row is mandatory (dormant-pipeline contract; VIBE Rule 52).
  const { data: run, error: runErr } = await supabase
    .from("pipeline_runs")
    .insert({ step_name: "score", status: "running", user_id: auditUserId })
    .select("id")
    .single();

  if (runErr || !run?.id) {
    console.error(
      `[score] pipeline_runs insert failed for user=${userId.slice(0, 8)}: ${runErr?.message ?? "no row returned"}`
    );
    return NextResponse.json(
      { error: "audit_write_failed", step: "score", detail: runErr?.message ?? "no row returned" },
      { status: 400 }
    );
  }

  try {
    // ═══ DAILY AI BUDGET ENTRY GATE (H1 fix 4) ═══════════════════════════
    // MUST run BEFORE the article fetch below — a budget-capped run must
    // NEVER reach the code that populates aiAttempts, or it would trip the
    // AI_ZERO_CALL fail-loud gate further down and page as if the router
    // were down (Hostile Architect's most critical H1 finding). This is a
    // full early-return, not a flag threaded through the rest of the route.
    const budget = await checkDailyAiBudget(supabase, userId, prefs.daily_ai_budget_usd_cents);
    if (budget.exceeded) {
      const executionTime = Date.now() - startTime;
      if (run?.id) {
        await supabase
          .from("pipeline_runs")
          .update({
            status: "completed",
            items_processed: 0,
            items_created: 0,
            duration_ms: executionTime,
            completed_at: new Date().toISOString(),
            metadata: {
              note: "daily_ai_budget_exceeded",
              budget_cap_cents: budget.capCents,
              spent_today_cents: budget.spentCents,
            },
          })
          .eq("id", run.id);
      }
      return NextResponse.json({
        message: "daily AI budget used up — resuming tomorrow",
        scored: 0,
        budgetCapCents: budget.capCents,
        spentTodayCents: budget.spentCents,
      });
    }

    // Lookback window is per-user (score_lookback_minutes). Default 240min.
    const sinceIso = new Date(
      Date.now() - prefs.score_lookback_minutes * 60 * 1000
    ).toISOString();

    const { data: articles } = await supabase
      .from("raw_articles")
      .select("id, title, summary, source_name")
      .eq("pipeline_status", "fetched")
      .eq("user_id", userId)
      .gte("created_at", sinceIso)
      .order("published_at", { ascending: false })
      .limit(prefs.score_batch_size);

    if (!articles || articles.length === 0) {
      if (run?.id) {
        await supabase.from("pipeline_runs").update({
          status: "completed",
          items_processed: 0,
          items_created: 0,
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
        }).eq("id", run.id);
      }
      return NextResponse.json({ message: "No articles to score", scored: 0 });
    }

    // Score articles against THIS user's interest graph (S2 personalization,
    // ERR-020). Empty arrays → relevance falls back to general importance.
    const {
      scores,
      aiResponse,
      aiCallsMade,
      aiTokensUsed,
      aiCostUsd,
      mangledIdsDropped,
      batchesFailed,
    } = await scoreArticles(
      articles.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.summary || "",
        sourceName: a.source_name,
      })),
      {
        topics: prefs.topics,
        trackedTickers: prefs.tracked_tickers,
        excludedTopics: prefs.excluded_topics,
      }
    );

    // Post-hoc tally (H1 fix 4): record the REAL router cost of this run's
    // batches, atomically, AFTER the calls happened — never estimated in
    // advance. scoreArticles() may make several batch calls internally;
    // aiCostUsd is their sum, so one increment here is equivalent to N
    // per-batch increments summed (the router has no per-batch callback
    // into this route, and adding one would be a bigger structural change
    // than this slice's scope — see the H1 implementation report).
    await recordAiSpend(supabase, userId, aiCostUsd);

    // ═══ FAIL-LOUD GATE (ERR-029 / lessons #104 #111) ══════════════════════
    // Real work + ZERO successful AI calls = every batch degraded (dead API
    // key, router down, provider outage). FAIL the run — do not persist
    // anything, do not advance pipeline_status (articles stay 'fetched' and
    // retry next tick, bounded by score_lookback_minutes). The old behavior
    // wrote fabricated default scores and reported 'completed' — a dead key
    // rotted silently for 16 days (2026-06-15 → 07-01) because of it.
    if (articles.length > 0 && aiCallsMade === 0) {
      throw new Error(
        `AI_ZERO_CALL: ${articles.length} article(s) to score, ${batchesFailed} batch(es) attempted, 0 AI calls succeeded — dead API key or router down? Nothing persisted; articles left in 'fetched' for retry.`
      );
    }
    // Partial degradation (some batches failed but the AI is alive) is honest
    // partial success: persist what scored, leave the rest 'fetched', surface
    // the counts in metadata.
    if (batchesFailed > 0) {
      console.error(
        `[score] ⚠ PARTIAL: ${batchesFailed} batch(es) failed — their articles stay 'fetched' for retry. user=${userId.slice(0, 8)}`
      );
    }

    // Strict category resolution (ERR-021): the model's category may only map to
    // an existing canonical UUID; a miss → 'uncategorized' (flagged for review).
    const categoryResolver = await loadCategoryResolver(supabase);

    // Strict ticker/entity resolution (S3): extracted symbols resolve to (or
    // create) canonical entity UUIDs; malformed strings are skipped, never invented.
    const entityResolver = getResolver();
    await entityResolver.load(supabase);

    // Store scores. Schema columns: article_id (FK), relevance_score, impact_score,
    // novelty_score, credibility_score, composite_score (all 0-1), sentiment,
    // diversity_category, curation_reason, scoring_model (NOT NULL),
    // prompt_version (NOT NULL).
    // Batch ticker resolution (VIBE Rule 53): resolve/create ALL symbols in one
    // pass (in-memory for known, ONE insert for new) instead of a per-ticker
    // DB round-trip. This is the N+1 that made score slow enough to be killed
    // mid-run on a constrained host (the dangling 'running' rows).
    const tickerToEntity = await entityResolver.resolveOrCreateTickersBatch(
      supabase,
      scores.flatMap((s) => s.tickers)
    );

    let flaggedCount = 0;
    // Only persist scores whose article_id is a REAL input id. The AI
    // occasionally echoes a mangled/hallucinated id; in a batch upsert one bad
    // uuid rejects the whole set (the per-row version silently skipped them).
    const validArticleIds = new Set(articles.map((a) => a.id));
    const rows = scores
      .filter((score) => validArticleIds.has(score.articleId))
      .map((score) => {
      const cat = categoryResolver.resolve(score.category);
      if (cat.resolution === "flagged_for_review") flaggedCount++;
      const entityIds = Array.from(
        new Set(
          score.tickers
            .map((t) => tickerToEntity.get(t.trim().toUpperCase().replace(/^\$/, "")))
            .filter((id): id is string => !!id)
        )
      );
      return {
        article_id: score.articleId,
        user_id: userId,
        tickers: score.tickers,
        entity_ids: entityIds,
        // relevance_score is the REAL per-user relevance (S2), not a copy of impact.
        relevance_score: toFraction(score.relevanceScore),
        impact_score: toFraction(score.impactScore),
        novelty_score: toFraction(score.viralScore),
        credibility_score: toFraction(score.depthScore),
        composite_score: toFraction(score.compositeScore),
        sentiment: toneToSentiment(score.tone),
        // Strict resolution (ERR-021): resolved canonical slug + UUID, never "core".
        diversity_category: cat.slug,
        category_id: cat.categoryId,
        category_resolution: cat.resolution,
        curation_reason: score.reason,
        scoring_model: aiResponse?.model || "unknown",
        prompt_version: PROMPT_VERSION,
      };
    });

    // ONE batch upsert (was N per-row upserts). On failure, throw → the catch
    // writes status='failed' (the run never dangles in 'running').
    if (rows.length > 0) {
      const { error: upsertErr } = await supabase
        .from("scored_articles")
        .upsert(rows, { onConflict: "article_id,user_id" });
      if (upsertErr) throw new Error(`scored_articles batch upsert failed: ${upsertErr.message}`);
    }
    const insertedCount = rows.length;

    // Advance pipeline_status ONLY for articles that actually got a persisted
    // score (ERR-029). Articles from failed batches / mangled-id drops stay
    // 'fetched' and retry next tick — the old blanket update marked EVERYTHING
    // 'scored', silently burying articles whose batch had failed. Retry is
    // bounded by the score_lookback_minutes window (no infinite loop).
    const scoredIds = rows.map((r) => r.article_id);
    if (scoredIds.length > 0) {
      await supabase
        .from("raw_articles")
        .update({ pipeline_status: "scored" })
        .in("id", scoredIds);
    }

    const executionTime = Date.now() - startTime;
    // (The old console-only AI-ZERO-CALL warning lived here. It is superseded
    // by the hard AI_ZERO_CALL throw above — a run with real work and 0 AI
    // calls now FAILS instead of logging a warning nobody reads. ERR-029.)

    if (run?.id) {
      await supabase.from("pipeline_runs").update({
        status: "completed",
        items_processed: articles.length,
        items_created: insertedCount,
        ai_calls_made: aiCallsMade,
        ai_tokens_used: aiTokensUsed,
        duration_ms: executionTime,
        completed_at: new Date().toISOString(),
        metadata: {
          model: aiResponse?.model,
          prompt_version: PROMPT_VERSION,
          cost_estimate_usd: aiCostUsd,
          ai_calls_made: aiCallsMade,
          ai_tokens_used: aiTokensUsed,
          category_flagged_for_review: flaggedCount,
          // ERR-028/ERR-029 observability: how often the AI corrupts ids, how
          // many batches failed, how many articles were left for retry.
          mangled_ids_dropped: mangledIdsDropped,
          batches_failed: batchesFailed,
          articles_unscored: articles.length - insertedCount,
        },
      }).eq("id", run.id);
    }

    return NextResponse.json({
      articlesIn: articles.length,
      scored: insertedCount,
      model: aiResponse?.model,
      costUsd: aiResponse?.costEstimateUsd,
      executionTimeMs: executionTime,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (run?.id) {
      await supabase.from("pipeline_runs").update({
        status: "failed",
        error_message: err.message,
        duration_ms: Date.now() - startTime,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);
    }
    console.error(`[Score] Pipeline failed: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
