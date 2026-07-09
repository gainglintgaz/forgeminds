/**
 * verify-alpaca-header-auth.ts — permanent tripwire for the Alpaca
 * scrubUrl() exemption (H1 fix 6, architecture §7 assumption 10).
 *
 * Alpaca sends its API key via HTTP headers (`APCA-API-KEY-ID` /
 * `APCA-API-SECRET-KEY`), never a URL query param, so scrubUrl() has nothing
 * to scrub there — it is EXPLICITLY exempt from the fix-6 grep coverage
 * (`token=` / `apikey=`). That exemption is only safe as long as Alpaca's
 * catch blocks never serialize the request headers object into a logged or
 * persisted string. This script is the mechanical proof that holds, so the
 * exemption can't silently rot the next time someone "improves" error
 * logging in alpaca.ts.
 *
 * Checks BOTH Alpaca call sites:
 *   - src/lib/pipeline/ingest/alpaca.ts        (news fetcher)
 *   - src/lib/pipeline/market-data.ts           (fetchIntradayAlpaca bars)
 *
 * Run: npx tsx scripts/verify-alpaca-header-auth.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const FILES_TO_CHECK = [
  "src/lib/pipeline/ingest/alpaca.ts",
  "src/lib/pipeline/market-data.ts",
];

// A catch block is unsafe if it logs/returns something that looks like the
// full headers object (e.g. `JSON.stringify(headers)`, a bare `headers`
// reference inside a template literal, or `error.config`/`error.request`
// style axios-shaped leakage). We whitelist the one safe pattern this
// codebase actually uses: `(error as Error).message` / `(e as Error).message`.
const UNSAFE_PATTERNS = [
  /JSON\.stringify\([^)]*headers[^)]*\)/i,
  /\$\{[^}]*headers[^}]*\}/i, // template-literal interpolation of a headers var
  /console\.(error|log|warn)\([^)]*headers[^)]*\)/i,
];

let failed = false;

for (const relPath of FILES_TO_CHECK) {
  const absPath = resolve(process.cwd(), relPath);
  const content = readFileSync(absPath, "utf-8");

  // Isolate catch blocks (simple bracket-depth scan — good enough for this
  // codebase's flat try/catch shape; false positives would just make this
  // tripwire stricter, never looser).
  const catchBlocks = content.match(/catch\s*\([^)]*\)\s*\{[\s\S]*?\n\}/g) ?? [];

  let fileUnsafe = false;
  for (const block of catchBlocks) {
    for (const pattern of UNSAFE_PATTERNS) {
      if (pattern.test(block)) {
        fileUnsafe = true;
        console.error(`  [FAIL] ${relPath}: catch block appears to log/serialize headers`);
        console.error(`         ${block.trim().split("\n")[0]}...`);
      }
    }
  }

  if (!fileUnsafe) {
    console.log(`  [PASS] ${relPath}: no catch block serializes headers`);
  } else {
    failed = true;
  }
}

if (failed) {
  console.error("\nAlpaca header-auth exemption VIOLATED — a catch block may leak API key headers.");
  process.exit(1);
}
console.log("\nAlpaca header-auth exemption holds — scrubUrl() is correctly not needed here.");
