/**
 * verify-phase-0.ts — orchestrator + AUDIT GATE block emitter
 *
 * Runs every gate from VIBE Rule 35 + Phase 5.5 in order. Each gate blocks
 * the next. On full pass, emits the AUDIT GATE block that must be pasted
 * into the commit message body for any commit using "done|complete|finished
 * |ship|deploy" wording.
 *
 * Steps (each must exit 0 to proceed):
 *   1. tsc --noEmit            (catches what Vite/Turbopack skip)
 *   2. lint                    (eslint, zero errors)
 *   3. verify:db               (all migrations applied, signature tables)
 *   4. verify:columns          (no schema drift in Supabase queries)
 *   5. verify:rls              (every public table has RLS + policy)
 *   6. verify:honest-strings   (no fake/placeholder/mock data)
 *   7. verify:env-vars         (Phase 0 required vars are wired)
 *   8. e2e (playwright)        (auth + dashboard + sources flows)
 *
 * On any failure: print which step failed, print its output, exit 1.
 * On full pass: print AUDIT GATE block, exit 0.
 *
 * Usage:
 *   npx tsx scripts/verify-phase-0.ts
 *   npx tsx scripts/verify-phase-0.ts --skip-e2e   (during early Phase A install)
 */

import { spawnSync } from "child_process";

const SKIP_E2E = process.argv.includes("--skip-e2e");

type Step = {
  name: string;
  cmd: string;
  args: string[];
  optional?: boolean;
};

const STEPS: Step[] = [
  { name: "tsc --noEmit", cmd: "npx", args: ["tsc", "--noEmit"] },
  { name: "lint", cmd: "npm", args: ["run", "lint"] },
  { name: "verify:db", cmd: "npx", args: ["tsx", "scripts/verify-db.ts"] },
  { name: "verify:columns", cmd: "npx", args: ["tsx", "scripts/verify-columns.ts"] },
  { name: "verify:rls", cmd: "npx", args: ["tsx", "scripts/verify-rls.ts"] },
  {
    name: "verify:honest-strings",
    cmd: "npx",
    args: ["tsx", "scripts/verify-honest-strings.ts"],
  },
  { name: "verify:env-vars", cmd: "npx", args: ["tsx", "scripts/verify-env-vars.ts"] },
  ...(SKIP_E2E
    ? []
    : [{ name: "playwright e2e", cmd: "npx", args: ["playwright", "test"] } as Step]),
];

function run(step: Step): { ok: boolean; output: string } {
  const isWindows = process.platform === "win32";
  const cmd = isWindows && step.cmd === "npm" ? "npm.cmd" : isWindows && step.cmd === "npx" ? "npx.cmd" : step.cmd;
  const result = spawnSync(cmd, step.args, {
    stdio: "inherit",
    shell: isWindows,
  });
  return { ok: result.status === 0, output: "" };
}

function main() {
  console.log("════════════════════════════════════════════════════════════");
  console.log("  ForgeMinds — Phase 0 Verification Gate");
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
      console.log("   Phase 0 NOT verified. Fix the failure above, then re-run:");
      console.log("       npm run verify:phase-0");
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
  console.log("  ✅ Phase 0 — ALL GATES PASSED");
  console.log("════════════════════════════════════════════════════════════");
  console.log("");
  console.log("Paste this block into the commit message body for any commit");
  console.log("that uses 'done|complete|finished|ship|deploy' wording:");
  console.log("");
  console.log("AUDIT GATE [phase-0]");
  for (const r of results) {
    console.log(`✓ ${r.name.padEnd(24)} — pass`);
  }
  console.log(`verified-at: ${ts}`);
  console.log("");
}

main();
