/**
 * test-brief-validation.ts — unit test for the anti-fabrication substring gate.
 *
 * The project has no unit-test runner wired; the established pattern is a
 * `tsx`-runnable script with plain assertions (see scripts/verify-*.ts). This
 * follows that convention (VIBE Rule 6: consistency over creativity).
 *
 * Covers the two acceptance cases from the slice contract:
 *   - a brief containing a FABRICATED price  -> rejected
 *   - a CLEAN brief (every figure grounded)  -> passes
 * plus fabricated tickers, fabricated percentages, formatting variance, and
 * small-integer noise suppression.
 *
 * Run: npx tsx scripts/test-brief-validation.ts
 */

import assert from "node:assert/strict";
import { validateBriefSynthesis } from "../src/lib/pipeline/brief-validation";

// A realistic corpus: two article title+summary blocks + a rendered MARKET DATA
// block (exactly the shape renderMarketBlock() emits in the generate route).
const SOURCE = [
  "Apple earnings beat expectations",
  "Apple reported revenue of $95,400 million, up 3.2% year over year. The SEC noted no concerns.",
  "Tesla recalls vehicles amid probe",
  "Tesla shares moved after the recall.",
  "",
  "MARKET DATA (real, fetched live — weave the relevant figures + the read into the matching stories; use ONLY these numbers, never invent others):",
  "- AAPL: $229.35 +1.20% (52wk $164.08–$237.49) P/E 34.2 — trading near highs",
  "- TSLA: $412.50 -2.40% (52wk $138.80–$488.54) P/E 62.1 — volatile",
].join("\n");

const TICKERS = ["AAPL", "TSLA"];

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.log(`  [FAIL] ${name}`);
    console.log(`         ${(err as Error).message.split("\n").join("\n         ")}`);
  }
}

console.log("test-brief-validation: anti-fabrication substring gate\n");

// ── ACCEPTANCE 1: a clean brief passes ────────────────────────────────
test("clean brief — every number + ticker grounded -> ok=true, unvalidated=0", () => {
  const clean =
    "Apple posted revenue of $95,400 million, up 3.2%. AAPL trades at $229.35, " +
    "near its 52-week high of $237.49. TSLA slid 2.40% to $412.50, with a P/E of 62.1. " +
    "The SEC flagged nothing.";
  const r = validateBriefSynthesis(clean, SOURCE, TICKERS);
  assert.equal(r.ok, true, `expected ok=true, got offenders=${JSON.stringify(r.offendingTokens)}`);
  assert.equal(r.claimsUnvalidated, 0);
  assert.ok(r.claimsChecked > 0, "expected at least one claim checked");
});

// ── ACCEPTANCE 2: a fabricated price is rejected ──────────────────────
test("fabricated price ($999.99 not in source) -> rejected", () => {
  const bad =
    "Apple posted revenue of $95,400 million. AAPL then surged to $999.99 in late trading.";
  const r = validateBriefSynthesis(bad, SOURCE, TICKERS);
  assert.equal(r.ok, false, "expected the fabricated price to fail validation");
  assert.ok(r.claimsUnvalidated >= 1);
  assert.ok(
    r.offendingTokens.some((t) => t.includes("999.99")),
    `expected $999.99 among offenders, got ${JSON.stringify(r.offendingTokens)}`
  );
});

// ── fabricated cashtag ticker ─────────────────────────────────────────
// Cashtags ($XYZ) are the unambiguous, deliberate ticker claim we validate.
test("fabricated cashtag ($ZZZZ not tracked, not in source) -> rejected", () => {
  const bad = "AAPL rose today while $ZZZZ collapsed on heavy volume.";
  const r = validateBriefSynthesis(bad, SOURCE, TICKERS);
  assert.equal(r.ok, false);
  assert.ok(
    r.offendingTokens.includes("ZZZZ"),
    `expected ZZZZ among offenders, got ${JSON.stringify(r.offendingTokens)}`
  );
});

