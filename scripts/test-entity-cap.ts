/**
 * test-entity-cap.ts — unit test for curator.ts's entity-cap enforcement (H1 fix 1).
 *
 * The project has no unit-test runner wired; the established pattern is a
 * `tsx`-runnable script with plain assertions (see scripts/test-brief-validation.ts).
 * This follows that convention (VIBE Rule 6: consistency over creativity).
 *
 * Acceptance criterion (ARCHITECTURE.md §9): given a synthetic input of 10
 * ScoreResults where 6 share ticker AAPL and maxPerEntity=2, curateStories()
 * returns AT MOST 2 items whose tickers include AAPL, across both Pass 1 and
 * Pass 2 combined.
 *
 * Run: npx tsx scripts/test-entity-cap.ts
 */

import assert from "node:assert/strict";
import { curateStories } from "../src/lib/pipeline/curator";
import type { ScoreResult } from "../src/lib/pipeline/scorer";

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

function makeScore(id: string, opts: Partial<ScoreResult> = {}): ScoreResult {
  return {
    articleId: id,
    relevanceScore: 8,
    impactScore: 7,
    depthScore: 7,
    viralScore: 6,
    compositeScore: 7,
    category: "finance",
    tickers: [],
    tone: "neutral",
    reason: "",
    ...opts,
  };
}

console.log("test-entity-cap: curator.ts maxPerEntity enforcement\n");

test("6 AAPL articles capped to maxPerEntity=2 across both passes", () => {
  const scores: ScoreResult[] = [
    ...Array.from({ length: 6 }, (_, i) =>
      makeScore(`aapl-${i}`, {
        tickers: ["AAPL"],
        compositeScore: 9 - i * 0.1, // descending so order is deterministic
        category: i === 0 ? "finance" : "tech", // spread across categories so Pass 1 seats several
      })
    ),
    ...Array.from({ length: 4 }, (_, i) =>
      makeScore(`other-${i}`, {
        tickers: [],
        compositeScore: 5 - i * 0.1,
        category: "geopolitics",
      })
    ),
  ];

  const { selected, entityCapExclusions } = curateStories(scores, {
    targetCount: 15,
    maxPerCategory: 10,
    maxPerEntity: 2,
    minCompositeScore: 0,
    minRelevanceScore: 0,
    excludedCategories: [],
  });

  const aaplCount = selected.filter((s) => s.tickers.includes("AAPL")).length;
  assert.ok(aaplCount <= 2, `expected at most 2 AAPL items, got ${aaplCount}`);
  assert.ok(entityCapExclusions >= 1, "expected at least one entity-cap exclusion to be counted");
});

test("multi-ticker article counts against EVERY listed ticker", () => {
  const scores: ScoreResult[] = [
    makeScore("a", { tickers: ["AAPL", "TSLA"], compositeScore: 9, category: "finance" }),
    makeScore("b", { tickers: ["AAPL"], compositeScore: 8, category: "tech" }),
    makeScore("c", { tickers: ["TSLA"], compositeScore: 7, category: "geopolitics" }),
    makeScore("d", { tickers: ["AAPL"], compositeScore: 6, category: "civic" }),
    makeScore("e", { tickers: ["TSLA"], compositeScore: 5, category: "sports" }),
  ];

  const { selected } = curateStories(scores, {
    targetCount: 15,
    maxPerCategory: 10,
    maxPerEntity: 1,
    minCompositeScore: 0,
    minRelevanceScore: 0,
    excludedCategories: [],
  });

  const aaplCount = selected.filter((s) => s.tickers.includes("AAPL")).length;
  const tslaCount = selected.filter((s) => s.tickers.includes("TSLA")).length;
  assert.ok(aaplCount <= 1, `expected at most 1 AAPL item, got ${aaplCount}`);
  assert.ok(tslaCount <= 1, `expected at most 1 TSLA item, got ${tslaCount}`);
});

test("no tickers at all is unaffected by the entity cap", () => {
  const scores: ScoreResult[] = Array.from({ length: 5 }, (_, i) =>
    makeScore(`n-${i}`, { tickers: [], compositeScore: 9 - i, category: "finance" })
  );
  const { selected, entityCapExclusions } = curateStories(scores, {
    targetCount: 15,
    maxPerCategory: 10,
    maxPerEntity: 2,
    minCompositeScore: 0,
    minRelevanceScore: 0,
    excludedCategories: [],
  });
  assert.equal(selected.length, 5);
  assert.equal(entityCapExclusions, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
