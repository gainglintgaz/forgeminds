import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { routeAIRequest, PROMPT_VERSION } from "@/lib/ai/router";
import {
  resolveUserId,
  loadPrefs,
  SYSTEM_USER_ID,
  type StyleAnchor,
  type StyleTone,
  type StyleDensity,
} from "@/lib/pipeline/user-prefs";
import { validateBriefSynthesis } from "@/lib/pipeline/brief-validation";
import { sanitizeBriefHtml } from "@/lib/pipeline/html-sanitize";
import { checkDailyAiBudget, recordAiSpend } from "@/lib/pipeline/ai-budget";

export const maxDuration = 120;

// v0.2 — adds Voice DNA style adaptation layer (style_anchors + tone + density)
// per migration 20260518000000. Prior v0.1 was style-agnostic.
const GENERATE_PROMPT_VERSION = "generate-v0.2";

// H1 fix 2 (architecture §7 assumption 3): a source needs 3+ CONSECUTIVE
// failures before it's banner-worthy — 1-2 is treated as a transient blip,
// avoiding single-blip false positives. Resets to 0 on any success.
const DEGRADED_THRESHOLD = 3;

interface DegradedSourcesSnapshot {
  count_active: number;
  count_degraded: number;
  source_names_degraded: string[];
}

interface StylePrefs {
  anchors: StyleAnchor[];
  tone: StyleTone | null;
  density: StyleDensity | null;
}

const TONE_DESCRIPTIONS: Record<StyleTone, string> = {
  concise: "Tight sentences, low ceremony, no throat-clearing.",
  analytical: "Numbers + structured reasoning; lead with the data, then the implication.",
  conversational: "Like a smart friend explaining over coffee. Contractions OK, jargon translated.",
  academic: "Hedged, careful, citation-aware. Mark uncertainty explicitly.",
  investigative: "Adversarial, name names, follow money. Skeptical of official narratives.",
};

const DENSITY_DESCRIPTIONS: Record<StyleDensity, string> = {
  telegraphic: "Headlines + one-line summaries. Each item ≤ 20 words. The whole brief reads like a wire feed.",
  paragraph: "One paragraph per item (40-80 words). Standard reading rhythm.",
  longform: "Multi-paragraph essay treatment. Connect items into a narrative when they share a theme.",
};

/**
 * Render the Voice DNA prefix that prepends the system prompt. Empty
 * string when the user hasn't captured style anchors yet — keeps v0.1
 * behavior intact for un-captured users.
 *
 * NOTE: this session does NOT fetch sample text from anchor URLs.
 * Future enhancement (deferred): cache an excerpt per anchor via
 * Jina Reader so the model can match cadence/vocabulary, not just
 * name-check.
 */
function buildStylePrefix(style: StylePrefs): string {
  if (style.anchors.length === 0 && !style.tone && !style.density) return "";

  const lines: string[] = ["", "STYLE ADAPTATION (read carefully — this shapes EVERY sentence):"];

  if (style.anchors.length > 0) {
    lines.push(
      `- The reader's declared style anchors: ${style.anchors
        .map((a) => (a.why ? `${a.name} (${a.why})` : a.name))
        .join("; ")}`
    );
    lines.push(
      "  Match the rhythm, vocabulary, and stance of those writers as closely as possible without quoting them."
    );
  }
  if (style.tone) {
    lines.push(`- Tone: ${style.tone}. ${TONE_DESCRIPTIONS[style.tone]}`);
  }
  if (style.density) {
    lines.push(`- Density: ${style.density}. ${DENSITY_DESCRIPTIONS[style.density]}`);
  }
  lines.push(
    "- Style adaptation NEVER overrides the HARD RULES below (no invention, no fabricated numbers)."
  );
  return lines.join("\n");
}

interface ArticleForBrief {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  source_name: string | null;
  published_at: string | null;
}

interface MarketRow {
  symbol: string;
  price_cents: number | null;
  change_percent: number | null;
  high_52w_cents: number | null;
  low_52w_cents: number | null;
  pe_ratio: number | null;
  interpretation: string | null;
}

