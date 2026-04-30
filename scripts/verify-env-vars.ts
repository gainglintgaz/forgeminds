/**
 * verify-env-vars.ts — env-var usage gate
 *
 * For every env var declared in `.env.example` (or `.env.local` as fallback),
 * scan `src/` to find where it's read (`process.env.NAME`,
 * `process.env["NAME"]`, or `import.meta.env.NAME`).
 *
 * Reports for each var:
 *   USED       → read by at least one file in src/
 *   UNUSED     → declared but no code reads it (probably wired wrong)
 *   PHASE_0    → required for Phase 0 functional paths (must be USED)
 *
 * Exit non-zero if any PHASE_0 var is UNUSED.
 *
 * The list of Phase 0 required vars is defined inline below — adjust as the
 * project moves through phases.
 *
 * Usage:
 *   npx tsx scripts/verify-env-vars.ts
 */

import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { resolve, join, relative } from "path";

const ENV_EXAMPLE = resolve(process.cwd(), ".env.example");
const ENV_LOCAL = resolve(process.cwd(), ".env.local");
const SRC_ROOT = resolve(process.cwd(), "src");

// Phase-scoped required env vars. Each phase adds to the set as new
// functional code paths come online. The verifier checks the current phase
// (via FORGEMINDS_PHASE env var, default = highest defined phase).
const REQUIRED_BY_PHASE: Record<string, string[]> = {
  "0": [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
  ],
  "1": [
    // Resend powers /api/cron/deliver email sending in Phase 1.
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    // Finnhub powers /api/cron/enrich ticker quotes (already used in ingest,
    // but enrich makes it required).
    "FINNHUB_API_KEY",
  ],
};

// Default to "0" so plain `npm run verify:env-vars` keeps Phase 0 semantics.
// Phase orchestrators (verify-phase-1.ts, verify-phase-2.ts, …) set
// FORGEMINDS_PHASE explicitly when they spawn this script as a substep.
const CURRENT_PHASE = process.env.FORGEMINDS_PHASE ?? "0";

// Union of all required vars for the current phase and all earlier phases.
function buildRequiredSet(): Set<string> {
  const required = new Set<string>();
  const phases = Object.keys(REQUIRED_BY_PHASE)
    .map(Number)
    .filter((n) => n <= Number(CURRENT_PHASE))
    .sort();
  for (const p of phases) {
    for (const v of REQUIRED_BY_PHASE[String(p)]) required.add(v);
  }
  return required;
}

const PHASE_REQUIRED = buildRequiredSet();

function readDeclaredVars(): string[] {
  const path = existsSync(ENV_EXAMPLE) ? ENV_EXAMPLE : ENV_LOCAL;
  if (!existsSync(path)) {
    console.error("❌ Neither .env.example nor .env.local exists");
    process.exit(1);
  }
  const content = readFileSync(path, "utf-8");
  const names = new Set<string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (/^[A-Z][A-Z0-9_]*$/.test(key)) names.add(key);
  }
  return Array.from(names).sort();
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const declared = readDeclaredVars();
  console.log(`🔍 verify-env-vars: ${declared.length} vars declared in env file`);

  if (!existsSync(SRC_ROOT)) {
    console.error("❌ src/ directory missing");
    process.exit(1);
  }
  const files = walk(SRC_ROOT);
  const usage = new Map<string, string[]>(); // var → [file:line]

  for (const file of files) {
    const lines = readFileSync(file, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const v of declared) {
        const re = new RegExp(
          `(?:process\\.env\\.${v}\\b|process\\.env\\[\\s*["']${v}["']\\s*\\]|import\\.meta\\.env\\.${v}\\b)`
        );
        if (re.test(lines[i])) {
          if (!usage.has(v)) usage.set(v, []);
          usage.get(v)!.push(`${relative(process.cwd(), file)}:${i + 1}`);
        }
      }
    }
  }

  const unused: string[] = [];
  const used: string[] = [];
  for (const v of declared) {
    if (usage.has(v)) used.push(v);
    else unused.push(v);
  }

  console.log("");
  console.log(`   USED:   ${used.length}`);
  console.log(`   UNUSED: ${unused.length}`);
  console.log("");

  const missingRequired: string[] = [];
  for (const v of PHASE_REQUIRED) {
    if (!usage.has(v)) missingRequired.push(v);
  }

  if (unused.length > 0) {
    console.log(`   Unused (warning, not blocking unless required at phase ${CURRENT_PHASE}):`);
    for (const v of unused) console.log(`     - ${v}`);
    console.log("");
  }

  if (missingRequired.length > 0) {
    console.log(`❌ verify-env-vars: phase-${CURRENT_PHASE} required vars not used in src/:`);
    for (const v of missingRequired) console.log(`     - ${v}`);
    console.log("");
    console.log("   Either delete the var from .env.example or wire it up.");
    process.exit(1);
  }

  console.log(`✅ verify-env-vars: all ${PHASE_REQUIRED.size} phase-${CURRENT_PHASE} required vars wired into src/`);
}

main();
