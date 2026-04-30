/**
 * verify-honest-strings.ts — fake/placeholder/mock data scanner
 *
 * VIBE Rule 11: Every metric, percentage, and label must reflect REAL data.
 * Rule 34: "Temporary doesn't exist." Every placeholder ships.
 *
 * This script greps `src/` for known fakery patterns:
 *   - hardcoded financial numbers in JSX text positions ($1,234, +12.3%, 8K)
 *   - lorem ipsum, "foo bar", "test test"
 *   - "TODO" / "FIXME" / "XXX" / "HACK" / "PLACEHOLDER" without ticket reference
 *   - Math.random() in user-facing code paths
 *   - hardcoded emails outside .env (john@example.com etc)
 *   - Hardcoded Supabase project URLs / anon keys baked into source
 *
 * False positives are normal — the file maintains an allow-list of patterns
 * that are known-safe (form labels with example placeholders, ARIA strings).
 * Every flagged occurrence prints file:line and a one-line snippet so a human
 * can decide.
 *
 * Exit non-zero if any non-allowlisted match is found.
 *
 * Usage:
 *   npx tsx scripts/verify-honest-strings.ts
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { resolve, join, relative } from "path";

const SRC_ROOT = resolve(process.cwd(), "src");

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

type Finding = { file: string; line: number; rule: string; snippet: string };

// Each rule: a regex, a label, and an optional allow-list of file substrings.
const RULES: Array<{
  rule: string;
  pattern: RegExp;
  allowFiles?: RegExp[]; // skip files matching any of these
  allowLine?: RegExp; // if line matches this, ignore (within-line allow)
}> = [
  {
    rule: "HARDCODED_DOLLAR",
    pattern: /[>\s]\$\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?(?![A-Za-z_])/,
    allowFiles: [/\/seed/, /\/seed-data/, /\.test\./, /\.spec\./, /\/marketing\//],
  },
  {
    rule: "HARDCODED_PERCENT_TREND",
    // matches things like ">+12.3%<" or ">-4.5%<" in JSX text positions
    pattern: /[>\s][+\-]\d{1,3}(?:\.\d{1,2})?%(?![A-Za-z_])/,
    allowFiles: [/\.test\./, /\.spec\./, /\/marketing\//],
  },
  {
    rule: "LOREM_IPSUM",
    pattern: /\blorem\s+ipsum\b/i,
  },
  {
    rule: "TODO_WITHOUT_REF",
    // TODO / FIXME / XXX / HACK / PLACEHOLDER without an issue ref like (FM-123) or url
    pattern: /\b(TODO|FIXME|XXX|HACK|PLACEHOLDER)\b(?!.*?(\(\w+-\d+\)|https?:\/\/|#\d+))/,
    allowFiles: [/\.test\./, /\.spec\./, /\/scripts\//],
  },
  {
    rule: "MATH_RANDOM",
    pattern: /\bMath\.random\s*\(/,
    // components/ui/ is shadcn-generated primitives we don't author — they
    // legitimately use Math.random() for skeleton-shimmer width variation.
    // [/\\] handles both POSIX and Windows path separators.
    allowFiles: [/\.test\./, /\.spec\./, /[/\\]scripts[/\\]/, /[/\\]components[/\\]ui[/\\]/],
  },
  {
    rule: "EXAMPLE_EMAIL",
    pattern: /\b[a-zA-Z0-9._%+-]+@(example\.com|test\.com|foo\.com|bar\.com)\b/i,
    allowLine: /placeholder=/i,
  },
  {
    rule: "FAKE_TEXT",
    pattern: /\b(foo\s+bar|test\s+test|asdf|qwerty)\b/i,
    allowFiles: [/\.test\./, /\.spec\./],
  },
  {
    rule: "HARDCODED_SUPABASE_URL",
    // catches a literal supabase.co URL embedded in source that isn't using env
    pattern: /https:\/\/[a-z0-9]{20}\.supabase\.co/,
    allowLine: /process\.env\.|NEXT_PUBLIC_/,
  },
];

function scanFile(file: string): Finding[] {
  const findings: Finding[] = [];
  const src = readFileSync(file, "utf-8");
  const lines = src.split("\n");

  for (const rule of RULES) {
    if (rule.allowFiles?.some((re) => re.test(file))) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!rule.pattern.test(line)) continue;
      if (rule.allowLine && rule.allowLine.test(line)) continue;
      findings.push({
        file,
        line: i + 1,
        rule: rule.rule,
        snippet: line.trim().slice(0, 120),
      });
    }
  }
  return findings;
}

function main() {
  console.log("🔍 verify-honest-strings: scanning src/ for fakery patterns…");
  const files = walk(SRC_ROOT);
  const all: Finding[] = [];
  for (const f of files) all.push(...scanFile(f));

  if (all.length === 0) {
    console.log(`✅ verify-honest-strings: ${files.length} files clean — no fakery patterns`);
    return;
  }

  console.log(`❌ verify-honest-strings: ${all.length} suspicious occurrence(s):`);
  console.log("");
  // group by rule
  const byRule = new Map<string, Finding[]>();
  for (const f of all) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule)!.push(f);
  }
  for (const [rule, list] of byRule) {
    console.log(`   [${rule}] ${list.length} occurrence(s):`);
    for (const f of list) {
      console.log(`     ${relative(process.cwd(), f.file)}:${f.line}  ${f.snippet}`);
    }
    console.log("");
  }
  console.log("   If any of these are intentional, add to RULES.allowFiles or RULES.allowLine.");
  process.exit(1);
}

main();
