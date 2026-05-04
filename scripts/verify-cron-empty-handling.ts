/**
 * verify-cron-empty-handling.ts — Phase 1 closure gate
 *
 * The revised Phase 1 closure criteria (DECISIONS.md 2026-05-04) say:
 *   "Pipeline infrastructure is ready and dormant until users tell it
 *    what to do — and the pipeline genuinely does nothing until they do."
 *
 * This gate proves that contract. For each of the 6 cron routes, we:
 *   1. Hit the route with a valid CRON_SECRET and a synthetic ?user_id=
 *      that is guaranteed to have ZERO sources/scored/briefs.
 *   2. Assert HTTP 200 (not 401, 404, 500).
 *   3. Assert response body is sensible (no throwing, no error messages
 *      indicating the route blew up on empty data).
 *   4. Assert the corresponding pipeline_runs row was written with
 *      status='completed' (NOT 'failed') and items_processed=0.
 *
 * Replaces the old verify-pipeline-flow.ts gate which asserted ≥1 row
 * in raw_articles/scored_articles/briefs in last 24h — that contract is
 * incompatible with revised Phase 1 closure (no user has sources yet).
 *
 * Pre-condition: `npm run dev` is running on localhost:3000 (or BASE_URL set).
 *
 * Usage:
 *   npx tsx scripts/verify-cron-empty-handling.ts
 *   BASE_URL=https://forgeminds.app npx tsx scripts/verify-cron-empty-handling.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && value && !process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error("⚠ Could not read .env.local:", (err as Error).message);
  }
}
loadEnvLocal();

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CRON_SECRET || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing CRON_SECRET / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// A UUID that is guaranteed to have no rows in any table — random per run.
// We deliberately do NOT use SYSTEM_USER_ID (some tables may have data there
// from earlier dev runs). A fresh-each-run UUID guarantees the empty case.
function freshUuid(): string {
  // RFC4122-v4-ish — sufficient for "guaranteed no row exists"
  return "00000000-0000-4000-8000-" + Date.now().toString(16).padStart(12, "0");
}

const ROUTES = ["ingest", "score", "curate", "enrich", "generate", "deliver"] as const;
type Step = typeof ROUTES[number];

interface RouteResult {
  step: Step;
  http_status: number;
  http_ok: boolean;
  body_summary: string;
  pipeline_run_status: string | null;
  pipeline_run_items_processed: number | null;
  blockers: string[];
}

async function checkRoute(step: Step, userId: string): Promise<RouteResult> {
  const blockers: string[] = [];

  // 1. Hit the route
  const url = `${BASE_URL}/api/cron/${step}?user_id=${userId}`;
  let httpStatus = 0;
  let bodyText = "";
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(30000),
    });
    httpStatus = res.status;
    bodyText = await res.text();
  } catch (err) {
    blockers.push(`fetch failed: ${(err as Error).message}`);
    return {
      step,
      http_status: 0,
      http_ok: false,
      body_summary: "fetch error",
      pipeline_run_status: null,
      pipeline_run_items_processed: null,
      blockers,
    };
  }

  if (httpStatus !== 200) {
    blockers.push(`HTTP ${httpStatus} (expected 200)`);
  }

  // 2. Body should not contain "error" or 500-class language
  const bodyLower = bodyText.toLowerCase();
  if (bodyLower.includes('"error":') && !bodyLower.includes('"error":null')) {
    blockers.push(`response body contains error: ${bodyText.slice(0, 200)}`);
  }

  // 3. Verify pipeline_runs row was written with completed status + 0 items
  // Find the most recent pipeline_runs row for this step + user_id (within last 60s).
  await new Promise((r) => setTimeout(r, 500)); // small grace for async DB write

  const { data: runs, error: runsErr } = await supabase
    .from("pipeline_runs")
    .select("status, items_processed, items_created, error_message, started_at")
    .eq("step_name", step)
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1);

  let runStatus: string | null = null;
  let runItemsProcessed: number | null = null;

  if (runsErr) {
    blockers.push(`pipeline_runs query failed: ${runsErr.message}`);
  } else if (!runs || runs.length === 0) {
    blockers.push("no pipeline_runs row written for this invocation");
  } else {
    const row = runs[0];
    runStatus = row.status;
    runItemsProcessed = row.items_processed ?? null;

    if (row.status !== "completed") {
      blockers.push(`pipeline_runs.status='${row.status}' (expected 'completed' for empty case). error_message=${row.error_message ?? "<none>"}`);
    }
    if ((row.items_processed ?? 0) !== 0) {
      blockers.push(`pipeline_runs.items_processed=${row.items_processed} (expected 0 for empty case)`);
    }
  }

  return {
    step,
    http_status: httpStatus,
    http_ok: httpStatus === 200,
    body_summary: bodyText.slice(0, 120),
    pipeline_run_status: runStatus,
    pipeline_run_items_processed: runItemsProcessed,
    blockers,
  };
}

async function main() {
  console.log("🔍 verify-cron-empty-handling: every route must handle zero-source users gracefully");
  console.log(`   BASE_URL: ${BASE_URL}`);
  console.log("");

  const userId = freshUuid();
  console.log(`   Synthetic user_id (guaranteed no rows): ${userId}`);
  console.log("");

  const results: RouteResult[] = [];
  for (const step of ROUTES) {
    process.stdout.write(`   ▶ ${step.padEnd(10)} `);
    const r = await checkRoute(step, userId);
    results.push(r);
    if (r.blockers.length === 0) {
      console.log(`✓ HTTP ${r.http_status}, run=${r.pipeline_run_status}, items=${r.pipeline_run_items_processed}`);
    } else {
      console.log(`✗ ${r.blockers.length} blocker(s)`);
      for (const b of r.blockers) console.log(`        - ${b}`);
    }
  }

  // Cleanup synthetic pipeline_runs rows (don't pollute history)
  await supabase
    .from("pipeline_runs")
    .delete()
    .eq("user_id", userId);

  console.log("");
  const totalBlockers = results.reduce((acc, r) => acc + r.blockers.length, 0);
  if (totalBlockers === 0) {
    console.log(`✅ verify-cron-empty-handling: ${ROUTES.length}/${ROUTES.length} routes handle empty case correctly`);
    return;
  }

  console.log(`❌ verify-cron-empty-handling: ${totalBlockers} blocker(s) across ${results.filter((r) => r.blockers.length > 0).length} route(s)`);
  console.log("");
  console.log("   Each cron route must, when invoked for a user with zero sources/articles/briefs:");
  console.log("     1. Return HTTP 200 (not 401, 404, 500)");
  console.log("     2. Have no error in response body");
  console.log("     3. Write pipeline_runs row with status='completed' and items_processed=0");
  console.log("");
  console.log("   The dormant-pipeline contract (DECISIONS.md 2026-05-04) requires this.");
  process.exit(1);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
