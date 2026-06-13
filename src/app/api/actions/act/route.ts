/**
 * POST /api/actions/act  —  Act / Hand to AI (AI; design doc §R2.1).
 *
 * Turns an article into an executable brief the user HANDS to an AI / agent / code
 * session. Config: flavor ∈ {research, plan, draft_brief, code_kickoff} + target + depth.
 * Persists into action_plans (title + rationale = the brief, steps = structured sections,
 * config = {flavor,target,params,sources}). prompt_version = 'act-v1'. Grounded in the
 * one article. matched_goal_id stays NULL (no goals table exists yet).
 *
 * EXPLICIT PHASE-1 NON-GOAL: ForgeMinds does NOT autonomously invoke an agent / code
 * session. This route only WRITES the brief the user runs. Autonomous execution is a
 * Trust-Ladder / autonomy-gated capability for a later phase (no agent-run infra exists).
 *
 * Rule 56: conversational config tracked Phase 2; structured controls are the fallback.
 * Cookie auth only; AI via router only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routeAIRequest } from "@/lib/ai/router";
import { checkGrounding } from "@/lib/ai/grounding";
import { resolveActConfig } from "@/lib/actions/resolve-config";
import { loadActionArticle, isUuid } from "@/lib/actions/server";
import { articleGroundingText, articlePromptBody, buildArticleSource } from "@/lib/actions/sources";
import type { ActConfig, ActFlavor, AiOutputMeta } from "@/lib/actions/types";

const PROMPT_VERSION = "act-v1";

const FLAVOR: Record<ActFlavor, { label: string; instruction: string }> = {
  research: {
    label: "Research brief",
    instruction:
      "Produce a ready-to-paste RESEARCH BRIEF for an AI research agent to investigate this story further. Sections: Core Question, What's Known (strictly from the article), What To Verify, and 3-5 specific research queries.",
  },
  plan: {
    label: "Action plan",
    instruction:
      "Produce an ACTION PLAN for the reader based on this article. Sections: Goal (one line), Rationale (tied to facts in the article), and 3-6 concrete numbered Steps. This is not financial/legal advice.",
  },
  draft_brief: {
    label: "Content brief",
    instruction:
      "Produce a ready-to-paste CONTENT BRIEF an AI writer could turn into a post or article. Sections: Angle, Key Facts (from the article only), Target Audience, and an Outline.",
  },
  code_kickoff: {
    label: "Code kickoff",
    instruction:
      "Produce a ready-to-paste KICKOFF BRIEF for a coding/agent session (e.g. Claude Code) to build something this article inspires. Use clearly-labeled sections: SOURCE (this article + link), GOAL, CONSTRAINTS, and ACCEPTANCE CRITERIA.",
  },
};
const DEPTH_TOKENS: Record<ActConfig["depth"], number> = { brief: 500, standard: 800, deep: 1200 };

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

  const config = await resolveActConfig(supabase, user.id, body.overrides ?? {});
  const flavor = FLAVOR[config.flavor];

  const systemPrompt = [
    "You are ForgeMinds' action engine. You are given ONE news article and must produce a brief the user will HAND to another AI / agent / code session. You do NOT execute anything yourself.",
    "",
    "HARD RULES:",
    "- Use only facts from the provided article. Never invent prices, %, dates, names, or quotes not in it.",
    "- No financial, legal, tax, or medical advice.",
    "- Output a ready-to-paste brief in plain text with clear section labels. No markdown fences.",
    "",
    flavor.instruction,
    `TARGET: ${config.target} — write the brief so it can be pasted directly into that.`,
  ].join("\n");

  let output: string;
  let model: string;
  try {
    const res = await routeAIRequest({
      task: "deep-analysis",
      prompt: articlePromptBody(article),
      systemPrompt,
      jsonMode: false,
      maxTokens: DEPTH_TOKENS[config.depth],
    });
    output = (res.content ?? "").trim();
    model = res.model;
  } catch (err) {
    console.error(
      `[actions/act] router failed (user=${user.id.slice(0, 8)}, article=${articleId.slice(0, 8)}): ${(err as Error).message}`
    );
    return NextResponse.json(
      { error: "ai_unavailable", detail: "Brief could not be generated. Try again." },
      { status: 502 }
    );
  }
  if (!output) {
    return NextResponse.json({ error: "ai_empty", detail: "Empty brief. Try again." }, { status: 502 });
  }

  const grounding = checkGrounding(output, articleGroundingText(article));
  const source = buildArticleSource(article);
  const title = `${flavor.label}: ${article.title}`.slice(0, 200);
  const steps = output
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text, i) => ({ n: i + 1, text }));

  const { data: plan, error: planError } = await supabase
    .from("action_plans")
    .insert({
      user_id: user.id,
      article_id: articleId,
      brief_id: null,
      matched_goal_id: null, // no goals table yet — always null in Phase 1
      title,
      rationale: output,
      steps,
      status: "suggested",
      generation_model: model,
      prompt_version: PROMPT_VERSION,
      config: { flavor: config.flavor, target: config.target, params: config, sources: [source] },
    })
    .select("id")
    .single();

  if (planError || !plan) {
    console.error(
      `[actions/act] action_plans insert failed (article=${articleId.slice(0, 8)}): ${planError?.message ?? "no row"}`
    );
    return NextResponse.json(
      { error: "persist_failed", detail: planError?.message ?? "no row returned" },
      { status: 500 }
    );
  }
  const planId = plan.id as string;

  const { error: eventError } = await supabase.rpc("track_event", {
    p_event_type: "feature_used",
    p_article_id: articleId,
    p_metadata: { action: "act", flavor: config.flavor, plan_id: planId },
  });
  if (eventError) {
    console.error(`[actions/act] track_event failed (plan=${planId.slice(0, 8)}): ${eventError.message}`);
  }

  const meta: AiOutputMeta = { model, promptVersion: PROMPT_VERSION, source, grounding };
  return NextResponse.json({ planId, output, meta, config, title });
}
