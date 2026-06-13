/**
 * POST /api/actions/analyze  —  Analyze (AI, read-only / non-HITL).
 *
 * The star configurable feature: different people analyze different things about the
 * same story. Config (lens / depth / stance) resolves hardcoded ← user_preferences.
 * analyze_defaults ← per-click overrides. The model is fed ONLY the one article
 * (single-source confinement); a deterministic grounding check sets fact_check_*.
 * Persists an action_template_runs row with template_id = NULL (migration
 * 20260613000000). prompt_version = 'analyze-v1'.
 *
 * Rule 56: conversational config is tracked Phase 2; the structured selector controls
 * are the permitted Phase-1 fallback.
 *
 * Cookie auth only; AI via src/lib/ai/router.ts only; no silent catch.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routeAIRequest } from "@/lib/ai/router";
import { checkGrounding } from "@/lib/ai/grounding";
import { resolveAnalyzeConfig } from "@/lib/actions/resolve-config";
import { getLensDefinition } from "@/lib/actions/lenses";
import { loadActionArticle, isUuid } from "@/lib/actions/server";
import { articleGroundingText, articlePromptBody, buildArticleSource } from "@/lib/actions/sources";
import type { AnalyzeConfig, AiOutputMeta } from "@/lib/actions/types";

const PROMPT_VERSION = "analyze-v1";

const DEPTH: Record<AnalyzeConfig["depth"], { tokens: number; instruction: string }> = {
  brief: { tokens: 350, instruction: "Be brief: 2-4 tight sentences." },
  standard: { tokens: 600, instruction: "A few short paragraphs." },
  deep: { tokens: 1000, instruction: "Thorough: multiple short sections, but never pad." },
};
const STANCE: Record<AnalyzeConfig["stance"], string> = {
  facts_only: "State only facts grounded in the article. No opinions or recommendations.",
  facts_plus_opinion: "Lead with article-grounded facts, then you MAY add clearly-labeled opinion ('Opinion:').",
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { articleId?: unknown; overrides?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isUuid(body.articleId)) {
    return NextResponse.json({ error: "articleId must be a uuid" }, { status: 400 });
  }
  const articleId = body.articleId;

  const article = await loadActionArticle(supabase, articleId);
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const config = await resolveAnalyzeConfig(supabase, user.id, body.overrides ?? {});
  const lens = await getLensDefinition(supabase, config.lens, config.custom_lens);

  const systemPrompt = [
    "You are ForgeMinds' analysis engine. You are given ONE news article. Use ONLY the information in that article.",
    "",
    "HARD RULES:",
    "- Use only facts present in the provided article. If a fact is not in it, do not state it.",
    "- Never invent prices, percentages, dates, names, or quotes that aren't in the article.",
    "- Do not give financial, legal, tax, or medical advice.",
    "",
    `LENS — ${lens.display_name}: ${lens.prompt_skeleton}`,
    `GROUNDING RULE: ${lens.grounding_rule}`,
    `DEPTH: ${DEPTH[config.depth].instruction}`,
    `STANCE: ${STANCE[config.stance]}`,
    "",
    "VOICE: specific, numbers over adjectives, no hype words. Output plain text — no markdown fences.",
  ].join("\n");

  // AI via the router only. Fail-closed on router error (no output produced).
  let output: string;
  let model: string;
  try {
    const res = await routeAIRequest({
      task: "deep-analysis",
      prompt: articlePromptBody(article),
      systemPrompt,
      jsonMode: false,
      maxTokens: DEPTH[config.depth].tokens,
    });
    output = (res.content ?? "").trim();
    model = res.model;
  } catch (err) {
    console.error(
      `[actions/analyze] router failed (user=${user.id.slice(0, 8)}, article=${articleId.slice(0, 8)}): ${(err as Error).message}`
    );
    return NextResponse.json(
      { error: "ai_unavailable", detail: "Analysis could not be generated. Try again." },
      { status: 502 }
    );
  }
  if (!output) {
    return NextResponse.json({ error: "ai_empty", detail: "Empty analysis. Try again." }, { status: 502 });
  }

  const grounding = checkGrounding(output, articleGroundingText(article));
  const source = buildArticleSource(article);

  const { data: run, error: runError } = await supabase
    .from("action_template_runs")
    .insert({
      user_id: user.id,
      template_id: null,
      article_id: articleId,
      brief_id: null,
      action: "analyze",
      output_text: output,
      resolved_data: {
        lens: config.lens,
        depth: config.depth,
        stance: config.stance,
        custom_lens: config.custom_lens,
        sources: [source],
      },
      generation_model: model,
      prompt_version: PROMPT_VERSION,
      fact_check_passed: grounding.passed,
      fact_check_warnings: grounding.warnings,
      // run_outcome has no 'failed' — the fail tuple is outcome='suggested' + fact_check_passed=false.
      outcome: "suggested",
      match_score: 1.0,
      match_reason: "user-selected lens",
    })
    .select("id")
    .single();

  if (runError || !run) {
    console.error(
      `[actions/analyze] action_template_runs insert failed (article=${articleId.slice(0, 8)}): ${runError?.message ?? "no row"}`
    );
    return NextResponse.json(
      { error: "persist_failed", detail: runError?.message ?? "no row returned" },
      { status: 500 }
    );
  }
  const runId = run.id as string;

  const { error: eventError } = await supabase.rpc("track_event", {
    p_event_type: "article_analyze",
    p_article_id: articleId,
    p_template_run_id: runId,
  });
  if (eventError) {
    console.error(`[actions/analyze] track_event failed (run=${runId.slice(0, 8)}): ${eventError.message}`);
  }

  const meta: AiOutputMeta = { model, promptVersion: PROMPT_VERSION, source, grounding };
  return NextResponse.json({ runId, output, meta, config });
}
