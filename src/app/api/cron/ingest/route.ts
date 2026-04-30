import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllRSSFeeds } from "@/lib/pipeline/ingest/rss";
import { fetchFinnhubNews } from "@/lib/pipeline/ingest/finnhub";
import { fetchBenzingaNews } from "@/lib/pipeline/ingest/benzinga";
import { fetchAlpacaNews } from "@/lib/pipeline/ingest/alpaca";
import { fetchAlphaVantageNews } from "@/lib/pipeline/ingest/alpha-vantage";
import { deduplicateArticles, generateContentHash } from "@/lib/ai/heuristics/dedup";
import { filterRecent } from "@/lib/ai/heuristics/recency";
import type { RawArticle } from "@/lib/types/articles";

export const maxDuration = 120;

// System UUID used for shared (non-user-specific) pipeline writes during Phase 0.
// Per-user ingest is wired in Phase 1 once user_preferences drives source selection.
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = await createServiceClient();

  // Log pipeline run start. step_name is a pipeline_step enum; status defaults
  // to 'running' (run_status enum). Custom fields go in metadata jsonb.
  const { data: run } = await supabase
    .from("pipeline_runs")
    .insert({ step_name: "ingest", status: "running" })
    .select("id")
    .single();

  try {
    // Get all active RSS sources (sources.is_active is the canonical flag).
    const { data: rssSources } = await supabase
      .from("sources")
      .select("url")
      .eq("type", "rss")
      .eq("is_active", true);

    const rssUrls = (rssSources || [])
      .map((s) => s.url)
      .filter((u): u is string => !!u);

    // Fetch all sources in parallel
    const [rssResult, finnhubResult, benzingaResult, alpacaResult, alphaVantageResult] =
      await Promise.all([
        rssUrls.length > 0
          ? fetchAllRSSFeeds(rssUrls)
          : { articles: [] as RawArticle[], successCount: 0, errorCount: 0, errors: [] as string[] },
        fetchFinnhubNews(),
        fetchBenzingaNews(),
        fetchAlpacaNews(),
        fetchAlphaVantageNews(),
      ]);

    // Combine all articles
    const allArticles = [
      ...rssResult.articles,
      ...finnhubResult.items,
      ...benzingaResult.items,
      ...alpacaResult.items,
      ...alphaVantageResult.items,
    ];

    console.log(`Fetched ${allArticles.length} total articles`);

    // Deduplicate
    const { unique } = deduplicateArticles(allArticles);
    console.log(`After dedup: ${unique.length}`);

    // Filter recent (2 hour window)
    const { recent } = filterRecent(unique, 120);
    console.log(`After recency: ${recent.length}`);

    // Insert articles into raw_articles. Schema columns: title, url, summary,
    // source_name, source_type, raw_metadata, content_hash, user_id (NOT NULL),
    // pipeline_status (defaults to 'fetched'). Entity resolution happens in the
    // score step where entity_ids live on scored_articles per the schema design.
    let insertedCount = 0;
    for (const article of recent) {
      const contentHash = generateContentHash(article);

      const { error } = await supabase.from("raw_articles").insert({
        user_id: SYSTEM_USER_ID,
        source_type: article.sourceType,
        source_name: article.sourceName,
        title: article.title,
        url: article.url,
        summary: article.description, // wire-shape "description" → schema "summary"
        content_hash: contentHash,
        published_at: article.publishedAt || new Date().toISOString(),
        raw_metadata: article.metadata || {},
      });

      // 23505 = unique violation (already exists) — skip silently per VIBE Rule 37
      if (error && error.code !== "23505") {
        console.error(`Insert error for "${article.title}": ${error.message}`);
      } else if (!error) {
        insertedCount++;
      }
    }

    const executionTime = Date.now() - startTime;

    // Update pipeline run. Canonical names:
    //   step → step_name (already set above), items_in → items_processed,
    //   items_out → items_created, execution_time_ms → duration_ms.
    // Per-source counters live in metadata jsonb (no dedicated columns).
    if (run?.id) {
      await supabase.from("pipeline_runs").update({
        status: "completed",
        items_processed: allArticles.length,
        items_created: insertedCount,
        duration_ms: executionTime,
        completed_at: new Date().toISOString(),
        metadata: {
          rss_ok: rssResult.successCount,
          rss_err: rssResult.errorCount,
          finnhub: finnhubResult.success,
          benzinga: benzingaResult.success,
          alpaca: alpacaResult.success,
          alpha_vantage: alphaVantageResult.success,
        },
      }).eq("id", run.id);
    }

    return NextResponse.json({
      fetched: allArticles.length,
      unique: unique.length,
      recent: recent.length,
      inserted: insertedCount,
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

    console.error(`[Ingest] Pipeline failed: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
