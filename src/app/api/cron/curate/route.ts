import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { curateStories } from "@/lib/pipeline/curator";

export const maxDuration = 60;

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const CURATOR_PROMPT_VERSION = "curator-v0.1";
const CURATOR_GENERATION_MODEL = "heuristic"; // no AI in curate yet; "generate" step (Phase 1) writes summaries

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = await createServiceClient();

  const { data: run } = await supabase
    .from("pipeline_runs")
    .insert({ step_name: "curate", status: "running" })
    .select("id")
    .single();

  try {
    // Get today's scored articles. Schema: scored_articles uses created_at,
    // article_id (not raw_article_id), and stores 0-1 fractional scores.
    // diversity_category replaces what auto-scaffold called "category"; sentiment
    // replaces "tone"; curation_reason replaces "reason".
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: scored } = await supabase
      .from("scored_articles")
      .select("article_id, impact_score, credibility_score, novelty_score, composite_score, diversity_category, sentiment, curation_reason")
      .gte("created_at", today.toISOString())
      .order("composite_score", { ascending: false });

    if (!scored || scored.length === 0) {
      if (run?.id) {
        await supabase.from("pipeline_runs").update({
          status: "completed",
          items_processed: 0,
          items_created: 0,
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
        }).eq("id", run.id);
      }
      return NextResponse.json({ message: "No scored articles to curate", curated: 0 });
    }

    // Re-hydrate the scorer's 1-10 internal shape for the curator (which expects
    // that range). The schema stores 0-1; multiply by 10 here.
    const curated = curateStories(
      scored.map((s) => ({
        articleId: s.article_id,
        impactScore: Number(s.impact_score) * 10,
        depthScore: Number(s.credibility_score) * 10,
        viralScore: Number(s.novelty_score) * 10,
        compositeScore: Number(s.composite_score) * 10,
        category: s.diversity_category || "core",
        tone: s.sentiment || "neutral",
        reason: s.curation_reason || "",
      }))
    );

    // Persist as today's daily brief. Schema columns: title (NOT NULL),
    // brief_type (default 'daily'), brief_date (NOT NULL), summary_html/text,
    // article_ids (uuid[]), ticker_symbols (text[]), article_count,
    // categories_covered, generation_model, prompt_version.
    const briefDate = today.toISOString().split("T")[0];
    const articleIds = curated.map((c) => c.articleId);
    const categoriesCovered = Array.from(new Set(curated.map((c) => c.category)));

    const { error } = await supabase.from("briefs").upsert(
      {
        user_id: SYSTEM_USER_ID,
        title: `Daily Brief — ${briefDate}`,
        brief_type: "daily",
        brief_date: briefDate,
        article_ids: articleIds,
        ticker_symbols: [],
        article_count: curated.length,
        categories_covered: categoriesCovered,
        generation_model: CURATOR_GENERATION_MODEL,
        prompt_version: CURATOR_PROMPT_VERSION,
      },
      { onConflict: "user_id,brief_type,brief_date" }
    );

    if (error) {
      console.error(`[Curate] Brief save failed: ${error.message}`);
    }

    // Mark curated articles as is_curated so the dashboard can prefer them.
    await supabase
      .from("scored_articles")
      .update({ is_curated: true })
      .in("article_id", articleIds)
      .eq("user_id", SYSTEM_USER_ID);

    // Advance pipeline_status of the underlying raw_articles.
    await supabase
      .from("raw_articles")
      .update({ pipeline_status: "curated" })
      .in("id", articleIds);

    const executionTime = Date.now() - startTime;

    if (run?.id) {
      await supabase.from("pipeline_runs").update({
        status: "completed",
        items_processed: scored.length,
        items_created: curated.length,
        duration_ms: executionTime,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);
    }

    return NextResponse.json({
      scoredIn: scored.length,
      curated: curated.length,
      categories: Object.fromEntries(
        curated.reduce((map, s) => {
          map.set(s.category, (map.get(s.category) || 0) + 1);
          return map;
        }, new Map<string, number>())
      ),
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
    console.error(`[Curate] Pipeline failed: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