function renderMarketBlock(rows: MarketRow[]): string {
  if (rows.length === 0) return "";
  const usd = (c: number | null) => (c == null ? "n/a" : `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
  const lines = rows.map((r) => {
    const chg = r.change_percent == null ? "" : ` ${r.change_percent >= 0 ? "+" : ""}${r.change_percent.toFixed(2)}%`;
    const range = r.high_52w_cents != null && r.low_52w_cents != null ? ` (52wk ${usd(r.low_52w_cents)}–${usd(r.high_52w_cents)})` : "";
    const pe = r.pe_ratio != null ? ` P/E ${r.pe_ratio.toFixed(1)}` : "";
    const read = r.interpretation ? ` — ${r.interpretation}` : "";
    return `- ${r.symbol}: ${usd(r.price_cents)}${chg}${range}${pe}${read}`;
  });
  return `\n\nMARKET DATA (real, fetched live — weave the relevant figures + the read into the matching stories; use ONLY these numbers, never invent others):\n${lines.join("\n")}`;
}

/**
 * Build the prompt sent to the LLM. We deliberately constrain the model to
 * paraphrasing the article facts we provide (Layer 4 of the no-hallucination
 * architecture). The model never invents prices, names, or events — it
 * synthesizes the supplied list into a readable digest.
 */
function buildBriefPrompt(
  articles: ArticleForBrief[],
  style: StylePrefs,
  marketData: MarketRow[] = []
): {
  system: string;
  user: string;
} {
  const stylePrefix = buildStylePrefix(style);
  const system = `You are ForgeMinds, a personal intelligence brief generator.${stylePrefix}

HARD RULES:
- Never invent facts. Only paraphrase, summarize, or rephrase the article list provided.
- Never quote prices, percentages, dates, or names that aren't in the input.
- Output JSON exactly matching this schema:
  {
    "headline": "<one-sentence summary of the day, ≤120 chars>",
    "summary_text": "<plain text digest, 200-300 words, no markdown>",
    "summary_html": "<HTML digest, same content, with <h2>, <p>, <ul>/<li> tags. No <script>, no <style>, no inline styles.>"
  }

VOICE: Cynical software engineer. Short sentences. Specific. Numbers over adjectives. No hype phrases ("revolutionize", "delve", "harness").`;

  const articleList = articles
    .map(
      (a, i) =>
        `${i + 1}. [${a.source_name ?? "Unknown source"}] ${a.title}\n   ${a.summary ?? "(no summary)"}\n   ${a.url ?? ""}`
    )
    .join("\n\n");

  const user = `Generate today's intelligence brief from these ${articles.length} curated articles:

${articleList}${renderMarketBlock(marketData)}

Return JSON only — no markdown fences, no commentary.`;

  return { system, user };
}

interface BriefSynthesis {
  headline: string;
  summary_text: string;
  summary_html: string;
}

function parseBriefResponse(content: string): BriefSynthesis | null {
  // Strip markdown fences if the model added them despite instructions.
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed?.headline === "string" &&
      typeof parsed?.summary_text === "string" &&
      typeof parsed?.summary_html === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
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
    .insert({ step_name: "generate", status: "running", user_id: auditUserId })
    .select("id")
    .single();

  if (runErr || !run?.id) {
    console.error(
      `[generate] pipeline_runs insert failed for user=${userId.slice(0, 8)}: ${runErr?.message ?? "no row returned"}`
    );
    return NextResponse.json(
      { error: "audit_write_failed", step: "generate", detail: runErr?.message ?? "no row returned" },
      { status: 400 }
    );
  }

  try {
    // ═══ DAILY AI BUDGET ENTRY GATE (H1 fix 4) ═══════════════════════════
    // MUST run BEFORE the pendingBriefs fetch below — a budget-capped run
    // must NEVER reach the per-brief loop that increments aiAttempts, or it
    // would trip the AI_ZERO_CALL fail-loud gate further down and page as
    // if the router were down (Hostile Architect's most critical H1
    // finding). Full early-return, not a flag threaded through the loop.
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
        generated: 0,
        budgetCapCents: budget.capCents,
        spentTodayCents: budget.spentCents,
      });
    }

    // Find this user's briefs that need a summary generated, scoped to "today"
    // in the user's timezone (not UTC).
    const localToday = new Date(
      new Date().toLocaleString("en-US", { timeZone: prefs.timezone })
    );
    localToday.setHours(0, 0, 0, 0);
    const briefDate = localToday.toISOString().split("T")[0];

    const { data: pendingBriefs, error: briefErr } = await supabase
      .from("briefs")
      .select("id, article_ids, ticker_symbols")
      .eq("user_id", userId)
      .eq("brief_date", briefDate)
      .is("summary_html", null);

    if (briefErr) throw briefErr;

    if (!pendingBriefs || pendingBriefs.length === 0) {
      if (run?.id) {
        await supabase
          .from("pipeline_runs")
          .update({
            status: "completed",
            items_processed: 0,
            items_created: 0,
            duration_ms: Date.now() - startTime,
            completed_at: new Date().toISOString(),
            metadata: { note: "no briefs pending summary generation" },
          })
          .eq("id", run.id);
      }
      return NextResponse.json({ message: "No briefs pending generation", generated: 0 });
    }

    // Degradation snapshot (H1 fix 2, architecture §7 assumption 4): computed
    // ONCE per run, BEFORE synthesis, and written verbatim into every brief
    // this tick generates. This is a SNAPSHOT, not a live query — a brief's
    // banner reflects what was true when it was generated, so re-opening the
    // same brief later (after sources recover or degrade further) shows the
    // same state it had at generation time. Always populated (count_degraded:
    // 0 = healthy), never a bare null after H1.
    const { data: activeSources } = await supabase
      .from("sources")
      .select("name, consecutive_failures")
      .eq("user_id", userId)
      .eq("is_active", true);
    const degradedSources = (activeSources ?? []).filter(
      (s) => (s.consecutive_failures ?? 0) >= DEGRADED_THRESHOLD
    );
    const degradedSnapshot: DegradedSourcesSnapshot = {
      count_active: (activeSources ?? []).length,
      count_degraded: degradedSources.length,
      source_names_degraded: degradedSources.map((s) => s.name),
    };

    let generatedCount = 0;
    let failedCount = 0;
    let lastModel: string | undefined;
    let totalCostUsd = 0;
    // Telemetry gate (ERR-019 / lessons.md #104): record the real AI usage on the
    // run so pipeline_runs proves the AI fired (the §9 acceptance query).
    let aiCallsMade = 0;
    let aiTokensUsed = 0;
    // Briefs that actually reached an AI call attempt (vs skipped for empty
    // article_ids / failed hydration). Gates the ERR-029 fail-loud check so a
    // legitimately-no-op tick doesn't false-positive.
    let aiAttempts = 0;
    // Anti-fabrication gate telemetry (ai-first-principles.md §5 / two-way-
    // traceability.md Pattern 3). Aggregated across briefs for the run metadata.
    let totalClaimsChecked = 0;
    let totalClaimsUnvalidated = 0;
    let regeneratedCount = 0;
    let rejectedForFabrication = 0;
    const fabricationOffenders: string[] = [];
    const perBriefValidation: Array<{
      brief_id: string;
      claims_checked: number;
      claims_unvalidated: number;
      regenerated: boolean;
      persisted: boolean;
    }> = [];

    for (const brief of pendingBriefs) {
      const articleIds = (brief.article_ids ?? []) as string[];
      if (articleIds.length === 0) continue;

      // Hydrate the article details for the LLM prompt.
      const { data: articles, error: artErr } = await supabase
        .from("raw_articles")
        .select("id, title, summary, url, source_name, published_at")
        .in("id", articleIds);

      if (artErr) {
        console.error(`[Generate] Article hydration failed: ${artErr.message}`);
        failedCount++;
        continue;
      }

      if (!articles || articles.length === 0) {
        console.warn(`[Generate] Brief ${brief.id} has article_ids but no rows resolved`);
        failedCount++;
        continue;
      }

      // Market data for this brief's story tickers ∪ the user's tracked
      // watchlist (latest row per symbol) → woven into the relevant finance
      // stories (S3). Honest: only real fetched numbers. The watchlist is always
      // available so a finance brief can surface the reader's positions.
      let marketData: MarketRow[] = [];
      const briefTickers = Array.from(
        new Set([...(brief.ticker_symbols ?? []), ...(prefs.tracked_tickers ?? [])])
      ) as string[];
      if (briefTickers.length > 0) {
        const { data: td } = await supabase
          .from("ticker_data")
          .select("symbol, price_cents, change_percent, high_52w_cents, low_52w_cents, pe_ratio, interpretation, fetched_at")
          .eq("user_id", userId)
          .in("symbol", briefTickers)
          .order("fetched_at", { ascending: false });
        const seen = new Set<string>();
        marketData = (td ?? [])
          .filter((r) => (seen.has(r.symbol) ? false : (seen.add(r.symbol), true)))
          .map((r) => ({
            symbol: r.symbol,
            price_cents: r.price_cents,
            change_percent: r.change_percent,
            high_52w_cents: r.high_52w_cents,
            low_52w_cents: r.low_52w_cents,
            pe_ratio: r.pe_ratio,
            interpretation: r.interpretation,
          }));
      }

      // Call AI router. Task is "generate-brief" — router picks Claude Sonnet.
      // Either way the response.content is JSON.
      const { system, user } = buildBriefPrompt(
        articles as ArticleForBrief[],
        {
          anchors: prefs.style_anchors,
          tone: prefs.style_tone,
          density: prefs.style_density,
        },
        marketData
      );
      let synthesis: BriefSynthesis | null = null;
      let aiModel: string | undefined;
      let aiCostUsd = 0;

      aiAttempts++;
      try {
        const aiRes = await routeAIRequest({
          task: "generate-brief",
          prompt: user,
          systemPrompt: system,
          jsonMode: true,
          maxTokens: 2000,
        });
        synthesis = parseBriefResponse(aiRes.content);
        aiModel = aiRes.model;
        aiCostUsd = aiRes.costEstimateUsd;
        totalCostUsd += aiCostUsd;
        lastModel = aiModel;
        aiCallsMade += 1;
        aiTokensUsed += (aiRes.inputTokens || 0) + (aiRes.outputTokens || 0);
        // Post-hoc tally (H1 fix 4): the REAL router cost, atomically, AFTER
        // the call happened — never estimated in advance.
        await recordAiSpend(supabase, userId, aiCostUsd);
      } catch (err) {
        console.error(`[Generate] AI router failed for brief ${brief.id}:`, (err as Error).message);
        failedCount++;
        continue;
      }

      if (!synthesis) {
        console.error(`[Generate] Could not parse JSON from model output for brief ${brief.id}`);
        failedCount++;
        continue;
      }

      // ═══ ANTI-FABRICATION GATE (ai-first-principles.md §5 / two-way-traceability Pattern 3) ═══
      // The prompt asks the model to paraphrase-only; that is a request, not a guarantee. Here we
      // PROVE it: substring-validate every number + ticker in the synthesis against the exact
      // source the model was grounded on (article title+summary ∪ the real MARKET DATA numbers).
      // A fabricated figure must never persist (ERR-029 / ai-native.md SS4.1 fail-closed discipline).
      const sourceText =
        (articles as ArticleForBrief[])
          .map((a) => `${a.title}\n${a.summary ?? ""}`)
          .join("\n") +
        "\n" +
        renderMarketBlock(marketData);

      let validation = validateBriefSynthesis(synthesis.summary_text, sourceText, briefTickers);
      let regenerated = false;

      if (!validation.ok) {
        // Regenerate ONCE with a stricter "use ONLY these exact figures" directive. If it still
        // fails, the brief is NOT persisted (summary_html stays NULL, re-heals next tick).
        regenerated = true;
        regeneratedCount++;
        const strictSystem =
          system +
          "\n\nSTRICT REGENERATION — your previous draft contained figures or ticker symbols that do NOT appear in the source above. Use ONLY the exact numbers, prices, percentages, and ticker symbols that appear verbatim in the provided articles and MARKET DATA block. Do not introduce, round, or infer any number or symbol that is not present in the source. If a figure is not in the source, omit it entirely.";
        try {
          const retryRes = await routeAIRequest({
            task: "generate-brief",
            prompt: user,
            systemPrompt: strictSystem,
            jsonMode: true,
            maxTokens: 2000,
          });
          aiCallsMade += 1;
          aiTokensUsed += (retryRes.inputTokens || 0) + (retryRes.outputTokens || 0);
          totalCostUsd += retryRes.costEstimateUsd;
          lastModel = retryRes.model;
          // Post-hoc tally (H1 fix 4) — same as the first-pass call above.
          await recordAiSpend(supabase, userId, retryRes.costEstimateUsd);
          const retrySynthesis = parseBriefResponse(retryRes.content);
          if (retrySynthesis) {
            synthesis = retrySynthesis;
            aiModel = retryRes.model;
            validation = validateBriefSynthesis(synthesis.summary_text, sourceText, briefTickers);
          }
          // If the retry didn't parse, `validation` keeps the failing first-pass result → not persisted.
        } catch (err) {
          console.error(`[Generate] Strict regeneration failed for brief ${brief.id}:`, (err as Error).message);
          // Leave the failing `validation` in place; the brief will not persist below.
        }
      }

      totalClaimsChecked += validation.claimsChecked;

      if (!validation.ok) {
        totalClaimsUnvalidated += validation.claimsUnvalidated;
        rejectedForFabrication++;
        for (const tok of validation.offendingTokens) {
          if (fabricationOffenders.length < 20 && !fabricationOffenders.includes(tok)) {
            fabricationOffenders.push(tok);
          }
        }
        if (perBriefValidation.length < 25) {
          perBriefValidation.push({
            brief_id: brief.id,
            claims_checked: validation.claimsChecked,
            claims_unvalidated: validation.claimsUnvalidated,
            regenerated,
            persisted: false,
          });
        }
        console.error(
          `[Generate] Brief ${brief.id} rejected — ${validation.claimsUnvalidated} ungrounded claim(s) after ${regenerated ? "regeneration" : "first pass"}: ${validation.offendingTokens.join(", ")}`
        );
        failedCount++;
        continue;
      }

      const { error: updateErr } = await supabase
        .from("briefs")
        .update({
          title: synthesis.headline.slice(0, 200),
          // Sanitize AI HTML at the single persist choke point (review C-6): every
          // consumer (dashboard dangerouslySetInnerHTML + delivery email) then reads
          // already-safe HTML, closing the stored-XSS surface.
          summary_html: sanitizeBriefHtml(synthesis.summary_html),
          summary_text: synthesis.summary_text,
          generation_model: aiModel ?? "unknown",
          prompt_version: PROMPT_VERSION + "/" + GENERATE_PROMPT_VERSION,
          degraded_sources: degradedSnapshot,
        })
        .eq("id", brief.id);

      if (updateErr) {
        console.error(`[Generate] Brief update failed: ${updateErr.message}`);
        failedCount++;
        continue;
      }

      if (perBriefValidation.length < 25) {
        perBriefValidation.push({
          brief_id: brief.id,
          claims_checked: validation.claimsChecked,
          claims_unvalidated: 0,
          regenerated,
          persisted: true,
        });
      }

      generatedCount++;
    }

    const executionTime = Date.now() - startTime;

    // ═══ FAIL-LOUD GATE (ERR-029 / lessons #104 #111) ══════════════════════
    // AI synthesis was ATTEMPTED and not one call succeeded (dead API key,
    // router down). FAIL the run — the briefs keep summary_html=NULL and
    // re-heal on the next tick, so failing loses nothing and surfaces
    // everything. The old console-only warning let a dead key report
    // 'completed' for 16 days (2026-06-15 → 07-01).
    if (aiAttempts > 0 && aiCallsMade === 0) {
      throw new Error(
        `AI_ZERO_CALL: attempted synthesis for ${aiAttempts} brief(s), 0 AI calls succeeded — dead API key or router down? Briefs left pending for retry.`
      );
    }

    if (run?.id) {
      await supabase
        .from("pipeline_runs")
        .update({
          status: "completed",
          items_processed: pendingBriefs.length,
          items_created: generatedCount,
          items_failed: failedCount,
          ai_calls_made: aiCallsMade,
          ai_tokens_used: aiTokensUsed,
          duration_ms: executionTime,
          completed_at: new Date().toISOString(),
          metadata: {
            model: lastModel,
            cost_estimate_usd: totalCostUsd,
            prompt_version: PROMPT_VERSION + "/" + GENERATE_PROMPT_VERSION,
            ai_calls_made: aiCallsMade,
            ai_tokens_used: aiTokensUsed,
            // ERR-029 observability: attempts vs successes (partial failures
            // complete honestly; total failure throws AI_ZERO_CALL above).
            ai_attempts: aiAttempts,
            // Anti-fabrication gate (ai-first-principles.md §5 / two-way-traceability
            // Pattern 3). Persisted briefs have claims_unvalidated=0 by construction;
            // rejected briefs (ungrounded number/ticker) are logged for forensics.
            validation: {
              total_claims_checked: totalClaimsChecked,
              total_claims_unvalidated: totalClaimsUnvalidated,
              regenerated_count: regeneratedCount,
              rejected_for_fabrication: rejectedForFabrication,
              offending_tokens: fabricationOffenders,
              per_brief: perBriefValidation,
            },
          },
        })
        .eq("id", run.id);
    }

    return NextResponse.json({
      briefsPending: pendingBriefs.length,
      generated: generatedCount,
      failed: failedCount,
      model: lastModel,
      costUsd: totalCostUsd,
      executionTimeMs: executionTime,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (run?.id) {
      await supabase
        .from("pipeline_runs")
        .update({
          status: "failed",
          error_message: err.message,
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }
    console.error(`[Generate] Pipeline failed: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
