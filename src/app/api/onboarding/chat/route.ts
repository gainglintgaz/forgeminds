/**
 * POST /api/onboarding/chat
 *
 * The onboarding wizard's main backend endpoint. Takes the user's
 * free-form description, extracts intent, retrieves catalog matches,
 * generates per-source proposals, persists them to source_suggestions,
 * and returns the proposals back to the client for /onboarding/refine.
 *
 * Auth: must be signed in. Uses the user's auth.uid() for ownership.
 *
 * Cost guardrail: a single call hits at most one Haiku (intent extract,
 * ~$0.001) + one Sonnet (proposal generation, ~$0.04) + one OpenAI
 * embedding (~$0.0001). Budget per run = $0.10 (ONBOARDING_COST_CAP_USD).
 *
 * Phase 1.5 status: skeleton. Streaming + multi-turn conversation
 * deferred to dedicated session. This first version does intent →
 * proposals in one round-trip + returns the full set.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  extractIntent,
  IntentExtractionError,
} from "@/lib/onboarding/intent-extractor";
import { proposeSources, AgentError } from "@/lib/onboarding/agent";
import type { UserIntent, SourceProposal } from "@/lib/onboarding/types";

interface ChatRequestBody {
  /** User's free-form description of what they want their pipeline to cover. */
  description?: string;
  /**
   * Optional refined intent (if /refine is making a follow-up call after
   * the user typed feedback). When provided, skips the extract step.
   */
  intent?: UserIntent;
}

interface ChatResponseBody {
  intent: UserIntent;
  proposals: SourceProposal[];
  /** Cost spent on this turn for guardrail tracking. */
  costEstimateUsd: number;
  modelsUsed: string[];
}

export async function POST(request: NextRequest) {
  // Auth gate. Onboarding requires signed-in user — anon proposals
  // would have nowhere to land (source_suggestions.user_id is NOT NULL).
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.description && !body.intent) {
    return NextResponse.json(
      { error: "Either `description` or `intent` is required." },
      { status: 400 }
    );
  }

  // Stage 1: intent extraction (skip if caller passed pre-extracted intent).
  let intent: UserIntent;
  try {
    intent = body.intent
      ? body.intent
      : await extractIntent(body.description!);
  } catch (e) {
    if (e instanceof IntentExtractionError) {
      return NextResponse.json(
        {
          error:
            "Couldn't extract a clear set of topics from your description. Could you say more about what you want to follow?",
          detail: e.message,
        },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: "Intent extraction failed", detail: (e as Error).message },
      { status: 500 }
    );
  }

  // Stage 2: catalog retrieval + proposal generation.
  let proposals: SourceProposal[];
  let costEstimateUsd: number;
  let modelsUsed: string[];
  try {
    const result = await proposeSources(intent);
    proposals = result.proposals;
    costEstimateUsd = result.costEstimateUsd;
    modelsUsed = result.modelsUsed;
  } catch (e) {
    if (e instanceof AgentError) {
      // Surface the agent error to the client; UI shows an actionable
      // empty state ("catalog isn't seeded yet — try again after Phase 1.5
      // close" or similar).
      return NextResponse.json(
        { error: "Source proposal generation failed", detail: e.message },
        { status: 503 }
      );
    }
    console.error("[/api/onboarding/chat] proposeSources threw:", e);
    return NextResponse.json(
      { error: "Internal proposal error", detail: (e as Error).message },
      { status: 500 }
    );
  }

  // Stage 3: persist proposals to source_suggestions so /refine can
  // load them on subsequent navigations + the user can revisit later.
  // We use the service-role client because RLS blocks anon/auth
  // INSERTs (only service_role + crons write to source_suggestions).
  if (proposals.length > 0) {
    try {
      const service = await createServiceClient();
      const rows = proposals.map((p) => ({
        user_id: user.id,
        catalog_id: p.catalogId,
        name: p.name,
        description: p.description,
        url: p.url,
        type: p.type,
        paywall_tier: p.paywallTier,
        paywall_cost_usd_monthly: p.paywallCostUsdMonthly,
        reason: p.reason,
        proposal_source: "onboarding_agent",
        rank_score: p.rankScore,
      }));
      // Upsert behavior: the unique partial index
      // source_suggestions_unique_pending_per_user prevents duplicate
      // pending rows for the same (user, catalog_id). Use ON CONFLICT
      // with the index columns to update reason + rank_score in place.
      const { error: insertError } = await service
        .from("source_suggestions")
        .upsert(rows, { onConflict: "user_id,catalog_id", ignoreDuplicates: false });
      if (insertError) {
        // Non-fatal: we still return proposals to the user. Log so we
        // can investigate persistence drift.
        console.error("[/api/onboarding/chat] persist failed:", insertError);
      }
    } catch (e) {
      console.error("[/api/onboarding/chat] persist threw:", e);
    }
  }

  const response: ChatResponseBody = {
    intent,
    proposals,
    costEstimateUsd,
    modelsUsed,
  };
  return NextResponse.json(response);
}
