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
import {
  type UserIntent,
  type SourceProposal,
  ONBOARDING_COST_CAP_USD,
} from "@/lib/onboarding/types";

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
  // Captured first so the structured cost-audit log can report end-to-
  // end duration including auth + DB round-trips, not just LLM calls.
  const requestStartedAt = Date.now();

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
      // Persist behavior: each intake run REPLACES the user's previous
      // pending onboarding proposals, so /refine always shows exactly
      // the latest run. Accepted/dismissed rows are preserved as
      // history; the partial unique index
      // (source_suggestions_unique_pending_per_user) remains the dedup
      // backstop.
      //
      // Why not upsert: that index is PARTIAL (WHERE status='pending'
      // AND catalog_id IS NOT NULL). Postgres can only target a partial
      // index when ON CONFLICT repeats its WHERE predicate, which
      // supabase-js `onConflict` cannot express — so the previous
      // upsert failed with 42P10 on EVERY call and proposals were
      // silently discarded (refine showed "No proposals yet").
      const { error: clearError } = await service
        .from("source_suggestions")
        .delete()
        .eq("user_id", user.id)
        .eq("status", "pending")
        .eq("proposal_source", "onboarding_agent");
      if (clearError) {
        console.error("[/api/onboarding/chat] pending-clear failed:", clearError);
      }
      const { error: insertError } = await service
        .from("source_suggestions")
        .insert(rows);
      if (insertError) {
        // Non-fatal: we still return proposals to the user. Log so we
        // can investigate persistence drift.
        console.error("[/api/onboarding/chat] persist failed:", insertError);
      }
    } catch (e) {
      console.error("[/api/onboarding/chat] persist threw:", e);
    }
  }

  // Stage 4: structured cost-audit log. Per AI_FIRST_AUDIT.md §B Q4
  // the per-onboarding-run cost cap is $0.10. Without per-run logs we
  // can't audit that empirically — only model the cost from invoices.
  // Single JSON line written to server stdout (Vercel logs), grep-able
  // via dashboard. NO PII (no email, no name, no IP) — only user_id
  // (a uuid, not personal data) plus aggregate fields.
  //
  // Promoted to a behavioral_events row in Phase 2 once the
  // ai_call_log dedicated table ships (deferred to avoid mid-Phase-1.5
  // schema churn).
  const totalDurationMs = Date.now() - requestStartedAt;
  const costAuditLine = {
    event: "onboarding_chat",
    user_id: user.id,
    cost_estimate_usd: Number(costEstimateUsd.toFixed(6)),
    cost_cap_usd: ONBOARDING_COST_CAP_USD,
    cost_cap_breached: costEstimateUsd > ONBOARDING_COST_CAP_USD,
    models_used: modelsUsed,
    intent_topics_count: intent.topics.length,
    intent_paywall_pref: intent.paywallPref,
    intent_depth_pref: intent.depthPref,
    proposals_returned: proposals.length,
    duration_ms: totalDurationMs,
    ts: new Date().toISOString(),
  };
  console.log(JSON.stringify(costAuditLine));
  if (costAuditLine.cost_cap_breached) {
    console.warn(
      `[/api/onboarding/chat] cost cap breached: $${costEstimateUsd.toFixed(4)} > $${ONBOARDING_COST_CAP_USD.toFixed(4)} for user ${user.id}`
    );
  }

  const response: ChatResponseBody = {
    intent,
    proposals,
    costEstimateUsd,
    modelsUsed,
  };
  return NextResponse.json(response);
}