// ── prose acronyms are NOT ticker claims (false-positive regression guard) ──
// Discovered via live run: bare all-caps prose words (UK, ETF, LA, MP, USGS…)
// are not stock tickers and must not be flagged, even when absent from source.
test("prose acronyms (UK, ETF, LA — not in source) are not flagged as tickers", () => {
  const s = "The UK approved an ETF in LA; the SEC and AAPL were unaffected at $229.35.";
  const r = validateBriefSynthesis(s, SOURCE, TICKERS);
  assert.equal(r.ok, true, `offenders=${JSON.stringify(r.offendingTokens)}`);
});

// ── bare integers + years are NOT high-risk figures (false-positive guard) ──
// Discovered via live run: bare integers/years drawn from article bodies (not
// the title+summary snippet the model was given) must not be flagged. Only
// prices ($), percentages (%), and decimals are the fabrication surface.
test("bare integers and years (2019, 358, 12 — not in source) are not flagged", () => {
  const brief = "In 2019, some 358 analysts covered 12 firms across the market.";
  const r = validateBriefSynthesis(brief, "Markets were quiet with little news.", []);
  assert.equal(r.ok, true, `offenders=${JSON.stringify(r.offendingTokens)}`);
});

// ── fabricated percentage ─────────────────────────────────────────────
test("fabricated percentage (47.8% not in source) -> rejected", () => {
  const bad = "Apple revenue climbed 47.8% on the quarter.";
  const r = validateBriefSynthesis(bad, SOURCE, TICKERS);
  assert.equal(r.ok, false);
  assert.ok(
    r.offendingTokens.some((t) => t.includes("47.8")),
    `expected 47.8% among offenders, got ${JSON.stringify(r.offendingTokens)}`
  );
});

// ── grounded acronym must NOT be flagged as a fabricated ticker ────────
test("acronym present in source (SEC) is not flagged", () => {
  const s = "The SEC reviewed AAPL at $229.35.";
  const r = validateBriefSynthesis(s, SOURCE, TICKERS);
  assert.equal(r.ok, true, `offenders=${JSON.stringify(r.offendingTokens)}`);
});

// ── formatting variance: rounded/reformatted grounded numbers pass ────
test("formatting variance ($1,234.56 in source; $1,234 / 1234.56 in brief) -> passes", () => {
  const src = "Widget Co reported a backlog of $1,234.56 million.";
  const brief = "The backlog was $1,234 million, or 1234.56 in raw terms.";
  const r = validateBriefSynthesis(brief, src, []);
  assert.equal(r.ok, true, `offenders=${JSON.stringify(r.offendingTokens)}`);
});

// ── small-integer noise is not treated as a fabricated figure ─────────
test("small integers (3 sectors, 12 stories) not in source -> not flagged", () => {
  const src = "Markets were quiet with little news.";
  const brief = "Across 3 sectors and 12 stories, sentiment held steady.";
  const r = validateBriefSynthesis(brief, src, []);
  assert.equal(r.ok, true, `offenders=${JSON.stringify(r.offendingTokens)}`);
});

// ── offender list is bounded + truncated ──────────────────────────────
test("offending tokens list is capped and each token truncated", () => {
  const bad =
    "Fabricated figures: $111111.11 $222222.22 $333333.33 $444444.44 $555555.55 " +
    "$666666.66 $777777.77 $888888.88 $999999.99 $101010.10 $121212.12 $131313.13.";
  const r = validateBriefSynthesis(bad, "no numbers here", []);
  assert.equal(r.ok, false);
  assert.ok(r.offendingTokens.length <= 10, `expected <=10 offenders, got ${r.offendingTokens.length}`);
  for (const t of r.offendingTokens) {
    assert.ok(t.length <= 40, `offender token exceeded 40 chars: ${t}`);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("[OK] all assertions passed");
