import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllRSSFeeds } from "@/lib/pipeline/ingest/rss";
import { fetchFinnhubNews } from "@/lib/pipeline/ingest/finnhub";
import { fetchBenzingaNews } from "@/lib/pipeline/ingest/benzinga";
import { fetchAlpacaNews } from "@/lib/pipeline/ingest/alpaca";
import { fetchAlphaVantageNews } from "@/lib/pipeline/ingest/alpha-vantage";
import { deduplicateArticles, generateContentHash } from "@/lib/ai/heuristics/dedup";
import { filterRecent } from "@/lib/ai/heuristics/recency";
import { resolveUserId, loadPrefs, SYSTEM_USER_ID } from "@/lib/pipeline/user-prefs";
import type { RawArticle, FetchResult } from "@/lib/types/articles";

export const maxDuration = 120;

// (Empty-result helpers removed in 12b566f refactor — no longer needed because
// fetchers are only invoked when sources of that type exist for the user.)

export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = await createServiceClient();

  // Resolve which user this run is for (?user_id= from dispatcher, or system
  // UUID for manual curl) and load their preferences.
  const userId = resolveUserId(request);
  const prefs = await loadPrefs(supabase, userId);

  // pipeline_runs.user_id is FK to auth.users. SYSTEM_USER_ID is a
  // sentinel ("no real user — manual curl / verify probe / system run"),
  // not an actual auth.users row, so writing it to the FK column would
  // violate the constraint. The column is nullable specifically for this
  // case — system runs write NULL user_id. Real cron dispatcher invocations
  // pass ?user_id=<real-uuid> and write that as-is.
  const auditUserId = userId === SYSTEM_USER_ID ? null : userId;

  // Log pipeline run start. Every cron tick MUST write its audit row
  // (DECISIONS.md 2026-05-04 dormant-pipeline contract). If the INSERT
  // fails — FK violation against auth.users, RLS denial, schema drift —
  // surface immediately rather than silently proceeding without
  // observability. VIBE Rule 52 (no silent failures).
  const { data: run, error: runErr } = await supabase
    .from("pipeline_runs")
    .insert({ step_name: "ingest", status: "running", user_id: auditUserId })
    .select("id")
    .single();

  if (runErr || !run?.id) {
    console.error(
      `[ingest] pipeline_runs insert failed for user=${userId.slice(0, 8)}: ${runErr?.message ?? "no row returned"}`
    );
    // 400 not 500 — FK / config errors aren't retryable; cron retrying
    // would just burn quota on the same failure.
    return NextResponse.json(
      { error: "audit_write_failed", step: "ingest", detail: runErr?.message ?? "no row returned" },
      { status: 400 }
    );
  }

  try {
    // Read this user's active sources, grouped by type. Per-user-from-day-1
    // (factory CLAUDE.md §17, VIBE Rule 55) and constant-API-call check
    // (lessons.md #98): we only call a fetcher when the user has at least
    // one active source row of that type. Pre-2026-05-04 the route called
    // Finnhub/Benzinga/Alpaca/AlphaVantage unconditionally for every user,
    // every tick — burning shared API quota for users who never asked.
    const { data: sources } = await supabase
      .from("sources")
      .select("type, url, config")
      .eq("user_id", userId)
      .eq("is_active", true);

    const byType = new Map<string, Array<{ url: string | null; config: unknown }>>();
    for (const s of sources ?? []) {
      const arr = byType.get(s.type) ?? [];
      arr.push({ url: s.url, config: s.config });
      byType.set(s.type, arr);
    }

    // RSS fetcher takes a URL list. Other fetchers currently take no args
    // and use shared env-var API keys + hardcoded "general" category. The
    // per-source-config refactor (each user picks category / tickers / their
    // own API key) is Phase 1.5 work — see DECISIONS.md 2026-05-04 (Blocker 5
    // deferred). Phase 1 only needs source-presence gating to honor the
    // multi-tenant principle, not full config customization.
    const rssUrls = (byType.get("rss") ?? [])
      .map((s) => s.url)
      .filter((u): u is string => !!u);

    type RssResultShape = { articles: RawArticle[]; successCount: number; errorCount: number; errors: string[] };
    const fetcherTasks: Array<Promise<{ source: string; result: FetchResult | RssResultShape }>> = [];

    if (rssUrls.length > 0) {
      fetcherTasks.push(fetchAllRSSFeeds(rssUrls).then((r) => ({ source: "rss", result: r })));
    }
    if (byType.has("finnhub")) {
      fetcherTasks.push(fetchFinnhubNews().then((r) => ({ source: "finnhub", result: r })));
    }
    if (byType.has("benzinga")) {
      fetcherTasks.push(fetchBenzingaNews().then((r) => ({ source: "benzinga", result: r })));
    }
    if (byType.has("alpaca")) {
      fetcherTasks.push(fetchAlpacaNews().then((r) => ({ source: "alpaca", result: r })));
    }
    if (byType.has("alpha_vantage")) {
      fetcherTasks.push(fetchAlphaVantageNews().then((r) => ({ source: "alpha_vantage", result: r })));
    }

    const results = await Promise.all(fetcherTasks);

    // Combine all articles. Each fetcher result has either `.articles` (RSS)
    // or `.items` (FetchResult). Normalize to a single list.
    const allArticles: RawArticle[] = [];
    const fetcherStats: Record<string, unknown> = {};
    for (const { source, result } of results) {
      if ("articles" in result) {
        // RSS shape
        allArticles.push(...result.articles);
        fetcherStats[`${source}_ok`] = result.successCount;
        fetcherStats[`${source}_err`] = result.errorCount;
      } else {
        // FetchResult shape
        allArticles.push(...result.items);
        fetcherStats[source] = result.success;
        if (result.error) fetcherStats[`${source}_error`] = result.error;
      }
    }

    console.log(`[Ingest] User ${userId.slice(0, 8)}… fetched ${allArticles.length} from ${results.length} source type(s)`);

    // Empty-handling: if user has no sources, log a clean run with note +
    // exit early. (verify:cron-empty-handling tests this contract.)
    if (results.length === 0) {
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
            metadata: { note: "no active sources for user" },
          })
          .eq("id", run.id);
      }
      return NextResponse.json({
        message: "no active sources for user — nothing to ingest",
        items_processed: 0,
        items_created: 0,
        executionTimeMs: executionTime,
      });
    }

    // Deduplicate
    const { unique } = deduplicateArticles(allArticles);

    // Filter recent — window is per-user (recency_window_minutes from prefs).
    const { recent } = filterRecent(unique, prefs.recency_window_minutes);

    // Insert articles into raw_articles. Schema columns: title, url, summary,
    // source_name, source_type, raw_metadata, content_hash, user_id (NOT NULL),
    // pipeline_status (defaults to 'fetched').
    let insertedCount = 0;
    for (const article of recent) {
      const contentHash = generateContentHash(article);

      const { error } = await supabase.from("raw_articles").insert({
        user_id: userId,
        source_type: article.sourceType,
        source_name: article.sourceName,
        title: article.title,
        url: article.url,
        summary: article.description,
        content_hash: contentHash,
        published_at: article.publishedAt || new Date().toISOString(),
        raw_metadata: article.metadata || {},
      });

      if (error && error.code !== "23505") {
        console.error(`Insert error for "${article.title}": ${error.message}`);
      } else if (!error) {
        insertedCount++;
      }
    }

    // Mark the fetched source types as fetched now (review C-4 / ERR-025). Without
    // this, sources.last_fetched_at stays NULL forever and any "source health"
    // display lies + staleness is undetectable. Single .in() update (no N+1, VIBE 53);
    // scoped by type because the fetchers run per-type, not per-source-row.
    const invokedTypes = results.map((r) => r.source);
    if (invokedTypes.length > 0) {
      const { error: srcErr } = await supabase
        .from("sources")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("is_active", true)
        .in("type", invokedTypes);
      if (srcErr) {
        // Non-fatal: the articles already landed; a stale health timestamp must
        // not fail the ingest run. Log with context (VIBE 52), don't swallow.
        console.error(`[Ingest] sources.last_fetched_at update failed: ${srcErr.message}`);
      }
    }

    const executionTime = Date.now() - startTime;

    if (run?.id) {
      await supabase.from("pipeline_runs").update({
        status: "completed",
        items_processed: allArticles.length,
        items_created: insertedCount,
        duration_ms: executionTime,
        completed_at: new Date().toISOString(),
        metadata: {
          source_types_invoked: results.map((r) => r.source),
          ...fetcherStats,
        },
      }).eq("id", run.id);
    }

    return NextResponse.json({
      fetched: allArticles.length,
      unique: unique.length,
      recent: recent.length,
      inserted: insertedCount,
      sourceTypesInvoked: results.map((r) => r.source),
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

