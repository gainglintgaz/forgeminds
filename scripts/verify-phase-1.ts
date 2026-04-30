/**
 * verify-phase-1.ts — Phase 1 (Pipeline End-to-End) verification orchestrator
 *
 * Runs every Phase 0 gate AND adds two Phase 1-specific gates:
 *   - verify:cron-routes — all 6 cron endpoints return 200 with valid CRON_SECRET
 *   - verify:pipeline-flow — at least one row exists today in raw_articles →
 *     scored_articles → briefs (proves the pipeline ran end-to-end on real data)
 *
 * Steps (each must exit 0 to proceed):
 *   1. tsc --noEmit              (catches what Vite/Turbopack skip)
 *   2. lint                      (eslint, zero errors)
 *   3. verify:db                 (all migrations applied, signature tables)
 *   4. verify:columns            (no schema drift in Supabase queries)
 *   5. verify:rls                (every public table has RLS + policy)
 *   6. verify:honest-strings     (no fake/placeholder/mock data)
 *   7. verify:env-vars           (required vars wired)
 *   8. verify:cron-routes        (NEW: 6 cron endpoints respond 200)
 *   9. verify:pipeline-flow      (NEW: end-to-end pipeline data exists)
 *  10. e2e (playwright)          (auth + dashboard + sources + briefs flows)
 *
 * On any failure: print which step failed, exit 1.
 * On full pass: print AUDIT GATE [phase-1] block, exit 0.
 *
 * Usage:
 *   npx tsx scripts/verify-phase-1.ts
 *   npx tsx scripts/verify-phase-1.ts --skip-e2e   (during early Phase 1 dev)
 *   npx tsx scripts/verify-phase-1.ts --skip-pipeline-flow  (before first cron run)
 */

import { spawnSync } from "child_process";

const SKIP_E2E = process.argv.includes("--skip-e2e");
const SKIP_PIPELINE_FLOW = process.argv.includes("--skip-pipeline-flow");

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
  { name: "verify:cron-routes", cmd: "npx", args: ["tsx", "scripts/verify-cron-routes.ts"] },
  ...(SKIP_PIPELINE_FLOW
    ? []
    : [{ name: "verify:pipeline-flow", cmd: "npx", args: ["tsx", "scripts/verify-pipeline-flow.ts"] } as Step]),
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
