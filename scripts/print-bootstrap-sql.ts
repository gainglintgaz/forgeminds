/**
 * print-bootstrap-sql.ts — render phase-1-project-bootstrap.sql with secrets
 * substituted from .env.local, write to stdout.
 *
 * Why this exists: the bootstrap SQL is a TEMPLATE committed to git with
 * `REPLACE_ME_WITH_CRON_SECRET_FROM_DEPLOYMENT_ENV` as a placeholder. Real
 * deployments need to substitute the actual CRON_SECRET before pasting into
 * the Supabase SQL editor. Doing that by hand-editing the file risks
 * accidentally committing the real secret to git (the original failure
 * mode in conversation 2026-05-04). This script does the substitution
 * on-the-fly without ever touching the committed file.
 *
 * Usage:
 *
 *   npm run print:bootstrap-sql              # prints to stdout (pipe it)
 *   npm run print:bootstrap-sql | clip       # PowerShell — copies to clipboard
 *   npm run print:bootstrap-sql | pbcopy     # macOS — copies to clipboard
 *
 * Then paste in the Supabase SQL editor → Run. The committed file is
 * never modified. Your secret never enters git.
 *
 * Reads .env.local for substitution values. If CRON_SECRET is missing,
 * exits non-zero with a helpful message — won't print SQL with a still-
 * unresolved placeholder (defense against accidentally pasting a SQL with
 * 'REPLACE_ME_…' as the literal vault secret).
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ENV_LOCAL = resolve(process.cwd(), ".env.local");
const TEMPLATE_PATH = resolve(
  process.cwd(),
  "supabase/seeds/phase-1-project-bootstrap.sql"
);

if (!existsSync(ENV_LOCAL)) {
  console.error("❌ .env.local not found at", ENV_LOCAL);
  process.exit(1);
}
if (!existsSync(TEMPLATE_PATH)) {
  console.error("❌ Bootstrap template not found at", TEMPLATE_PATH);
  process.exit(1);
}

// Read .env.local for the values we need to substitute.
const envContent = readFileSync(ENV_LOCAL, "utf-8");
const envMap: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  // Strip surrounding quotes if present
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  envMap[key] = value;
}

const cronSecret = envMap["CRON_SECRET"];
if (!cronSecret) {
  console.error(
    "❌ CRON_SECRET not found in .env.local — cannot render bootstrap SQL."
  );
  console.error("   Add CRON_SECRET=<value> to .env.local first.");
  process.exit(1);
}

// Read the template + substitute.
let sql = readFileSync(TEMPLATE_PATH, "utf-8");

// One substitution: the CRON_SECRET placeholder. If we ever add more in
// the template, list them here and the substitution is symmetric.
const SUBSTITUTIONS: Array<[RegExp, string]> = [
  [/REPLACE_ME_WITH_CRON_SECRET_FROM_DEPLOYMENT_ENV/g, cronSecret],
];

for (const [pattern, value] of SUBSTITUTIONS) {
  sql = sql.replace(pattern, value);
}

// Defense: if any REPLACE_ME_* tokens still remain, refuse to print.
const remaining = sql.match(/REPLACE_ME_[A-Z_]+/g);
if (remaining && remaining.length > 0) {
  console.error(
    "❌ Unresolved placeholder(s) still in rendered SQL: " +
      Array.from(new Set(remaining)).join(", ")
  );
  console.error("   Add the missing value(s) to .env.local and re-run.");
  process.exit(1);
}

// Print to stdout. The user pipes this into clip/pbcopy or directly into
// the SQL editor.
process.stdout.write(sql);
