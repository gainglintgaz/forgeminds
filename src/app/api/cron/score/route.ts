import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { scoreArticles } from "@/lib/pipeline/scorer";
import { PROMPT_VERSION } from "@/lib/ai/router";
import { resolveUserId, loadPrefs } from "@/lib/pipeline/user-prefs";

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

  const { data: run } = await supabase
    .from("pipeline_runs")
    .insert({ step_name: "score", status: "running", user_id: userId })
    .select("id")
    .single();

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

    // Score articles
    const { scores, aiResponse } = await scoreArticles(
      articles.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.summary || "",
        sourceName: a.source_name,
      }))
    );

    // Store scores. Schema columns: article_id (FK), relevance_score, impact_score,
    // novelty_score, credibility_score, composite_score (all 0-1), sentiment,
    // diversity_category, curation_reason, scoring_model (NOT NULL),
    // prompt_version (NOT NULL).
    let insertedCount = 0;
    for (const score of scores) {
      const { error } = await supabase.from("scored_articles").upsert(
        {
          article_id: score.articleId,
          user_id: userId,
          relevance_score: toFraction(score.impactScore),
          impact_score: toFraction(score.impactScore),
          novelty_score: toFraction(score.viralScore),
          credibility_score: toFraction(score.depthScore),
          composite_score: toFraction(score.compositeScore),
          sentiment: toneToSentiment(score.tone),
          diversity_category: "core",
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

    if (run?.id) {
      await supabase.from("pipeline_runs").update({
        status: "completed",
        items_processed: articles.length,
        items_created: insertedCount,
        duration_ms: executionTime,
        completed_at: new Date().toISOString(),
        metadata: {
          model: aiResponse?.model,
          prompt_version: PROMPT_VERSION,
          cost_estimate_usd: aiResponse?.costEstimateUsd,
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
