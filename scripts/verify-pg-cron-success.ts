/**
 * verify-pg-cron-success.ts — Phase 1 close gate
 *
 * Asserts that the pg_cron dispatcher jobs are actually SUCCEEDING when
 * they run, not silently failing inside their PL/pgSQL bodies.
 *
 * Why this gate exists:
 *
 *   The dispatcher pattern (per VIBE Rule 55) puts ONE pg_cron job per
 *   pipeline step (forgeminds_dispatch_ingest, _score, _curate, _enrich,
 *   _generate, _deliver). Each fires every minute and calls
 *   private.dispatch_forgeminds_cron(<step>) which iterates
 *   user_preferences and HTTP-POSTs the per-user route.
 *
 *   The pipeline_runs audit table only gets a row when a real per-user
 *   route is invoked. If a dispatcher's PL/pgSQL body crashes BEFORE
 *   reaching the HTTP layer (e.g. calling a non-existent vault function),
 *   the failure is invisible to pipeline_runs — it lives only in
 *   cron.job_run_details.
 *
 *   Discovered 2026-05-12 (P1.0-G): vault.read_secret() doesn't exist in
 *   Supabase's vault extension, so 71% of dispatcher runs failed silently
 *   for 5 days. None of the existing gates caught it. This gate prevents
 *   recurrence.
 *
 * Threshold: ≥95% of the LAST 10 dispatcher runs per job must have
 * status='succeeded'. Using last-N-runs (not a time window) keeps the
 * gate reading current health regardless of historical failure
 * backlog — a fresh hotfix turns the gate green within ~10 dispatcher
 * ticks, not after the window rolls past old failures.
 *
 * 6 dispatchers × 10 runs = 60 data points. Threshold 95% allows 3
 * transient failures across all six dispatchers and still passes.
 *
 * Pre-conditions:
 *   - .env.local has NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - pg_cron jobs are installed (verify:db confirms bootstrap ran)
 *
 * Usage:
 *   npx tsx scripts/verify-pg-cron-success.ts
 *
 * Exits non-zero on failure with the recent failure messages so the
 * underlying bug is immediately visible.
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
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && value && !process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error("⚠ Could not read .env.local:", (err as Error).message);
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(2);
}

const MIN_SUCCESS_RATE = 0.95;
const LAST_N_RUNS_PER_JOB = 10;
const MIN_RUNS_BEFORE_GATING = 6; // need at least one tick across all 6 dispatchers to judge

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface JobStat {
  jobname: string;
  total: number;
  succeeded: number;
  failed: number;
  failed_message: string | null;
}

async function main() {
  console.log(
    `🔍 verify-pg-cron-success: dispatcher success rate over last ${LAST_N_RUNS_PER_JOB} runs per job`
  );

  const { data, error } = await supabase.rpc("forgeminds_pg_cron_stats", {
    last_n_per_job: LAST_N_RUNS_PER_JOB,
  });

  if (error) {
    // If the RPC isn't installed yet, fall back to a direct PostgREST
    // path: cron.job_run_details isn't exposed through PostgREST by
    // default, so we lazily try and fail with a clear message.
    console.error(
      `❌ Could not query pg_cron stats: ${error.message}`
    );
    console.error(
      "   Apply migration 20260512000001_forgeminds_pg_cron_stats.sql " +
        "which exposes the cron.job_run_details aggregate via RPC."
    );
    process.exit(1);
  }

  const stats = (data ?? []) as JobStat[];

  if (stats.length === 0) {
    console.log("   No dispatcher jobs found in the last 30 minutes.");
    console.log("   Either pg_cron isn't installed or the bootstrap SQL wasn't applied.");
    process.exit(1);
  }

  let totalRuns = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;
  const failedSamples: string[] = [];

  for (const s of stats) {
    totalRuns += s.total;
    totalSucceeded += s.succeeded;
    totalFailed += s.failed;
    const pct = s.total === 0 ? 0 : (s.succeeded / s.total) * 100;
    const marker = s.failed === 0 ? "✓" : "✗";
    console.log(
      `   ${marker} ${s.jobname.padEnd(32)} ${s.succeeded}/${s.total} succeeded (${pct.toFixed(1)}%)`
    );
    if (s.failed > 0 && s.failed_message) {
      failedSamples.push(`${s.jobname}: ${s.failed_message.split("\n")[0]}`);
    }
  }

  console.log("");

  if (totalRuns < MIN_RUNS_BEFORE_GATING) {
    console.log(
      `⏳ Only ${totalRuns} run(s) in the window — need ≥${MIN_RUNS_BEFORE_GATING} to judge. ` +
        `Wait a minute for the next dispatcher tick, then re-run.`
    );
    process.exit(0);
  }

  const successRate = totalSucceeded / totalRuns;
  console.log(
    `   Total: ${totalSucceeded}/${totalRuns} succeeded (${(successRate * 100).toFixed(1)}%)`
  );

  if (successRate < MIN_SUCCESS_RATE) {
    console.log("");
    console.log(
      `❌ Success rate ${(successRate * 100).toFixed(1)}% below threshold ${(
        MIN_SUCCESS_RATE * 100
      ).toFixed(0)}%`
    );
    if (failedSamples.length > 0) {
      console.log("");
      console.log("   Sample failure messages:");
      for (const f of failedSamples.slice(0, 6)) {
        console.log(`     • ${f}`);
      }
    }
    console.log("");
    console.log("   The dispatchers are running but their PL/pgSQL bodies are crashing.");
    console.log("   Investigate via:");
    console.log(
      "     select return_message from cron.job_run_details"
    );
    console.log(
      "      where jobid in (select jobid from cron.job where jobname like 'forgeminds%')"
    );
    console.log(
      "        and status = 'failed' order by start_time desc limit 5;"
    );
    process.exit(1);
  }

  console.log(`✅ verify-pg-cron-success: ${(successRate * 100).toFixed(1)}% ≥ ${(MIN_SUCCESS_RATE * 100).toFixed(0)}%`);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
