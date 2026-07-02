/**
 * brief-validation.ts — server-side substring anti-fabrication gate for generated briefs.
 *
 * The generate route grounds the model ONLY via the prompt ("paraphrase, never invent
 * prices/names/dates"). Prompt instructions are not a guarantee. `ai-first-principles.md` §5
 * (anti-fabrication) and `two-way-traceability.md` Pattern 3 require that every AI numeric claim
 * be verifiable against the real source it was grounded on. This module is that guarantee, and it
 * is model-agnostic: it extracts every NUMBER and TICKER-shaped token from the model's synthesis
 * and confirms each is present — whitespace/case-normalized — in the allowed source set (the
 * hydrated articles' title+summary PLUS the real market-data numbers the model was handed). A claim
 * that isn't grounded is "unvalidated".
 *
 * V1 SCOPE (deliberately narrow — tuned against real dev-DB briefs to avoid false positives that
 * would wrongly block a clean brief):
 *   - NUMBERS: only prices ($-prefixed), percentages (%-suffixed), and decimal figures are grounded.
 *     Bare integers and years are NOT checked — they carry low fabrication harm and, in practice,
 *     are drawn from article bodies the model was never given (title+summary only), so checking them
 *     produces false positives without catching real financial fabrication.
 *   - TICKERS: only CASHTAGS ($AAPL) are validated. A cashtag is an unambiguous, deliberate ticker
 *     claim. Bare all-caps prose words (UK, ETF, SEC, LA, GDP…) are NOT treated as ticker claims —
 *     they are common acronyms, not stock symbols, and flagging them wrongly rejected a real brief.
 *
 * DEFERRED (V2): full-claim NLI validation (does the whole sentence entail from the source, not just
 * its tokens); a ticker-universe lookup so bare (non-cashtag) symbols can be validated without the
 * acronym false-positive problem; validating `summary_html`/`headline` (they mirror `summary_text`
 * per the prompt contract). Known V1 edge: a figure the model renders with MORE precision than the
 * source ("3.2" → "3.25") is flagged — the caller's one stricter regeneration is the safety valve.
 */

export interface BriefValidationResult {
  /** true when nothing ungrounded was found (claimsUnvalidated === 0). */
  ok: boolean;
  /** how many number + ticker claims were checked (occurrences for numbers, distinct for tickers). */
  claimsChecked: number;
  /** how many checks failed grounding. */
  claimsUnvalidated: number;
  /** distinct offending raw tokens, each truncated, capped for safe logging. */
  offendingTokens: string[];
}

const MAX_OFFENDERS = 10;
const OFFENDER_MAXLEN = 40;

// A number-bearing token: optional `$`, a leading digit, digits/commas, optional
// decimal, optional trailing `%`. Linear (no nested quantifiers over overlapping
// classes) — safe against catastrophic backtracking.
const NUMBER_TOKEN_RE = /\$?\d[\d,]*(?:\.\d+)?%?/g;

// Cashtag ($AAPL — a letter, not a digit, follows the `$` so currency amounts are
// excluded) is the only ticker-shaped surface we validate (see module note: bare
// all-caps prose words are ambiguous acronyms, not ticker claims).
const CASHTAG_RE = /\$([A-Za-z]{1,5})\b/g;
// Any short alpha word in the SOURCE is allowed as a ticker-shaped token — this is
// what lets a cashtag grounded in the source (or the resolved ticker set) pass,
// while a cashtag that appears nowhere is caught.
const SOURCE_WORD_RE = /\b[A-Za-z]{1,5}\b/g;

/** Strip `$`, `%`, commas, and whitespace to the bare numeric core. */
function normalizeNumber(raw: string): string {
  return raw.replace(/[$,%\s]/g, "");
}

/**
 * Which numeric tokens are worth grounding. High-risk = prices ($), percentages
 * (%), or specific decimal figures. Bare integers and years ("2019", "358", "12")
 * are NOT checked — low fabrication harm and, in real briefs, drawn from article
 * bodies the model wasn't given, so checking them only produces false positives.
 */
function isHighRiskNumber(raw: string, core: string): boolean {
  return raw.includes("$") || raw.includes("%") || core.includes(".");
}

/** briefTickers ∪ every short alpha word present in the source, upper-cased. */
function buildAllowedTickerSet(sourceText: string, allowedTickers: string[]): Set<string> {
  const set = new Set<string>();
  for (const t of allowedTickers) {
    const u = t.trim().toUpperCase();
    if (u) set.add(u);
  }
  const words = sourceText.match(SOURCE_WORD_RE) ?? [];
  for (const w of words) set.add(w.toUpperCase());
  return set;
}

/** Distinct cashtag ticker claims the model emitted ($AAPL → AAPL). */
function extractTickerClaims(summaryText: string): string[] {
  const claims = new Set<string>();
  let m: RegExpExecArray | null;
  CASHTAG_RE.lastIndex = 0;
  while ((m = CASHTAG_RE.exec(summaryText)) !== null) {
    claims.add(m[1].toUpperCase());
  }
  return Array.from(claims);
}

/**
 * Validate an AI-synthesized brief against the exact source it was grounded on.
 *
 * @param summaryText     the model's plain-text digest (the field we ground).
 * @param sourceText      hydrated articles' title+summary + the rendered MARKET DATA block.
 * @param allowedTickers  the brief's resolved ticker set (brief.ticker_symbols ∪ tracked_tickers).
 */
export function validateBriefSynthesis(
  summaryText: string,
  sourceText: string,
  allowedTickers: string[]
): BriefValidationResult {
  let checked = 0;
  let unvalidated = 0;
  const offenders: string[] = [];
  const offenderSeen = new Set<string>();

  function recordOffender(raw: string) {
    unvalidated++;
    const key = raw.slice(0, OFFENDER_MAXLEN);
    if (offenderSeen.has(key)) return;
    offenderSeen.add(key);
    if (offenders.length < MAX_OFFENDERS) offenders.push(key);
  }

  // ── numbers: case-irrelevant; normalize away thousands separators on both sides
  //    so "$95,400" (source) grounds "95400" (claim core) via substring. ──────────
  const numCorpus = sourceText.replace(/,/g, "");
  const numberTokens = summaryText.match(NUMBER_TOKEN_RE) ?? [];
  for (const raw of numberTokens) {
    const core = normalizeNumber(raw);
    if (!core) continue;
    if (!isHighRiskNumber(raw, core)) continue;
    checked++;
    if (!numCorpus.includes(core)) recordOffender(raw);
  }

  // ── tickers: only cashtags ($AAPL). Each is valid if it's in the resolved ticker
  //    set OR appears as a whole word in the source (word-token match, not raw
  //    substring, so "$SEC" can't ground on "second"). ──────────────────────────
  const allowed = buildAllowedTickerSet(sourceText, allowedTickers);
  for (const claim of extractTickerClaims(summaryText)) {
    checked++;
    if (!allowed.has(claim)) recordOffender(claim);
  }

  return {
    ok: unvalidated === 0,
    claimsChecked: checked,
    claimsUnvalidated: unvalidated,
    offendingTokens: offenders,
  };
}
