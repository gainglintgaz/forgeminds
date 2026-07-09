# Changelog

## 2026-07-03
- feat(ui): add /saved page + Saved nav (review C-5) [no-arch: review-specified slice; reads existing article_outcomes, no new entity/schema] (664265d)
- fix(ui): kill dead UI — drop Soon nav stubs + collapse dismissed cards (review U-2/U-6) (3765858)
- perf(rls): wrap auth.*() in RLS policies to fix auth_rls_initplan (review C-7) (144c530)
- fix(pipeline): mark sources.last_fetched_at on successful ingest (review C-4 / ERR-025) (8f26356)
- fix(security): sanitize AI-generated brief HTML before persist (review C-6) (f8f77e2)
- docs(ops): reconcile handoff to live truth + lock Vercel host decision (supersede Railway) (41e52db)
- fix(security): revoke anon+authenticated EXECUTE on forgeminds_pg_cron_stats (review C-3) (0fba664)

## 2026-07-02
- feat(pipeline): substring-validation anti-fabrication gate on generate [no-arch: scoped slice per handoff spec; no new entity/schema] (d46cac0)
- docs(brief): key registry -- Anthropic powers whole core loop; Gemini retired (c1376b6)
- feat(ai): consolidate core loop on Anthropic -- drop Gemini (score->Haiku) (b8ff95d)

## 2026-07-01
- docs(state): log ERR-029; rewrite sprint/handoff to live-DB truth; key registry + backlog captures (1b7700f)
- fix(pipeline): fail loud on zero AI calls -- dead key can no longer pose as a green run (ERR-029) (654113d)

## 2026-06-15
- docs(v1): S3.1 status — unattended-execution hardening done; Railway deploy pending (founder) (d6fa974)
- feat(ops): pg_cron stale-running sweep + Railway cutover runbook (8ae95a9)
- feat(pipeline): unattended-execution hardening — batch score (N+1) + curate consistency invariant (3a208ce)
- docs(v1): mark S3 done pending review — ticker resolution + market data + NL read (8a1610d)
- feat(pipeline): weave ticker data + market read into the brief (c464a43)
- feat(pipeline): market-data enrichment + NL market read (Finnhub/CoinGecko/Alpaca) (fd0a83c)
- feat(pipeline): strict ticker/entity resolution (extract + resolveOrCreate + aggregate) (abb0648)
- docs(v1): add ERR-027 (gemini thinking-model output starvation) (4ddf000)

## 2026-06-14
- docs(v1): mark S2 done pending review — resolution + personalization + dedup proven (aae58ce)
- feat(pipeline): cross-brief dedup in curate (ERR-024) (498fef2)
- feat(pipeline): strict category resolution + per-user relevance scoring (ERR-020/021) (3025e82)
- docs(v1): correct ERR-019 root cause (telemetry-gap+clobber) + add lesson 111 (ddf8b27)
- docs(v1): mark S1 done pending review — AI fires + telemetry gate proven (a88b1a9)
- feat(pipeline): AI telemetry gate -- record ai_calls_made/ai_tokens_used + fail-loud watchdog + ops metric (3af7400)
- feat(pipeline): stop curate clobbering generate's AI label (ERR-019 seam fix) (fce39ef)
- docs(v1): approved finance-core ARCHITECTURE + lessons/decisions from drawing-board reset (7e01088)

## 2026-06-13
- feat(actions): configurable + source-traceable Save/Analyze/Draft/Act + editable Settings (Phase 1) (2e19ad1)
- fix(email): 23505 sent-row = already-sent + land Phase-1 ops docs [E1] (841ab66)

## 2026-06-10
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)
- fix(cron): dispatch via net.http_get to match GET-only cron routes (was POST G�� 405) [migration parity with live DB]
- fix(deploy): force webpack build in open-next config G�� Turbopack server chunks fail at runtime on Cloudflare Workers (ChunkLoadError on every route)

## 2026-05-15
- wip(phase-1-5): career/job_search seed (11 sources) + un-park + doc corrections

# Changelog

## 2026-04-13
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit
- feat: initial commit




































