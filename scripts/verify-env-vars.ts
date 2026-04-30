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

const PHASE_0_REQUIRED = new Set<string>([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
]);

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
  for (const v of PHASE_0_REQUIRED) {
    if (!usage.has(v)) missingRequired.push(v);
  }

  if (unused.length > 0) {
    console.log("   Unused (warning, not blocking unless Phase 0 required):");
    for (const v of unused) console.log(`     - ${v}`);
    console.log("");
  }

  if (missingRequired.length > 0) {
    console.log("❌ verify-env-vars: Phase 0 required vars not used in src/:");
    for (const v of missingRequired) console.log(`     - ${v}`);
    console.log("");
    console.log("   Either delete the var from .env.example or wire it up.");
    process.exit(1);
  }

  console.log(`✅ verify-env-vars: all ${PHASE_0_REQUIRED.size} Phase 0 required vars wired into src/`);
}

main();
