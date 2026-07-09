# PS Claude kickoff — Slice E1 (finance-first brief, proven locally)

> Paste this to PS Claude (PowerShell, project root). Self-contained.

```
ROLE: Implementation session for ForgeMinds slice E1 (finance-first brief, proven LOCALLY). Model: Sonnet.
Read FIRST: docs/architecture/v1-execution-plan-2026-07-08.md (E1 + Global Constraints),
docs/architecture/forgeminds-v1-finance-core.md (Layer-1/Layer-2 boundary, §4),
docs/reviews/2026-07-08-honest-audit.md (root cause). Dev Supabase ymgbjtgczgnooscigplb
ONLY; NEVER read .env (keys by name). Build ONE slice, then STOP; do not start E2.

GOAL: a generated brief is genuinely finance-first for test user 3707759d — his tickers/topics lead, ZERO
generic world news (the "Antarctica/lupus/Epstein test": the 06-14 brief was half generic for a finance user;
that must not happen). Do NOT deploy/cut over (that's E6). Prove LOCALLY.

THE 3 FIXES (additive; audit-proven root cause):
1. src/lib/pipeline/curator.ts — curateStories() picks "best from EVERY category," blind to the user (~L17-47).
   Change it to RECEIVE topics[] + excluded_topics[], DROP articles whose category is excluded, rank within
   finance-relevant categories. This is THE bug serving a finance user Antarctica/lupus.
2. Add a HARD relevance-score floor at curation (separate from the 0.45 COMPOSITE floor — relevance is only 45%).
   Make it a user_preferences column (Layer-2 config), finance default. Low-finance-relevance items get no seat.
3. Scope the user's sources: remove generic world feeds (bbci.co.uk/news/world, theguardian.com/world), keep
   Fed/ECB/markets/econ. Use supabase/seeds/source_catalog/finance/markets.sql. DATA change (Layer-2), not L1 code.

CONSTRAINTS: Layer-1 (scorer/generate/router) stays finance-AGNOSTIC. Don't touch the 47 empty tables.
tsc 0, lint 0. Avoid done/complete/finished/ship/deploy in commit subjects (pre-commit hook blocks them).

VERIFY LOCALLY (npm run dev, trigger score->curate->generate):
  select brief_date, generation_model, (summary_html is not null) has_html,
         array_length(ticker_symbols,1) n_tickers from briefs order by brief_date desc limit 1;
Read summary_html end-to-end: finance-first, his tickers/topics leading, zero generic news. If it still leaks,
iterate on 1-3 before declaring done. STOP + report: files changed, the brief's story headlines, pass/fail on
the Antarctica test, query output. Founder reads it + judges vs Pipedream before E2.
```
