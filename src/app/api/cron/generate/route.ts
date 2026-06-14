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

export const maxDuration = 120;

// v0.2 — adds Voice DNA style adaptation layer (style_anchors + tone + density)
// per migration 20260518000000. Prior v0.1 was style-agnostic.
const GENERATE_PROMPT_VERSION = "generate-v0.2";

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

/**
 * Build the prompt sent to the LLM. We deliberately constrain the model to
 * paraphrasing the article facts we provide (Layer 4 of the no-hallucination
 * architecture). The model never invents prices, names, or events — it
 * synthesizes the supplied list into a readable digest.
 */
function buildBriefPrompt(
  articles: ArticleForBrief[],
  style: StylePrefs
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

${articleList}

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

    let generatedCount = 0;
    let failedCount = 0;
    let lastModel: string | undefined;
    let totalCostUsd = 0;
    // Telemetry gate (ERR-019 / lessons.md #104): record the real AI usage on the
    // run so pipeline_runs proves the AI fired (the §9 acceptance query).
    let aiCallsMade = 0;
    let aiTokensUsed = 0;

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

      // Call AI router. Task is "generate-brief" — router picks Grok with
      // Gemini Flash fallback. Either way the response.content is JSON.
      const { system, user } = buildBriefPrompt(articles as ArticleForBrief[], {
        anchors: prefs.style_anchors,
        tone: prefs.style_tone,
        density: prefs.style_density,
      });
      let synthesis: BriefSynthesis | null = null;
      let aiModel: string | undefined;
      let aiCostUsd = 0;

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

      const { error: updateErr } = await supabase
        .from("briefs")
        .update({
          title: synthesis.headline.slice(0, 200),
          summary_html: synthesis.summary_html,
          summary_text: synthesis.summary_text,
          generation_model: aiModel ?? "unknown",
          prompt_version: PROMPT_VERSION + "/" + GENERATE_PROMPT_VERSION,
        })
        .eq("id", brief.id);

      if (updateErr) {
        console.error(`[Generate] Brief update failed: ${updateErr.message}`);
        failedCount++;
        continue;
      }

      generatedCount++;
    }

    const executionTime = Date.now() - startTime;

    // Fail-loud telemetry watchdog (ERR-019 / ERR-025): briefs were pending but
    // the AI never fired — the brief stays un-synthesized. Surface, don't hide.
    const aiZeroCallWarning = pendingBriefs.length > 0 && aiCallsMade === 0;
    if (aiZeroCallWarning) {
      console.error(
        `[generate] ⚠ AI-ZERO-CALL: ${pendingBriefs.length} brief(s) pending but made 0 AI calls — briefs left un-synthesized (router down? empty article_ids?). user=${userId.slice(0, 8)}`
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
            ...(aiZeroCallWarning ? { ai_zero_call_warning: true } : {}),
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
