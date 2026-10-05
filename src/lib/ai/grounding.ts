/**
 * Deterministic grounding check (no second LLM call) for Phase 1 AI outputs.
 *
 * The model is fed ONLY one article. Every $-amount, % figure, and quoted span in
 * the output must appear (normalized) in that article's text. Misses become
 * fact_check_warnings[] and set fact_check_passed = false → the UI renders a
 * "Review — N unverified claims" state, never a green "Grounded" badge
 * (ai-first-principles.md §5 anti-fabrication; full spec §4 of the design doc).
 *
 * Conservative by design: a false positive (article says "3.2 percent", output says
 * "3.2%") flags for human review — the safe direction. We only check the high-risk
 * fabrication surfaces ($, %, quotes), not bare integers like "3 reasons".
 */
import type { GroundingResult } from "@/lib/actions/types";

/** Lowercase, straighten smart quotes, collapse whitespace. */
function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip currency symbols, commas, and spaces so "$1,800" ≈ "1800". */
function numericCore(s: string): string {
  return s
    .toLowerCase()
    .replace(/(billion|million|thousand|trillion|bn|mn|k|b|m)\b/gi, "")
    .replace(/[$,\s]/g, "");
}

export function checkGrounding(output: string, articleText: string): GroundingResult {
  const warnings: string[] = [];
  if (!output || !output.trim()) return { passed: true, warnings };

  const normArticle = normalizeText(articleText);
  // Numbers compared with $/,/space stripped (but % retained on both sides).
  const normArticleNums = normArticle.replace(/[$,\s]/g, "");
  const seen = new Set<string>();

  const dollarRe = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:billion|million|thousand|trillion|bn|mn|k|b|m))?/gi;
  const pctRe = /\b\d+(?:\.\d+)?\s?%/g;
  const quoteRe = /[“"]([^”"]{5,}?)[”"]/g;

  let m: RegExpExecArray | null;

  while ((m = dollarRe.exec(output)) !== null) {
    const raw = m[0].trim();
    const core = numericCore(raw);
    const key = "$" + core;
    if (!core || seen.has(key)) continue;
    seen.add(key);
    if (!normArticleNums.includes(core)) warnings.push(`Unverified figure: ${raw}`);
  }

  while ((m = pctRe.exec(output)) !== null) {
    const raw = m[0].trim();
    const core = raw.replace(/\s/g, "").toLowerCase(); // keep the % sign
    const key = "%" + core;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!normArticleNums.includes(core)) warnings.push(`Unverified figure: ${raw}`);
  }

  while ((m = quoteRe.exec(output)) !== null) {
    const innerRaw = m[1].trim();
    const inner = normalizeText(innerRaw);
    const key = "q:" + inner;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!normArticle.includes(inner)) {
      const snippet = innerRaw.length > 60 ? innerRaw.slice(0, 60) + "…" : innerRaw;
      warnings.push(`Unverified quote: "${snippet}"`);
    }
  }

  return { passed: warnings.length === 0, warnings };
}
