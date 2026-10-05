/**
 * Health check endpoint — verifies env vars and DB connectivity
 * WITHOUT exposing the actual key values.
 *
 * Visit http://localhost:3000/api/health after setting .env.local.
 *
 * Returns:
 *   { ok: true, checks: {...} } if everything works
 *   { ok: false, missing: [...], errors: [...] } if anything is wrong
 *
 * NEVER logs or returns actual env var values.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean | string> = {};
  const missing: string[] = [];
  const errors: string[] = [];

  // Required env vars (Phase 0)
  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
  ];

  for (const v of requiredVars) {
    const isSet = Boolean(process.env[v]);
    checks[v] = isSet ? "set" : "missing";
    if (!isSet) missing.push(v);
  }

  // Optional vars (Phase 1+) — log only whether they're set, no values
  const optionalVars = [
    "GOOGLE_AI_API_KEY",
    "FINNHUB_API_KEY",
    "RESEND_API_KEY",
    "XAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "PERPLEXITY_API_KEY",
  ];

  const optional: Record<string, string> = {};
  for (const v of optionalVars) {
    optional[v] = process.env[v] ? "set" : "not set";
  }

  // If any required missing, bail before attempting DB
  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        phase: "phase-0",
        checks,
        optional,
        missing,
        errors: ["Missing required environment variables"],
        next_steps: [
          "Open .env.local in notepad",
          "Set the missing variables",
          "Restart `npm run dev`",
          "Reload this page",
        ],
      },
      { status: 503 }
    );
  }

  // Try DB connection (with service role — bypasses RLS for health check)
  try {
    const supabase = await createServiceClient();
    const { count, error } = await supabase
      .from("brain_stack_layers")
      .select("*", { count: "exact", head: true });

    if (error) {
      errors.push(`Supabase query failed: ${error.message}`);
      checks["supabase_connection"] = `error: ${error.code || "unknown"}`;
    } else {
      checks["supabase_connection"] = "ok";
      checks["brain_stack_layers_count"] = String(count ?? 0);
    }
  } catch (e) {
    errors.push(
      `Supabase client failed: ${e instanceof Error ? e.message : "unknown"}`
    );
    checks["supabase_connection"] = "error: client init failed";
  }

  return NextResponse.json({
    ok: errors.length === 0,
    phase: "phase-0",
    checks,
    optional,
    errors,
    notes: [
      "Phase 0 only requires the 4 required vars + DB connection",
      "Optional vars unlock Phase 1+ features",
      "If brain_stack_layers_count is 0, run the brain_stack migration",
    ],
  });
}
