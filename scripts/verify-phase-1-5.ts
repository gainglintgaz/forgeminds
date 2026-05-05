/**
 * verify-phase-1-5.ts — Phase 1.5 (AI-Assisted Source Discovery) gate
 *
 * Phase 1.5 ships when:
 *   • Phase 0 + Phase 1 gates still green
 *   • source_catalog migrations applied + ≥200 verified rows seeded
 *   • Conversational onboarding wizard renders + auth-gates
 *   • Source-validator runtime rejects obvious bad URLs
 *   • AUDIT GATE [phase-1-5] block ready to paste
 *
 * Steps (each must exit 0):
 *   1. tsc --noEmit
 *   2. lint
 *   3. verify:db                  (all migrations including 20260510 set)
 *   4. verify:columns             (no schema drift)
 *   5. verify:rls                 (every public table has RLS + policy,
 *                                  including new source_catalog +
 *                                  source_suggestions)
 *   6. verify:honest-strings
 *   7. verify:env-vars            (Phase-1.5 vars: ANTHROPIC_API_KEY,
 *                                  OPENAI_API_KEY, PERPLEXITY_API_KEY)
 *   8. verify:cron-routes
 *   9. verify:cron-empty-handling
 *  10. verify:source-catalog      (≥200 rows, ≥10 categories, median
 *                                  quality ≥0.65, ≥95% with embeddings)
 *  11. e2e (playwright)           (auth + dashboard + sources + briefs +
 *                                  onboarding skeleton smoke)
 *
 * Flags:
 *   --skip-e2e        skip playwright (during early dev)
 *   --skip-runtime    skip cron + onboarding smoke (no dev server up)
 *   --skip-catalog    skip source-catalog gate (allow infrastructure-
 *                     only commits before catalog seeded)
 */

import { spawnSync } from "child_process";

const SKIP_E2E = process.argv.includes("--skip-e2e");
const SKIP_RUNTIME = process.argv.includes("--skip-runtime");
const SKIP_CATALOG = process.argv.includes("--skip-catalog");

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
      ]),
  ...(SKIP_CATALOG
    ? []
    : [
        { name: "verify:source-catalog", cmd: "npx", args: ["tsx", "scripts/verify-source-catalog.ts"] } as Step,
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
    env: { ...process.env, FORGEMINDS_PHASE: "1.5" },
  });
  return { ok: result.status === 0 };
}

function main() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  ForgeMinds — Phase 1.5 Verification Gate");
  console.log("                 (AI-Assisted Source Discovery)");
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
      console.log("   Phase 1.5 NOT verified. Fix the failure above, then re-run:");
      console.log("       npm run verify:phase-1-5");
      console.log("");
      console.log("   Do not use 'done|complete|finished|ship|deploy' wording in commits");
      console.log("   until all gates pass.");
      process.exit(1);
    }
    console.log("");
  }

  const ts = new Date().toISOString();
  console.log("════════════════════════════════════════════════════════════");
  console.log("  ✅ Phase 1.5 — ALL GATES PASSED");
  console.log("════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Paste this block into the commit message body for any commit");
  console.log("that uses 'done|complete|finished|ship|deploy' wording:");
  console.log("");
  console.log("AUDIT GATE [phase-1-5]");
  for (const r of results) {
    console.log(`✓ ${r.name.padEnd(28)} — pass`);
  }
  console.log(`verified-at: ${ts}`);
  console.log("");
}

main();
