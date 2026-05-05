# Phase 1.5 — AI-Assisted Source Discovery: Definition of Done

> **Status:** IN PROGRESS. This file is the mechanical proof gate for Phase 1.5.
> Until every box below is checked AND an `AUDIT GATE [phase-1-5]` block from
> `npm run verify:phase-1-5` is pasted at the bottom, no commit may use
> "done|complete|finished|ship|deploy" wording for Phase 1.5. The pre-commit
> hook enforces this.

## Goal

A new user signs up, lands on `/onboarding/intake`, types a free-form description of what they care about, and within 60 seconds has 8-12 catalog-curated sources flowing into their personal pipeline — without ever pasting a single RSS URL.

This is the implementation of VIBE Rule 56 (AI-Assisted Discovery Over User Configuration) and Factory CLAUDE.md §4 #18.

## Mandatory automated gates

Run by `npm run verify:phase-1-5`. Each must exit 0.

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run lint` clean
- [ ] `npm run verify:db` — all migrations applied including `20260510000000_source_catalog.sql` and `20260510000001_source_suggestions.sql`
- [ ] `npm run verify:columns` — zero schema-drift mismatches; pending-migration allowlist empty (no remaining tables in `PENDING_MIGRATION_TABLES`)
- [ ] `npm run verify:rls` — `source_catalog` is public-read, `source_suggestions` is own-data
- [ ] `npm run verify:honest-strings` — no fake/placeholder data in onboarding or sources surfaces
- [ ] `npm run verify:env-vars` — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `PERPLEXITY_API_KEY` wired
- [ ] `npm run verify:cron-routes` — all 6 cron endpoints still respond 200
- [ ] `npm run verify:cron-empty-handling` — clean responses for zero-source users
- [ ] `npm run verify:source-catalog` — ≥200 active rows, ≥10 distinct categories, median quality ≥0.65, ≥50% free/freemium, ≥95% with embeddings
- [ ] `npx playwright test` — Phase 0/1 specs green + new `e2e/onboarding.spec.ts` (auth gate + 401 on unauth API calls)

## Phase 1.5 feature gates

### Schema (file-only → applied)
- [ ] **`20260510000000_source_catalog.sql`** applied to dev DB
- [ ] **`20260510000001_source_suggestions.sql`** applied to dev DB
- [ ] **`source_catalog_rag_rpc.sql`** applied — `match_source_catalog(query_embedding, match_count, allowed_tiers, allowed_geographies)` exists with SECURITY DEFINER + pinned search_path
- [ ] EXECUTE on `match_source_catalog` granted to authenticated + service_role; revoked from anon
- [ ] No new advisor warnings post-apply (run Supabase Advisor → Security tab; should still be at the 4 accepted carry-overs from Phase 1 close)

### Catalog seed
- [ ] **≥200 active rows** in `source_catalog` (curator-verified URLs only — no hallucinations)
- [ ] **≥10 categories** represented (medicine, finance, tech, sciences, geopolitics, education, arts, lifestyle, sports, civic — minimum)
- [ ] **≥3 subcategories per category** with non-zero rows
- [ ] **≥30% non-RSS source types** (Reddit, X, podcast RSS, JSON APIs)
- [ ] **Paywall mix:** ~70% free, ~15% freemium, ~10% paid, ~5% byos (within ±10% bands)
- [ ] **Geography mix:** ≥60% global/us; rest distributed eu/cn/in/lang-codes
- [ ] **Quality distribution:** median ≥0.65, P90 ≥0.85
- [ ] **Embedding coverage:** ≥95% of rows have non-null `embedding` (run `npx tsx scripts/embed-source-catalog.ts` after every seed batch)
- [ ] Curator subagent dispatched for each (category, subcategory) pair logged the rejected sources with reason in the seed-file commit messages (audit trail)

### Conversational onboarding agent
- [ ] **`/onboarding/intake`** renders a single textarea, requires ≥30 chars before submit
- [ ] Submit POSTs to `/api/onboarding/chat` which:
  - Auth-gates (anon → 401)
  - Calls `extractIntent` (Claude Haiku, JSON mode)
  - Calls `proposeSources` (catalog RAG → Sonnet picks)
  - Persists results to `source_suggestions` (status='pending')
  - Returns proposals to client
- [ ] **`/onboarding/refine`** loads pending suggestions for the current user, shows toggle + per-source `reason` + paywall cost
- [ ] **`/onboarding/confirm`** shows final summary + Start button → POSTs `/api/onboarding/finalize`
- [ ] **`/api/onboarding/finalize`** is idempotent (double-submit produces same `sourceIds` count, no duplicate `sources` rows)
- [ ] Cost guardrail: each onboarding run logs total `costEstimateUsd`, alerts if >$0.10
- [ ] Anthropic prompt caching active for the catalog JSON (~50K tokens cached, ~10% billed on repeat reads)

### Source-validator runtime
- [ ] **`src/lib/onboarding/source-validator.ts`** rejects:
  - Malformed URLs (`not-a-url`, `ftp://...`)
  - 4xx/5xx responses
  - HTML pages without RSS link
  - XML that parses but has 0 items
  - JSON that doesn't have items at top-level or known keys
  - URLs >2 MB body
