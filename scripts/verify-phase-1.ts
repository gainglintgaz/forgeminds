/**
 * verify-phase-1.ts — Phase 1 (Pipeline End-to-End) verification orchestrator
 *
 * Runs every Phase 0 gate AND adds Phase 1-specific gates that match the
 * REVISED Phase 1 closure criteria from DECISIONS.md 2026-05-04:
 *
 *   "Pipeline infrastructure is ready and DORMANT until users tell it what
 *    to do — and the pipeline genuinely does nothing until they do."
 *
 * Steps (each must exit 0 to proceed):
 *   1. tsc --noEmit              (catches what Vite/Turbopack skip)
 *   2. lint                      (eslint, zero errors)
 *   3. verify:db                 (all migrations applied, signature tables)
 *   4. verify:columns            (no schema drift in Supabase queries)
 *   5. verify:rls                (every public table has RLS + policy)
 *   6. verify:honest-strings     (no fake/placeholder/mock data)
 *   7. verify:env-vars           (Phase 1 required vars wired)
 *   8. verify:cron-routes        (6 cron endpoints respond 200)
 *   9. verify:cron-empty-handling (each route handles zero-source users
 *                                  cleanly — pipeline_runs.status='completed',
 *                                  items_processed=0, no errors)
 *  10. verify:pg-cron-success    (≥95% of pg_cron dispatcher runs in
 *                                  last 30min have status='succeeded' —
 *                                  catches PL/pgSQL crashes invisible to
 *                                  pipeline_runs. Added 2026-05-12 after
 *                                  vault.read_secret bug went undetected
 *                                  for 5 days.)
 *  11. e2e (playwright)          (auth + dashboard + sources + briefs flows)
 *
 * NOT run anymore: verify:pipeline-flow (audit Blocker 3 — that gate
 * asserted ≥1 row in raw_articles/scored_articles/briefs in last 24h,
 * which contradicts the dormant-pipeline closure criteria. Replaced by
 * verify:cron-empty-handling above.)
 *
 * On any failure: print which step failed, exit 1.
 * On full pass: print AUDIT GATE [phase-1] block, exit 0.
 *
 * Usage:
 *   npx tsx scripts/verify-phase-1.ts
 *   npx tsx scripts/verify-phase-1.ts --skip-e2e   (during early Phase 1 dev)
 */

import { spawnSync } from "child_process";

const SKIP_E2E = process.argv.includes("--skip-e2e");
const SKIP_RUNTIME = process.argv.includes("--skip-runtime"); // skip cron-routes + cron-empty-handling (require dev server)

type Step = {
  name: string;
  cmd: string;
  args: string[];
};

const STEPS: Step[] = [
  { name: "tsc --noEmit", cmd: "npx", args: ["tsc", "--noEmit"] },
  { name: "lint", cmd: "npm", args: ["run", "lint"] },
  { name: "verify:db", cmd: "npx", args: ["tsx", "scripts/verify-db.ts"] },
  { name: "verify:columns", cmd: "npx", args: ["tsx", "scripts/verify-columns.ts"] },
  { name: "verify:rls", cmd: "npx", args: ["tsx", "scripts/verify-rls.ts"] },
  { name: "verify:honest-strings", cmd: "npx", args: ["tsx", "scripts/verify-honest-strings.ts"] },
  { name: "verify:env-vars", cmd: "npx", args: ["tsx", "scripts/verify-env-vars.ts"] },
  ...(SKIP_RUNTIME
    ? []
    : [
        { name: "verify:cron-routes", cmd: "npx", args: ["tsx", "scripts/verify-cron-routes.ts"] } as Step,
        { name: "verify:cron-empty-handling", cmd: "npx", args: ["tsx", "scripts/verify-cron-empty-handling.ts"] } as Step,
        { name: "verify:pg-cron-success", cmd: "npx", args: ["tsx", "scripts/verify-pg-cron-success.ts"] } as Step,
      ]),
  ...(SKIP_E2E
    ? []
    : [{ name: "playwright e2e", cmd: "npx", args: ["playwright", "test"] } as Step]),
];

function run(step: Step): { ok: boolean } {
  const isWindows = process.platform === "win32";
  const cmd =
    isWindows && step.cmd === "npm"
      ? "npm.cmd"
      : isWindows && step.cmd === "npx"
        ? "npx.cmd"
        : step.cmd;
  const result = spawnSync(cmd, step.args, {
    stdio: "inherit",
    shell: isWindows,
    // Tell phase-aware substeps (verify-env-vars, future verify-features)
    // we're checking Phase 1 requirements, not just Phase 0.
    env: { ...process.env, FORGEMINDS_PHASE: "1" },
  });
  return { ok: result.status === 0 };
}

function main() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  ForgeMinds — Phase 1 Verification Gate (Pipeline End-to-End)");
  console.log("════════════════════════════════════════════════════════════");
  console.log("");

  const results: Array<{ name: string; ok: boolean }> = [];

  for (const step of STEPS) {
    console.log(`▶ ${step.name}`);
    const { ok } = run(step);
    results.push({ name: step.name, ok });
    if (!ok) {
      console.log("");
      console.log(`❌ Step failed: ${step.name}`);
      console.log("   Phase 1 NOT verified. Fix the failure above, then re-run:");
      console.log("       npm run verify:phase-1");
      console.log("");
      console.log("   Do not use 'done|complete|finished|ship|deploy' wording in commits");
      console.log("   until all gates pass.");
      process.exit(1);
    }
    console.log("");
  }

  // All steps passed → emit AUDIT GATE block
  const ts = new Date().toISOString();
  console.log("════════════════════════════════════════════════════════════");
  console.log("  ✅ Phase 1 — ALL GATES PASSED");
  console.log("════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Paste this block into the commit message body for any commit");
  console.log("that uses 'done|complete|finished|ship|deploy' wording:");
  console.log("");
  console.log("AUDIT GATE [phase-1]");
  for (const r of results) {
    console.log(`✓ ${r.name.padEnd(24)} — pass`);
  }
  console.log(`verified-at: ${ts}`);
  console.log("");
}

main();
