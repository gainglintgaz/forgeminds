# PS Claude kickoff — Slice E2 (tickers + market data woven into stories, proven locally)

> Paste to PS Claude (PowerShell, project root). Build session — E2 is an already-approved slice of
> docs/architecture/v1-execution-plan-2026-07-08.md; no new probe needed.
> PREREQUISITE: founder has read the 2026-07-09 E1 brief and judged it vs Pipedream, and the E1
> working-tree changes are committed. Do not start E2 on a dirty tree.

```
ROLE: Implementation session for ForgeMinds slice E2 (WF1 completeness: tickers + market data woven
into stories, proven LOCALLY). Model: Sonnet.
Read FIRST: docs/architecture/v1-execution-plan-2026-07-08.md (E2 + Global Constraints),
docs/architecture/forgeminds-v1-finance-core.md §4 (forward flow, strict resolution).
Dev Supabase ymgbjtgczgnooscigplb ONLY; NEVER read .env* (keys by name). Build ONE slice, then STOP;
do not start E3.

GOAL: curated stories carry resolved tickers and the brief weaves real per-story market data.
Evidence of the gap (2026-07-09 local E1 run): the generated brief was finance-first BUT
briefs.ticker_symbols = NULL and every curated story's scored_articles.tickers = [] — the watchlist
market data got woven in via enrich, while STORY-level ticker extraction fired on ~0 articles.
E1 context you inherit: curator now enforces a relevance floor + excluded categories; scorer strips
```json fences before parse (that fix is what made scoring work at all).

THE WORK (per plan E2, all 🤖):
1. src/lib/pipeline/scorer.ts — make ticker extraction fire broadly: the prompt already asks for
   tickers[]; diagnose why real finance articles (Bloomberg/WSJ/Yahoo feeds are now active for the
   test user) come back with empty tickers, and fix (prompt emphasis, examples, or extraction from
   title+summary). Resolve ONLY to existing/created entity UUIDs via resolveOrCreateTickersBatch —
   never invent (ERR-021).
2. src/app/api/cron/curate/route.ts — briefs.ticker_symbols already aggregates curated stories'
   tickers ∪ nothing; extend to union the user's tracked_tickers watchlist per the plan.
3. src/app/api/cron/generate/route.ts — ensure the real ticker_data (price/change/52w/PE +
   interpretation) is woven into the STORY prose for stories with resolved tickers, not only the
   market-snapshot section. Substring anti-fabrication gate (brief-validation.ts) stays mandatory.

KNOWN HAZARD: the stale Cloudflare-host pg_cron dispatcher still writes legacy
diversity_category='core' rows (flat 0.500 scores) into this dev DB ~every 30 min. Current code
cannot produce 'core'. For local verification, filter your queries to diversity_category != 'core'
OR clean today's 'core' rows for user 3707759d first (founder approved that exact cleanup on
2026-07-09). Do NOT chase them as a bug — host cutover is E6.

CONSTRAINTS: Layer-1 stays finance-AGNOSTIC (ticker extraction is generic entity extraction; the
finance meaning lives in enrich). Don't touch the 47 empty tables. tsc 0, lint 0. Avoid
done/complete/finished/ship/deploy in commit subjects (pre-commit hook blocks them).

VERIFY LOCALLY (npm run dev; trigger ingest→score→curate→generate for user 3707759d via
Authorization: Bearer $CRON_SECRET — read the secret by NAME from env, never print it):
  select brief_date, generation_model, array_length(ticker_symbols,1) n_tickers
  from briefs where user_id='3707759d-9863-4f69-a6d8-f40036fa15f1'
  order by brief_date desc limit 1;                       -- n_tickers > 0
  select count(*) from scored_articles
  where user_id='3707759d-9863-4f69-a6d8-f40036fa15f1'
    and array_length(tickers,1) > 0
    and created_at > now()-interval '24 hours';           -- many, not 0-1
Read the brief's summary_text end-to-end: stories about specific companies carry their real price/
change data inline. STOP + report: files changed, the two query outputs, 2-3 story excerpts showing
woven market data, pass/fail. Founder reads it + judges vs Pipedream before E3.
```