- [ ] Returns `valid: true` only with ≥1 extractable title
- [ ] Recency check warns on >30-day-old, suspicious-flags >90-day-old feeds
- [ ] **`/api/onboarding/validate-source`** auth-gated, applies `validateSource()` to user input

### AI providers
- [ ] **`callClaude`** with prompt caching wired into onboarding agent
- [ ] **`embedText` / `embedBatch`** used by catalog-rag + embed-source-catalog backfill
- [ ] **`callPerplexity`** ready for source-validator subagent fallback (optional in Phase 1.5; required in Phase 9 deep-research)
- [ ] Router `TASK_MODEL_MAP` and `FALLBACK_CHAIN` updated; `embed` task throws with redirect-to-`embedText` message

### UI redesign for /sources
- [ ] **`/(dashboard)/sources`** redesigned with three sections:
  1. **CatalogBrowser** — search + filter the source catalog by category, paywall, geography
  2. **SuggestionsPanel** — pending source_suggestions for the current user; accept/dismiss inline
  3. **SourceHealth** — list of user's active sources with last-fetched + dead-feed warnings (drives the source-advisor cron)
- [ ] "Add custom URL" form lives at the BOTTOM of the page as a power-user fallback (per VIBE Rule 56: form is fallback, agent is primary)
- [ ] Custom URL submit calls `/api/onboarding/validate-source` first; only adds to `sources` if `valid: true`

### Cost cap audit
- [ ] At least 5 simulated onboarding runs logged from a test user; mean cost <$0.06, max cost <$0.10
- [ ] Cost overage triggers `console.warn` (no silent overspend)
- [ ] Catalog RAG embedding cost ≤$0.0002 per onboarding run (1 query × ~150 tokens × $0.02/1M)

### Documentation
- [ ] `CURRENT_SPRINT.md` reflects Phase 1.5 truthfully (not "almost done" claims)
- [ ] `DECISIONS.md` records the AI-assisted-discovery pivot (already done 2026-05-04)
- [ ] `ARCHITECTURE_NOTES.md` documents the catalog-RAG flow + RPC contract
- [ ] `IDEAS.md` captures any followups discovered during Phase 1.5 work

## After all gates pass

Paste the AUDIT GATE block from `npm run verify:phase-1-5` here:

```
AUDIT GATE [phase-1-5]
✓ tsc --noEmit                 — pass
✓ lint                         — pass
✓ verify:db                    — pass
✓ verify:columns               — pass
✓ verify:rls                   — pass
✓ verify:honest-strings        — pass
✓ verify:env-vars              — pass
✓ verify:cron-routes           — pass
✓ verify:cron-empty-handling   — pass
✓ verify:source-catalog        — pass
✓ playwright e2e               — pass
verified-at: <ISO timestamp>
```

Then commit with subject `feat: phase 1.5 complete` + the AUDIT GATE block in the body.
