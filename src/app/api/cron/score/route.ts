import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scoreArticles } from "@/lib/pipeline/scorer";
import { loadCategoryResolver } from "@/lib/pipeline/category-resolver";
import { PROMPT_VERSION } from "@/lib/ai/router";
import { resolveUserId, loadPrefs, SYSTEM_USER_ID } from "@/lib/pipeline/user-prefs";

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
    const { scores, aiResponse, aiCallsMade, aiTokensUsed, aiCostUsd } = await scoreArticles(
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

    // Strict category resolution (ERR-021): the model's category may only map to
    // an existing canonical UUID; a miss → 'uncategorized' (flagged for review).
    const categoryResolver = await loadCategoryResolver(supabase);

    // Store scores. Schema columns: article_id (FK), relevance_score, impact_score,
    // novelty_score, credibility_score, composite_score (all 0-1), sentiment,
    // diversity_category, curation_reason, scoring_model (NOT NULL),
    // prompt_version (NOT NULL).
    let insertedCount = 0;
    let flaggedCount = 0;
    for (const score of scores) {
      const cat = categoryResolver.resolve(score.category);
      if (cat.resolution === "flagged_for_review") flaggedCount++;
      const { error } = await supabase.from("scored_articles").upsert(
        {
          article_id: score.articleId,
          user_id: userId,
          // relevance_score is now the REAL per-user relevance (was a copy of
          // impact). This is what makes the brief favor the reader's interests.
          relevance_score: toFraction(score.relevanceScore),
          impact_score: toFraction(score.impactScore),
          novelty_score: toFraction(score.viralScore),
          credibility_score: toFraction(score.depthScore),
          composite_score: toFraction(score.compositeScore),
          sentiment: toneToSentiment(score.tone),
          // Strict resolution (ERR-021): the resolved canonical slug + UUID,
          // never the old hardcoded "core". Miss → 'uncategorized' for review.
          diversity_category: cat.slug,
          category_id: cat.categoryId,
          category_resolution: cat.resolution,
          curation_reason: score.reason,
          scoring_model: aiResponse?.model || "unknown",
          prompt_version: PROMPT_VERSION,
        },
        { onConflict: "article_id,user_id" }
      );

      if (!error) insertedCount++;
    }

    // Advance pipeline_status of scored articles so we don't re-pick them.
    await supabase
      .from("raw_articles")
      .update({ pipeline_status: "scored" })
      .in("id", articles.map((a) => a.id));

    const executionTime = Date.now() - startTime;

    // Fail-loud telemetry watchdog (ERR-019 / ERR-025): if we had real work but
    // the AI never fired, the run is silently degraded (default scores applied).
    // Surface it instead of reporting a clean "completed".
    const aiZeroCallWarning = articles.length > 0 && aiCallsMade === 0;
    if (aiZeroCallWarning) {
      console.error(
        `[score] ⚠ AI-ZERO-CALL: processed ${articles.length} articles but made 0 AI calls — scoring degraded to defaults (router down?). user=${userId.slice(0, 8)}`
      );
    }

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
          ...(aiZeroCallWarning ? { ai_zero_call_warning: true } : {}),
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
