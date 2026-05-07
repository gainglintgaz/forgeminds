import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { curateStories } from "@/lib/pipeline/curator";
import { resolveUserId, loadPrefs, SYSTEM_USER_ID } from "@/lib/pipeline/user-prefs";

export const maxDuration = 60;

const CURATOR_PROMPT_VERSION = "curator-v0.1";
const CURATOR_GENERATION_MODEL = "heuristic"; // no AI in curate yet; "generate" step (Phase 1) writes summaries

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
    .insert({ step_name: "curate", status: "running", user_id: auditUserId })
    .select("id")
    .single();

  if (runErr || !run?.id) {
    console.error(
      `[curate] pipeline_runs insert failed for user=${userId.slice(0, 8)}: ${runErr?.message ?? "no row returned"}`
    );
    return NextResponse.json(
      { error: "audit_write_failed", step: "curate", detail: runErr?.message ?? "no row returned" },
      { status: 400 }
    );
  }

  try {
    // "Today" in the user's timezone (not UTC). Daily cadence respects user
    // locale — a Pacific-coast user shouldn't see midnight rollover at 5pm.
    // Phase 1 keeps daily granularity; future weekly/monthly briefs come
    // through brief_type variants.
    const tz = prefs.timezone;
    const localToday = new Date(
      new Date().toLocaleString("en-US", { timeZone: tz })
    );
    localToday.setHours(0, 0, 0, 0);

    const { data: scored } = await supabase
      .from("scored_articles")
      .select("article_id, impact_score, credibility_score, novelty_score, composite_score, diversity_category, sentiment, curation_reason")
      .eq("user_id", userId)
      .gte("created_at", localToday.toISOString())
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
    // Curator config (target count, max-per-category, min score) comes from
    // user prefs — no hardcoded literals (factory rule §17 / VIBE Rule 55).
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
      })),
      {
        targetCount: prefs.max_articles_per_brief,
        maxPerCategory: prefs.max_per_category,
        maxPerEntity: prefs.max_per_entity,
        // min_composite_score is 0-1 in schema/prefs; curator expects 1-10 scale
        minCompositeScore: prefs.min_composite_score * 10,
      }
    );

    // Persist as today's daily brief. Schema columns: title (NOT NULL),
    // brief_type (default 'daily'), brief_date (NOT NULL), summary_html/text,
    // article_ids (uuid[]), ticker_symbols (text[]), article_count,
    // categories_covered, generation_model, prompt_version.
    const briefDate = localToday.toISOString().split("T")[0];
    const articleIds = curated.map((c) => c.articleId);
    const categoriesCovered = Array.from(new Set(curated.map((c) => c.category)));

    const { error } = await supabase.from("briefs").upsert(
      {
        user_id: userId,
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

    // Mark this user's scored_articles as is_curated so the dashboard prefers them.
    await supabase
      .from("scored_articles")
      .update({ is_curated: true })
      .in("article_id", articleIds)
      .eq("user_id", userId);

    // Advance pipeline_status of this user's raw_articles.
    await supabase
      .from("raw_articles")
      .update({ pipeline_status: "curated" })
      .in("id", articleIds)
      .eq("user_id", userId);

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
