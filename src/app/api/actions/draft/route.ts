/**
 * POST /api/actions/draft  —  Draft Post (AI, HITL approve gate).
 *
 * Config (platform / tone / length / stance / hashtags) resolves hardcoded ←
 * user_preferences.draft_defaults (+ social_tone) ← per-click overrides. Reddit maps to
 * content_type 'social_threads' + platform='reddit' (no social_reddit enum). Per-platform
 * char caps + hashtag defaults are DATA in draft_defaults.platform_caps.
 *
 * VOICE-DNA BOUNDARY: this reads social_tone ONLY. It never touches the style_* columns
 * and no copy says "in your voice." Voice DNA is an explicit Phase-1 non-goal.
 *
 * Rule 56: conversational config tracked Phase 2; the structured controls are the
 * permitted fallback. prompt_version = 'draft-v1'. Cookie auth only; AI via router only.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routeAIRequest } from "@/lib/ai/router";
import { checkGrounding } from "@/lib/ai/grounding";
import { resolveDraftConfig } from "@/lib/actions/resolve-config";
import { loadActionArticle, isUuid } from "@/lib/actions/server";
import { articleGroundingText, articlePromptBody, buildArticleSource } from "@/lib/actions/sources";
import type { AiOutputMeta, DraftPlatform, DraftStance } from "@/lib/actions/types";

const PROMPT_VERSION = "draft-v1";

// Structural enum mapping (the content_type enum is fixed; the configurable knobs are the
// platform choice + caps in draft_defaults). Reddit/generic → social_threads format.
const PLATFORM_CONTENT_TYPE: Record<DraftPlatform, string> = {
  x: "social_x",
  linkedin: "social_linkedin",
  facebook: "social_facebook",
  reddit: "social_threads",
  generic: "social_threads",
};

const STANCE: Record<DraftStance, string> = {
  facts_only: "State only facts grounded in the article. No opinion or recommendation.",
  facts_plus_analysis: "Lead with article facts, then add brief grounded analysis.",
  facts_plus_opinion: "Lead with article facts, then a clearly-opinionated take is allowed.",
};
const LENGTH_FACTOR: Record<"short" | "standard" | "long", number> = {
  short: 0.45,
  standard: 0.75,
  long: 1.0,
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

  const config = await resolveDraftConfig(supabase, user.id, body.overrides ?? {});
  const contentType = PLATFORM_CONTENT_TYPE[config.platform];
  const cap = config.platform_caps[config.platform]?.max_chars ?? 280;
  const targetChars = Math.round(cap * LENGTH_FACTOR[config.length]);

  const systemPrompt = [
    `You are ForgeMinds' social-post drafter. You are given ONE news article. Write a ${config.platform} post about it.`,
    "",
    "HARD RULES:",
    "- Use only facts from the provided article. Never invent prices, %, dates, names, or quotes not in it.",
    "- This is a draft for human review before publishing. No financial/legal/medical advice.",
    "",
    `PLATFORM: ${config.platform}. Keep the post under ${targetChars} characters.`,
    `TONE: ${config.tone}.`,
    `STANCE: ${STANCE[config.stance]}`,
    config.hashtags ? "HASHTAGS: include 1-3 relevant hashtags." : "HASHTAGS: do NOT include any hashtags.",
    "",
    "Write only the post text (ready to paste). No preamble, no markdown fences.",
  ].join("\n");

  let output: string;
  let model: string;
  try {
    const res = await routeAIRequest({
      task: "generate-social",
      prompt: articlePromptBody(article),
      systemPrompt,
      jsonMode: false,
      maxTokens: 600,
    });
    output = (res.content ?? "").trim();
    model = res.model;
  } catch (err) {
    console.error(
      `[actions/draft] router failed (user=${user.id.slice(0, 8)}, article=${articleId.slice(0, 8)}): ${(err as Error).message}`
    );
    // Persist a failed-status row for the attempt audit trail (draft_status has 'failed').
    await supabase.from("content_drafts").insert({
      user_id: user.id,
      article_id: articleId,
      content_type: contentType,
      platform: config.platform,
      body: "",
      status: "failed",
      generation_model: "unknown",
      prompt_version: PROMPT_VERSION,
      rejection_reason: `router error: ${(err as Error).message}`.slice(0, 300),
      provenance: { params: config, sources: [buildArticleSource(article)] },
    });
    return NextResponse.json(
      { error: "ai_unavailable", detail: "Draft could not be generated. Try again." },
      { status: 502 }
    );
  }
  if (!output) {
    return NextResponse.json({ error: "ai_empty", detail: "Empty draft. Try again." }, { status: 502 });
  }

  const grounding = checkGrounding(output, articleGroundingText(article));
  const source = buildArticleSource(article);
  const hashtagList = config.hashtags ? Array.from(new Set(output.match(/#[\p{L}\d_]+/gu) ?? [])) : [];

  const { data: draft, error: draftError } = await supabase
    .from("content_drafts")
    .insert({
      user_id: user.id,
      article_id: articleId,
      brief_id: null,
      content_type: contentType,
      platform: config.platform,
      body: output,
      hashtags: hashtagList,
      status: "pending_approval",
      generation_model: model,
      prompt_version: PROMPT_VERSION,
      provenance: { params: config, sources: [source] },
    })
    .select("id")
    .single();

  if (draftError || !draft) {
    console.error(
      `[actions/draft] content_drafts insert failed (article=${articleId.slice(0, 8)}): ${draftError?.message ?? "no row"}`
    );
    return NextResponse.json(
      { error: "persist_failed", detail: draftError?.message ?? "no row returned" },
      { status: 500 }
    );
  }
  const draftId = draft.id as string;

  const { error: eventError } = await supabase.rpc("track_event", {
    p_event_type: "draft_created",
    p_article_id: articleId,
    p_draft_id: draftId,
  });
  if (eventError) {
    console.error(`[actions/draft] track_event failed (draft=${draftId.slice(0, 8)}): ${eventError.message}`);
  }

  const meta: AiOutputMeta = { model, promptVersion: PROMPT_VERSION, source, grounding };
  return NextResponse.json({ draftId, output, meta, config, status: "pending_approval" });
}
