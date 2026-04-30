# Phase 1 — Pipeline: Definition of Done Checklist

> **Status:** PLACEHOLDER. Fill in Phase 1 feature gates as the phase begins.
> Until then, this file exists only to remind future sessions that Phase 1
> requires the same mechanical gate as Phase 0.

## Mandatory automated gates (same as every phase)

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run verify:db` — all migrations applied
- [ ] `npm run verify:columns` — zero schema-drift mismatches
- [ ] `npm run verify:rls` — every public table has RLS + policy
- [ ] `npm run verify:honest-strings` — zero fake data
- [ ] `npm run verify:env-vars` — Phase 1 required vars wired
- [ ] `npx playwright test` — Phase 1 flows green

## Phase 1 feature gates (TBD — fill when phase starts)

- [ ] _RSS ingest cron writes `raw_articles` rows from real feeds_
- [ ] _Gemini scoring cron writes `scored_articles` with composite_score > 0_
- [ ] _Curation cron writes a `briefs` row for the day_
- [ ] _Dashboard renders curated articles with real titles, URLs, timestamps_
- [ ] _Reddit OAuth wired (Phase 1 social integration)_

## AUDIT GATE block (paste from `npm run verify:phase-1` output when it exists)

```
(empty until phase-1 verifier exists and passes)
```
