/**
 * Central registry of AI model pins + cost constants.
 *
 * Why:
 *   - Single source of truth so retirements (xAI grok-3 family on
 *     2026-05-15, etc) update one file instead of five providers.
 *   - Env-var overrides on every chat/synthesis model so emergency
 *     rollbacks don't require a redeploy — set `GROK_MODEL` in
 *     Vercel and the next request uses it.
 *   - `<modelname>-latest` aliases (per xAI docs) auto-pick up new
 *     minor versions without code changes.
 *   - Embeddings are deliberately NOT overridable: the column type
 *     `vector(1536)` is a column-level commitment. Changing the
 *     embedding model means re-embedding every row in
 *     source_catalog (and any future vector column). Coordinated
 *     migration only.
 *
 * Update procedure:
 *   1. Edit a default below.
 *   2. Update the matching cost constant in COSTS if pricing changed.
 *   3. `npx tsc --noEmit && npm run lint && npm run dev` — smoke test
 *      a real chat / brief / onboarding turn before committing.
 *   4. Commit `chore(ai): bump <model> from X to Y — <reason>`.
 *
 * Emergency rollback (no redeploy):
 *   - Set the matching env var in Vercel; takes effect on next cold
 *     start (or use `vercel env pull` + restart for local).
 *   - `costEstimateUsd` in audit logs will drift from actual billing
 *     until the COSTS constant is also updated. Acceptable short-term;
 *     reconcile on next deploy.
 *
 * Last reviewed: 2026-05-06.
 */

export const MODELS = {
  /**
   * xAI Grok — generate-social task per router.ts.
   *
   * 2026-05-15 retirement: grok-3, grok-3-mini-fast (implicitly part
   * of the grok-3 family), grok-4-fast-*, grok-4-1-fast-*,
   * grok-code-fast-1. Migrating to grok-4.3-latest pre-deadline.
   *
   * `-latest` alias auto-rolls when xAI promotes a new stable
   * release. Pin to a dated version (`grok-4.3-2026MMDD`) only if
   * a regression appears in a new release.
   */
  GROK: process.env.GROK_MODEL ?? "grok-4.3-latest",

  /**
   * Google Gemini — score / categorize tasks (bulk, low-cost).
   *
   * 2026-05-31 BUG FIX: gemini-2.0-flash now returns 404 "no longer
   * available to new users" — the score/categorize pipeline was dead
   * for any new Gemini key. Confirmed via A/B smoke test (see
   * docs/decisions/2026-05-31-ai-model-ab.md). Bumped to gemini-2.5-flash,
   * which passed the smoke test + produced clean, fabrication-free briefs.
   *
   * NOTE: COSTS.GEMINI_* below still reflect 2.0-flash pricing
   * ($0.075/$0.30). 2.5-flash pricing not yet provider-verified; cost
   * logging will drift until reconciled (acceptable short-term per the
   * header's emergency-rollback note). Reconcile when confirmed.
   */
  GEMINI_FAST: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",

  /**
   * Anthropic Claude Sonnet — onboarding agent, brief synthesis,
   * deep analysis, voice DNA. Bumped from claude-sonnet-4-20250514
   * (stale May 2025) to claude-sonnet-4-6 (current per global
   * VictorForge CLAUDE.md).
   *
   * Anthropic does not publish a `-latest` alias yet; bump
   * version strings at each Sonnet release. Sonnet 4.6 → 4.7 (Opus
   * 4.7's matching Sonnet) when it ships.
   */
  CLAUDE_SONNET: process.env.CLAUDE_SONNET_MODEL ?? "claude-sonnet-4-6",

  /**
   * Anthropic Claude Haiku — fallback chain target, fast cheap
   * synthesis. Current: 4.5.
   */
  CLAUDE_HAIKU: process.env.CLAUDE_HAIKU_MODEL ?? "claude-haiku-4-5",

  /**
   * Perplexity Sonar — research task with live-web grounding.
   */
  PERPLEXITY: process.env.PERPLEXITY_MODEL ?? "sonar",

  /**
   * Perplexity Sonar Pro — deeper research, more citations.
   */
  PERPLEXITY_PRO: process.env.PERPLEXITY_PRO_MODEL ?? "sonar-pro",

  /**
   * OpenAI text-embedding-3-small — vector(1536) column commitment.
   * NEVER override via env. Changing this requires re-embedding
   * every row in source_catalog (and any future vector column).
   * Coordinated migration only.
   */
  OPENAI_EMBED: "text-embedding-3-small",
} as const;

/**
 * Embedding column dimension. Tied to MODELS.OPENAI_EMBED.
 * Changing this requires `ALTER TABLE source_catalog ALTER COLUMN
 * embedding TYPE vector(<new>)` plus re-embedding every row.
 */
export const EMBED_DIMENSIONS = 1536;

/**
 * Cost constants. USD per 1M tokens unless noted.
 *
 * Synced with provider docs as of 2026-05-06. When you change a
 * model in MODELS above, recheck the matching cost here — pricing
 * changes between model versions.
 */
export const COSTS = {
  // xAI grok-4.3: $1.25 in / $2.50 out per 1M.
  // Was $0.30 / $0.50 on grok-3-mini-fast (~4x cost increase post-migration).
  GROK_INPUT_PER_M: 1.25,
  GROK_OUTPUT_PER_M: 2.5,

  // Google gemini-2.0-flash.
  GEMINI_INPUT_PER_M: 0.075,
  GEMINI_OUTPUT_PER_M: 0.3,

  // Anthropic claude-sonnet-4-6.
  SONNET_INPUT_PER_M: 3.0,
  SONNET_OUTPUT_PER_M: 15.0,

  // Anthropic claude-haiku-4-5.
  HAIKU_INPUT_PER_M: 0.8,
  HAIKU_OUTPUT_PER_M: 4.0,

  // Anthropic prompt cache: 10% of input price for cache reads,
  // 125% for cache writes (one-time per cache miss).
  CACHE_READ_MULTIPLIER: 0.1,
  CACHE_WRITE_MULTIPLIER: 1.25,

  // OpenAI text-embedding-3-small.
  OPENAI_EMBED_PER_M: 0.02,

  // Perplexity sonar — token + per-search.
  PERPLEXITY_INPUT_PER_M: 1.0,
  PERPLEXITY_OUTPUT_PER_M: 1.0,
  PERPLEXITY_SEARCH_PER_K: 5.0,

  // Perplexity sonar-pro.
  PERPLEXITY_PRO_INPUT_PER_M: 3.0,
  PERPLEXITY_PRO_OUTPUT_PER_M: 15.0,
  PERPLEXITY_PRO_SEARCH_PER_K: 5.0,
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];
