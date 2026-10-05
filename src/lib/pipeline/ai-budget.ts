/**
 * ai-budget.ts — daily AI spend cap (H1 fix 4,
 * docs/architecture/curation-hardening-vra.md §7 assumptions 5-8).
 *
 * Design: entry-gate + post-hoc tally, NOT full pre-reservation. Each route
 * (score, generate) calls checkDailyAiBudget() ONCE at the top, BEFORE any
 * fetch that populates aiAttempts — a budget-capped run must NEVER reach the
 * code path that would trip the existing AI_ZERO_CALL fail-loud gate (the
 * single most important requirement in this slice; see the routes' own
 * comments). If over budget, the caller returns the honest
 * "daily_ai_budget_exceeded" empty state immediately.
 *
 * If under budget, the route proceeds and calls recordAiSpend() AFTER each
 * real AI call with the router's ACTUAL costEstimateUsd — never estimated in
 * advance (the router has no pre-call cost estimator today). Accepted
 * tolerance: a single run can overshoot the cap by up to that run's own
 * spend before the NEXT tick's entry gate refuses; bounded, self-correcting.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface BudgetCheck {
  spentCents: number;
  capCents: number;
  exceeded: boolean;
}

/**
 * Today's date as YYYY-MM-DD, UTC. The spend bucket is a simple daily
 * bucket, not timezone-aware per-user — V1 scope (architecture §7
 * assumptions 5-6 don't specify per-user timezone bucketing for the budget;
 * the cap protects against runaway cost, not a precise midnight boundary).
 */
function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Read-then-compare entry gate. NOT atomic with the caller's subsequent AI
 * calls (by design — see module doc). On a read error, fails OPEN (does not
 * block the run) — a budget-check outage must not become a pipeline outage;
 * the failure is logged with context (VIBE Rule 52), never swallowed.
 */
export async function checkDailyAiBudget(
  supabase: SupabaseClient,
  userId: string,
  capCents: number
): Promise<BudgetCheck> {
  const spendDate = todayIso();
  const { data, error } = await supabase
    .from("ai_daily_spend")
    .select("spent_cents")
    .eq("user_id", userId)
    .eq("spend_date", spendDate)
    .maybeSingle();

  if (error) {
    console.error(
      `[ai-budget] spend lookup failed for user=${userId.slice(0, 8)}: ${error.message} — failing OPEN (not blocking the run on a read error)`
    );
    return { spentCents: 0, capCents, exceeded: false };
  }

  const spentCents = data?.spent_cents ?? 0;
  return { spentCents, capCents, exceeded: spentCents >= capCents };
}

/**
 * Atomic post-hoc tally via the increment_ai_spend() RPC. Call AFTER a real
 * AI call succeeds, with its actual costEstimateUsd. No-op for a zero/negative
 * cost (nothing to record).
 */
export async function recordAiSpend(
  supabase: SupabaseClient,
  userId: string,
  costUsd: number
): Promise<void> {
  if (!costUsd || costUsd <= 0) return;
  const cents = Math.round(costUsd * 100);
  if (cents <= 0) return;
  const { error } = await supabase.rpc("increment_ai_spend", {
    p_user_id: userId,
    p_spend_date: todayIso(),
    p_cents: cents,
  });
  if (error) {
    console.error(`[ai-budget] increment_ai_spend failed for user=${userId.slice(0, 8)}: ${error.message}`);
  }
}
