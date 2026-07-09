import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { curateStories, resolveExcludedCategories } from "@/lib/pipeline/curator";
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
    const briefDate = localToday.toISOString().split("T")[0];

    const { data: scored } = await supabase
      .from("scored_articles")
      .select("article_id, relevance_score, impact_score, credibility_score, novelty_score, composite_score, diversity_category, sentiment, curation_reason, tickers")
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

    // Cross-brief dedup (ERR-024): drop articles already served in this user's
    // PRIOR briefs (strictly earlier dates) so a story is never re-delivered.
    // Within-fetch dedup (content_hash) is not cross-time dedup.
    const { data: priorBriefs } = await supabase
      .from("briefs")
      .select("article_ids")
      .eq("user_id", userId)
      .lt("brief_date", briefDate);
    const alreadyDelivered = new Set<string>();
    for (const b of priorBriefs ?? []) {
      for (const id of ((b.article_ids ?? []) as string[])) alreadyDelivered.add(id);
    }
    const freshScored = scored.filter((s) => !alreadyDelivered.has(s.article_id));

    if (freshScored.length === 0) {
      if (run?.id) {
        await supabase.from("pipeline_runs").update({
          status: "completed",
          items_processed: scored.length,
          items_created: 0,
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
          metadata: { note: "all scored articles already delivered in prior briefs (cross-brief dedup)" },
        }).eq("id", run.id);
      }
      return NextResponse.json({
        scoredIn: scored.length,
        curated: 0,
        dedupedOut: scored.length,
        message: "All candidates already delivered in prior briefs",
      });
    }

    // Resolve the reader's excluded_topics ("sports scores", "lifestyle
    // fluff", ...) to canonical category slugs the curator can hard-exclude
    // (E1 fix 1). A miss just isn't excluded at the category level — the
    // minRelevanceScore floor below is the primary, always-on defense.
    const excludedCategories = resolveExcludedCategories(prefs.excluded_topics);

    // Re-hydrate the scorer's 1-10 internal shape for the curator (which expects
    // that range). The schema stores 0-1; multiply by 10 here.
    // Curator config (target count, max-per-category, min score) comes from
    // user prefs — no hardcoded literals (factory rule §17 / VIBE Rule 55).
    // category is now the resolved canonical slug (S2), so maxPerCategory
    // genuinely diversifies across finance/geopolitics/tech/... not one 'core'.
    const curated = curateStories(
      freshScored.map((s) => ({
        articleId: s.article_id,
        relevanceScore: Number(s.relevance_score) * 10,
        impactScore: Number(s.impact_score) * 10,
        depthScore: Number(s.credibility_score) * 10,
        viralScore: Number(s.novelty_score) * 10,
        compositeScore: Number(s.composite_score) * 10,
        category: s.diversity_category || "uncategorized",
        tickers: ((s.tickers ?? []) as string[]),
        tone: s.sentiment || "neutral",
        reason: s.curation_reason || "",
      })),
      {
        targetCount: prefs.max_articles_per_brief,
        maxPerCategory: prefs.max_per_category,
        maxPerEntity: prefs.max_per_entity,
        // min_composite_score / min_relevance_score are 0-1 in schema/prefs;
        // curator expects the scorer's native 1-10 scale.
        minCompositeScore: prefs.min_composite_score * 10,
        minRelevanceScore: prefs.min_relevance_score * 10,
        excludedCategories,
      }
    );

    // Persist as today's daily brief. Schema columns: title (NOT NULL),
    // brief_type (default 'daily'), brief_date (NOT NULL), summary_html/text,
    // article_ids (uuid[]), ticker_symbols (text[]), article_count,
    // categories_covered, generation_model, prompt_version.
    const articleIds = curated.map((c) => c.articleId);
    const categoriesCovered = Array.from(new Set(curated.map((c) => c.category)));

    // Aggregate the curated stories' resolved tickers ∪ the user's tracked_tickers
    // watchlist → brief ticker_symbols (E2 fix 2). Union with the watchlist so a
    // finance brief always carries the reader's positions even when a given
    // day's top-N curated stories don't happen to mention all of them by name —
    // this is what feeds the enrich step (market data) + generate (the market
    // read woven into story prose).
    const tickersByArticle = new Map(
      freshScored.map((s) => [s.article_id, ((s.tickers ?? []) as string[])])
    );
    const tickerSymbols = Array.from(
      new Set([
        ...articleIds.flatMap((id) => tickersByArticle.get(id) ?? []),
        ...(prefs.tracked_tickers ?? []),
      ])
    );

    // ── LOAD-BEARING SEAM (ERR-019 fix) ──────────────────────────────────
    // curate OWNS the article selection; generate OWNS the AI summary +
    // generation_model/prompt_version. The old blanket upsert re-stamped
    // generation_model='heuristic' + prompt_version='curator-v0.1' on EVERY
    // tick — clobbering generate's claude label (06-10/11/12 briefs were
    // AI-written, then mislabeled 'heuristic' by a later curate re-run, which
    // is what made it look like "the AI never ran").
    // Fix: a re-run updates ONLY curation fields and NEVER touches
    // generation_model / prompt_version / summary_html / summary_text. A NEW
    // brief inserts with the heuristic placeholder + summary_html=NULL so the
    // generate step (which selects `summary_html IS NULL`) picks it up.
    const curationFields = {
      article_ids: articleIds,
      ticker_symbols: tickerSymbols,
      article_count: curated.length,
      categories_covered: categoriesCovered,
    };

    const { data: existing, error: existErr } = await supabase
      .from("briefs")
      .select("id, article_ids")
      .eq("user_id", userId)
      .eq("brief_type", "daily")
      .eq("brief_date", briefDate)
      .maybeSingle();

    if (existErr) {
      console.error(`[Curate] Brief lookup failed: ${existErr.message}`);
    }

    if (existing?.id) {
      // Brief-consistency invariant (S3.1): a brief's label MUST match its
      // summary. If the curated article set CHANGED, the existing AI summary is
      // now stale → reset summary + label to the heuristic placeholder so
      // generate's `summary_html IS NULL` filter re-synthesizes it under the
      // correct label. If UNCHANGED, preserve generate's output (the S1
      // non-clobber — never reset a Claude summary that still matches its set).
      const prevIds = ((existing.article_ids ?? []) as string[]).slice().sort();
      const newIds = articleIds.slice().sort();
      const changed = prevIds.length !== newIds.length || prevIds.some((id, i) => id !== newIds[i]);

      const updateFields = changed
        ? {
            ...curationFields,
            summary_html: null,
            summary_text: null,
            generation_model: CURATOR_GENERATION_MODEL,
            prompt_version: CURATOR_PROMPT_VERSION,
          }
        : curationFields;

      const { error } = await supabase.from("briefs").update(updateFields).eq("id", existing.id);
      if (error) console.error(`[Curate] Brief update failed: ${error.message}`);
    } else {
      // New brief → insert with heuristic placeholder; summary_html stays NULL
      // (DB default) so generate will synthesize it.
      const { error } = await supabase.from("briefs").insert({
        user_id: userId,
        title: `Daily Brief — ${briefDate}`,
        brief_type: "daily",
        brief_date: briefDate,
        ...curationFields,
        generation_model: CURATOR_GENERATION_MODEL,
        prompt_version: CURATOR_PROMPT_VERSION,
      });
      if (error) {
        // Race: a concurrent curate tick created the row first (unique
        // user_id,brief_type,brief_date). 23505 = already saved (VIBE Rule 37)
        // → fall back to a curation-only update, still preserving AI fields.
        if (error.code === "23505") {
          const { error: updErr } = await supabase
            .from("briefs")
            .update(curationFields)
            .eq("user_id", userId)
            .eq("brief_type", "daily")
            .eq("brief_date", briefDate);
          if (updErr) console.error(`[Curate] Brief update-after-conflict failed: ${updErr.message}`);
        } else {
          console.error(`[Curate] Brief insert failed: ${error.message}`);
        }
      }
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
