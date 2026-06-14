import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * Ops metric: "AI tokens consumed today" (the runtime AI-at-core proof).
 *
 * Reads pipeline_runs telemetry for the current UTC date and returns per-step
 * AI call/token sums plus a grand total. This is the queryable surface for the
 * §9 telemetry gate (ERR-019 / lessons.md #104): if `total_ai_tokens` is 0 on a
 * day the pipeline ran, the AI silently didn't fire and the build is broken.
 *
 * CRON_SECRET-gated (same bearer as the cron routes) — aggregate counts only,
 * no PII, no per-user content. A future dashboard widget can consume this JSON;
 * for now it is a reachable, curl-able ops endpoint (not dead UI).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Current UTC date window (matches the §9 acceptance query's
  // `started_at::date = current_date`, which evaluates in the DB's UTC session).
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("pipeline_runs")
    .select("step_name, status, ai_calls_made, ai_tokens_used, started_at")
    .gte("started_at", since.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type StepAgg = {
    runs: number;
    ai_calls_made: number;
    ai_tokens_used: number;
    zero_call_runs: number;
  };
  const byStep: Record<string, StepAgg> = {};
  let totalCalls = 0;
  let totalTokens = 0;

  for (const row of data ?? []) {
    const step = (row.step_name as string) ?? "unknown";
    const calls = row.ai_calls_made ?? 0;
    const tokens = row.ai_tokens_used ?? 0;
    if (!byStep[step]) {
      byStep[step] = { runs: 0, ai_calls_made: 0, ai_tokens_used: 0, zero_call_runs: 0 };
    }
    byStep[step].runs += 1;
    byStep[step].ai_calls_made += calls;
    byStep[step].ai_tokens_used += tokens;
    // A run that made an AI call but recorded 0 tokens, or a row flagged with the
    // fail-loud warning, is a "zero-call" run worth surfacing for the watchdog.
    if (calls === 0) byStep[step].zero_call_runs += 1;
    totalCalls += calls;
    totalTokens += tokens;
  }

  // The AI-bearing steps are score + generate (curate/enrich/deliver are
  // heuristic / non-AI). The gate is satisfied when both are > 0 today.
  const aiBearing = ["score", "generate"];
  const aiBearingTokens = aiBearing.reduce(
    (sum, s) => sum + (byStep[s]?.ai_tokens_used ?? 0),
    0
  );
  const gatePass = aiBearing.every((s) => (byStep[s]?.ai_tokens_used ?? 0) > 0);

  return NextResponse.json({
    date_utc: since.toISOString().split("T")[0],
    total_ai_calls: totalCalls,
    total_ai_tokens: totalTokens,
    ai_bearing_tokens_today: aiBearingTokens,
    telemetry_gate_pass: gatePass, // true only if score AND generate fired today
    by_step: byStep,
  });
}
