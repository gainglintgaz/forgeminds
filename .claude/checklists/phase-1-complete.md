# Phase 1 — Pipeline End-to-End: Definition of Done Checklist

> **Status:** IN PROGRESS. This file is the mechanical proof gate for Phase 1.
> Until every box below is checked AND an `AUDIT GATE [phase-1]` block from
> `npm run verify:phase-1` is pasted at the bottom, no commit may use
> "done|complete|finished|ship|deploy" wording for Phase 1. The pre-commit
> hook enforces this.

## Goal

ForgeMinds replaces Pipedream for Victor: real RSS feeds → AI scoring → curated brief → enriched ticker data → AI-generated summary → email delivered. Pipeline runs autonomously via pg_cron.

## Mandatory automated gates (each is enforced by `verify:phase-1`)

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run verify:db` — all migrations applied (8 expected after pg_cron migration ships)
- [ ] `npm run verify:columns` — zero schema-drift mismatches
- [ ] `npm run verify:rls` — every public table has RLS enabled with at least one policy
- [ ] `npm run verify:honest-strings` — zero fake/placeholder/mock data in `src/`
- [ ] `npm run verify:env-vars` — Phase 1 required vars wired (adds `RESEND_API_KEY`, `RESEND_FROM_EMAIL` to required list)
- [ ] `npm run verify:cron-routes` — all 6 cron endpoints (`/api/cron/{ingest,score,curate,enrich,generate,deliver}`) respond 200 with valid CRON_SECRET
- [ ] `npm run verify:pipeline-flow` — at least 1 row in each of `raw_articles`, `scored_articles`, `briefs` from last 24h (proves end-to-end run)
- [ ] `npx playwright test` — all Phase 0 specs still green + new `briefs.spec.ts` (renders today's brief, navigates to detail, verifies content)

## Phase 1 feature gates

### Cron routes (3 new + 3 from Phase 0)
- [ ] **`/api/cron/enrich`** — pulls top tickers from today's curated articles, fetches Finnhub `/quote`, upserts `ticker_data` keyed by `(user_id, symbol, fetched_date)`
- [ ] **`/api/cron/generate`** — for today's curated articles, calls Gemini Flash to write `briefs.summary_html` and `briefs.summary_text`
- [ ] **`/api/cron/deliver`** — reads undelivered briefs, sends via Resend with React Email template, marks `is_delivered=true`, writes `delivery_log` row
- [ ] All 6 cron routes guard with `Authorization: Bearer ${CRON_SECRET}` (existing pattern)
- [ ] All 6 routes write `pipeline_runs` row with canonical column names (`step_name`, `duration_ms`, `items_processed`, `items_created`, `items_failed`)

### Scheduling
- [ ] **`supabase/migrations/20260501000000_pg_cron_schedules.sql`** applied to dev DB
- [ ] Schedule: ingest @ */30 min M-F 11:00-23:00 UTC; score +5 min; curate +10 min; enrich +15 min; generate +20 min; deliver +25 min
- [ ] Uses `pg_net.http_post` with `Authorization: Bearer ${CRON_SECRET}` header
- [ ] Cron job names follow convention `forgeminds_<step>_<freq>` for visibility in `cron.job` table

### UI
- [ ] **`/(dashboard)/briefs/page.tsx`** — list of briefs, sorted by `brief_date` desc, shows `title`, `article_count`, `categories_covered`, `is_delivered` indicator
- [ ] **`/(dashboard)/briefs/[id]/page.tsx`** — single brief view: rendered `summary_html`, list of articles via `article_ids` lookup, ticker badges from `ticker_symbols`
- [ ] Sidebar navigation includes "Briefs" entry; mobile-nav too
- [ ] Empty state when no briefs yet (Phase 0 DMG Level 0 pattern)

### Email
- [ ] **`src/lib/email/templates/daily-brief.tsx`** — React Email template; renders title, intro paragraph, top 5 articles with sources, "View full brief" CTA
- [ ] Test email to Victor's Gmail receives correctly (real arrival, not just 200 from Resend API)
- [ ] `delivery_log` row written per send with `status='sent'` and provider message ID
- [ ] No PII or secrets leak into email subject or body (privacy.md compliance)

### Data
- [ ] **`tool_capabilities` seed SQL applied** — verifies via `select count(*) from tool_capabilities` returns >0
- [ ] **Real RSS feeds seeded** in `sources` table — extracted from Victor's existing Pipedream config (system user, type='rss', is_active=true)
- [ ] First full pipeline run completed manually via `curl` triggers; rows present in raw_articles → scored_articles → briefs
- [ ] At least one delivered brief landed in Victor's inbox

### Side-by-side comparison vs Pipedream
- [ ] Both pipelines run for 5 consecutive days
- [ ] Article count parity: ForgeMinds within ±10% of Pipedream daily count
- [ ] Quality check: ForgeMinds top-10 articles overlap ≥70% with Pipedream's curated set
- [ ] No false positives in ticker enrichment (verify a sample of 10 enriched briefs)
- [ ] Pipedream subscription canceled ($30/mo savings), date logged in DECISIONS.md

## Architecture state captured

- [ ] `CURRENT_SPRINT.md` updated with Phase 1 completion percentage (truthful, not optimistic)
- [ ] `DECISIONS.md` appends "2026-XX-XX: Phase 1 complete — Pipedream canceled, ForgeMinds source of truth"
- [ ] If new schema canonical names emerged, `ARCHITECTURE_NOTES.md` Schema Canonical Names Reference updated

## AUDIT GATE block (paste from `npm run verify:phase-1` output)

```
(empty until verify:phase-1 produces a passing block — at minimum requires
all 6 cron routes implemented, pg_cron migration applied, real pipeline run,
and Resend email delivered)
```

> **Reminder.** Phase 1 is not done until every box above is checked AND a
> real AUDIT GATE block (not the empty placeholder) lives at the bottom of
> this file. The pre-commit hook reads this file before allowing any
> "done|complete|finished" commit on Phase 1. See `.claude/CLAUDE.md`
> "🔴 PHASE COMPLETION ENFORCEMENT" section for the rationale.
