# ForgeMinds — Session Handoff / Pickup Doc

> **Last updated:** 2026-07-09 (doc-sweep session) — E1/E2 landed + proven locally. **THIS BLOCK SUPERSEDES the 2026-07-03 status below — read that one as history.**
>
> **Where we are (2026-07-09):** the active path is `docs/architecture/v1-execution-plan-2026-07-08.md` (E-slices; supersedes the S-slices).
> - **E1 DONE + proven locally** (commit `1123f8b`): curation reads the interest graph, hard per-user `min_relevance_score` floor, finance-scoped sources, and the root-cause **JSON-fence-strip parse fix** in `scorer.ts` (every score batch had been silently failing on ```json fences — no article had ever gotten a real personalized relevance score locally). Local run: fully finance-first brief, zero generic-news leak, real Claude calls.
> - **E2 DONE + proven locally** (commit `a8f31d2`): ticker extraction broadened to company names (confidence-gated, strict resolution preserved); `briefs.ticker_symbols` unions the watchlist — `n_tickers` 1→11, 16 articles with tickers in 24h, brief weaves real BTC/ETH + SPY/QQQ prices, anti-fabrication gate passing.
> - **H1 architecture doc committed** (`eb0d09f` → `docs/architecture/curation-hardening-vra.md`) — **PENDING founder "build approved"** on §7 assumptions; no H1 code until then.
> - **I1 (insight layer) architect-probe** is running in a parallel session → `docs/architecture/insight-layer.md` will land; founder approval will be needed. Do not create/edit that file from other sessions.
> - **Founder gates NOT yet passed:** founder has not formally judged the E1/E2 brief vs Pipedream; H1 not approved; **E6 host cutover not done** — the stale Cloudflare dispatcher still runs the pre-fix bundle and writes legacy `diversity_category='core'` rows into dev every ~30 min (known, parked until E6). ERR-028 is fixed-in-code (654113d); ERR-029 stays OPEN until the E6 live-cron proof.
> - **Git:** `master` pushed through `ee886a3`; the 2 newest commits (`a8f31d2`, `eb0d09f`) + this doc-sweep commit await founder-OK push (E0 discipline).
> **Next actions:** 🧑 (1) judge the E1/E2 brief vs Pipedream, (2) approve/reject H1 §7, (3) later I1. 🤖 after approvals: E3 (WF2 outputs) per the plan; H1 build; Tier A causal-why possibly before the E6 dogfood. All work on dev `ymgbjtgczgnooscigplb`; never read `.env*`.
>
> **Last updated (prior):** 2026-07-03 by PS Claude (executor, write-lock held) — live dev-DB re-verification.
>
> **⚠ LIVE STATUS — verified 2026-07-03 against the live dev DB (`ymgbjtgczgnooscigplb`). THIS SUPERSEDES the 2026-07-01 one-line status below — read that one as history.**
> **The AI pipeline is NOT firing. ERR-029 is STILL LIVE (not resolved).** Over the last 72h every step (ingest→score→curate→enrich→generate→deliver) ran ~102× and reports `completed`, but **`ai_calls_made=0` / `ai_tokens=0` on EVERY step, every run** — zero AI calls. Every brief since **2026-06-27** is `generation_model=heuristic` with **`summary_html=NULL`** (empty briefs); the last real AI brief was **2026-06-14** → the dashboard is effectively blank. The **fail-loud guard has fired 0× in 30 days**, which proves the committed fix bundle (fail-loud + Anthropic-only core loop; commits `654113d`, `b8ff95d`, `c1376b6`) is **NOT DEPLOYED — the old silent code is what's live**. `private.app_config.forgeminds_base_url` still points at **Cloudflare Workers** (ERR-026) — the host cutover never happened. A downstream anti-fabrication gate on `generate` (substring-validation of AI numbers/tickers) is committed (`d46cac0`) but is **unverifiable in prod until the AI fires**.
> **THE ONE BLOCKER (founder action) — do these IN ORDER:** (1) pick a working host — Cloudflare is out (ERR-026), Railway lost its free tier, **Vercel Hobby/Fluid Compute runs it at $0 and is Next.js-native (recommended)**; (2) deploy the current committed `master` bundle there; (3) put the live **`ANTHROPIC_API_KEY`** into the host secrets — Gemini was retired in `b8ff95d`, so the core loop is **Anthropic-only** (Haiku scores + Sonnet writes); plus `CRON_SECRET` / Supabase / market-data / email keys; (4) `UPDATE private.app_config SET value='https://<new-host-url>' WHERE key='forgeminds_base_url';`; (5) verify **`ai_calls_made>0`** on score+generate and a fresh brief with `summary_html` + `generation_model=claude-*`. **Then** P7 off-platform backup (there are currently **NO backups** — the dev DB is the only copy) **→** S7 dogfood week (Pipedream OFF 5–7 trading days; rate ForgeMinds ≥ Pipedream +0.5). Nothing downstream (the validation gate, S4/S5) is testable until step 5 is green.
>
> **Last updated (prior):** 2026-07-01 by Desktop Claude (Fable) after a live-DB re-verification + the ERR-029 fail-loud build.
> **Purpose:** self-contained continue-here doc. Any tool (PS Claude, Cursor, Codex, Antigravity) can resume from this file alone.
> **One-line status (SUPERSEDES the 06-15 picture below):** ERR-028's failure loop is NOT reproducing (score 91/91 clean in 72h) — but the live host ran **16 days of silent AI-less briefs** (`ai_calls_made=0` on every score+generate run while reporting `completed`; dead host API keys after the 07-01 key rotation + stale secrets — **ERR-029**). The **fail-loud guard is BUILT** (scorer no-defaults + AI_ZERO_CALL throws + advance-only-persisted + mangled-id telemetry; tsc/lint clean, uncommitted pending write-lock/commit). **Next concrete actions: (1) founder puts the NEW `GEMINI_API_KEY`+`ANTHROPIC_API_KEY` into the live host secrets, (2) host decision (Railway lost its free tier — Vercel Hobby now also fixes ERR-026 at $0; DECISIONS entry needed) + deploy this bundle, (3) verify `ai_calls_made>0` live, then P7 backup → S7 dogfood.** Secrets restore itself is DONE (see BRIEF.md Key Registry, 2026-07-01). §§5–10 below predate this and describe the 06-15 state — read them as history, not as the current plan.
>
> *(Supersedes the 2026-06-14 "drawing-board reset" version of this file. That strategy mandate is now FULFILLED — the locked product definition lives in `docs/architecture/forgeminds-v1-finance-core.md` + `DECISIONS.md`; its live-test gap list became ERR-019…ERR-024 in `errors-fixed.json`.)*

---

## 1. TL;DR — where we are

ForgeMinds was reset ("back to the drawing board", 2026-06-14) after the founder tested it live and found it **worse than his hand-built Pipedream finance workflow**. Root cause was **two stacked problems**: (A) the AI pipeline never ran cleanly at runtime (telemetry gap + a curate→generate clobber + a stalled cron + a broken Cloudflare host), and (B) the product was never sharply defined. Both are being fixed in thin, founder-reviewed slices (S1→S7). S1, S2, S3 are DONE + verified. S3.1 (stabilize unattended execution) is code-done and its sweep/fail-loud/telemetry are verified — **but verification surfaced a CRITICAL blocker (ERR-028): `score` now fails every unattended tick on a malformed UUID the AI emits.** The pipeline no longer *hangs*; it *fails fast every score tick* and 139 articles are stuck unscored. The immediate next step is **S3.2** to fix that loop, then the founder's **Railway cutover** (the real host fix), then the **P7 backup**, then the **dogfood week (S7)**.

---

## 2. The product (LOCKED definition — do not re-litigate)

A **broad, horizontal, category-agnostic personal intelligence OS** for the **public / customers** (the founder is "one of others"). Spans any topic (finance, medical, science, sports, real estate, etc.). Monetization designed-in now, charged later (freemium SaaS).

**Two-layer depth model (the core design idea):**
- **Layer 1 — Understanding** (universal, the model's job, day one): relevance scoring, categorization, synthesis, NL interpretation — works for *any* vertical for free.
- **Layer 2 — Instrumentation** (bespoke, **finance-first**): live tickers, prices, charts, market data — built first for finance because the founder's **Pipedream WF1+WF2** is the concrete "beat this" benchmark.

**The moat is personalization depth + the learning loop (Voice DNA / outcomes), NOT "we have AI."** Day-one *value* (relevance + does-the-work) is copyable; the *moat* is the compounding per-user data — don't conflate them.

Full vision + assumptions: `docs/architecture/forgeminds-v1-finance-core.md` (APPROVED 2026-06-14, §7 assumptions all `[approved]`).

---

## 3. Environment & operating model (FACTS — read before any work)

| Thing | Value |
|---|---|
| Project root | `C:\Users\vtbsj\victor-ai-factory\projects\forgeminds` |
| Stack | Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + pgvector + pg_cron) · AI router over Gemini/Claude/Grok/Perplexity |
| **Dev Supabase project** | `ymgbjtgczgnooscigplb` — **default for ALL AI work** (MCP: `supabase-forgeminds`; verify with `SELECT 1;`) |
| Prod Supabase | separate project — **founder flag required**, never touched by default |
| Test user (dev) | `3707759d-9863-4f69-a6d8-f40036fa15f1` (vctrbbnv@pm.me) — seeded 7 topics / 11 tracked tickers / 4 excluded |
| **Current host** | Cloudflare Workers — `https://forgeminds.vctrbbnv.workers.dev` — **BROKEN for heavy AI routes (ERR-026)** |
| **Target host** | **Railway** (cutover pending — founder action). Supabase stays the host-independent "brain". |
| Dispatcher | pg_cron reads `private.app_config.forgeminds_base_url` and invokes the routes per-user every minute |
| AI router | `src/lib/ai/router.ts` — `routeAIRequest()`, `PROMPT_VERSION`. **All AI calls go through it.** |

**Two-session model (one-writer discipline):**
- **Desktop Claude** (this session): plans, architects, verifies via Supabase MCP / live-DB SQL. **Does NOT edit repo code or commit** (except learning files: errors-fixed.json, lessons, CURRENT_SPRINT.md, DECISIONS.md, this handoff).
- **PS Claude** (PowerShell): holds the **one-writer repo lock** (`.claude/.session-lock.json`); does all `src/` edits, migrations, builds, commits. Runs in the project root, model Sonnet 4.6. Deploy is PS's lane (`npm run deploy` = OpenNext build + Cloudflare deploy).

**Security constraints (NON-NEGOTIABLE):**
- The agent **never handles real secret values**. Never `Read` a `.env*` file. Reference `CRON_SECRET` / API keys by **name only**.
- No PII to any AI API. No secrets behind `NEXT_PUBLIC_` / `VITE_`. Server-side AI calls only.
- Dev project only unless the founder explicitly flags prod.
- **Pipedream stays ON until the dogfood passes** (zero-risk cutover).

---

## 4. The three V1 gates (Definition of "good enough to ship a finance V1")

1. **Telemetry** — `pipeline_runs.ai_calls_made > 0` and real tokens/day (an untracked metric is not evidence — lesson #111).
2. **Strict resolution** — AI maps every category/entity/ticker to an **existing DB UUID**, never invents; a miss is flagged-for-review, not blind-inserted (lesson #105).
3. **Dogfood** — the founder turns the **Pipedream flow OFF for 5–7 trading days**, runs daily finance ops on ForgeMinds, and rates it **≥ +0.5 higher** than Pipedream, with ≥2–3 real decisions / time saved. This is the real bar (lesson #107).

---

## 5. The pipeline (steps, files, what each does)

Order: **ingest → score → curate → enrich → generate → deliver**. Each is a cron route under `src/app/api/cron/<step>/route.ts`, guarded by `Authorization: Bearer $CRON_SECRET`.

| Step | File | What it does | Status |
|---|---|---|---|
| ingest | `src/app/api/cron/ingest/route.ts` | Per-user; only invokes fetchers for source types the user has (lesson #98). Writes `raw_articles` (`content_hash` UNIQUE dedup). | ✅ works |
| **score** | `src/app/api/cron/score/route.ts` | Gemini scores 0-1 vs the user's interest graph; strict **category** resolution; extracts **tickers**; **batch** upsert to `scored_articles`. `maxDuration=120`. **← ERR-028 lives here.** | ❌ failing every tick |
| curate | `src/app/api/cron/curate/route.ts` | Picks top N per `user_preferences.max_articles_per_brief`; cross-brief dedup; brief-consistency invariant. | ✅ works |
| enrich | `src/app/api/cron/enrich/route.ts` | Ticker/market data via `src/lib/pipeline/market-data.ts` (Finnhub quote/profile/metric, CoinGecko, Alpaca IEX intraday) + cheap Gemini NL "market read". | ✅ works |
| generate | `src/app/api/cron/generate/route.ts` | Claude writes the brief; weaves real ticker/price/52w/PE + the NL read into finance stories; logs `prompt_version`. | ✅ works |
| deliver | `src/app/api/cron/deliver/route.ts` | Email via Resend (E0/E1/E2 plan — see memory `forgeminds-email-delivery.md`). | ✅ runs |

**Key library files:**
- `src/lib/ai/router.ts` — `routeAIRequest()`, `PROMPT_VERSION`
- `src/lib/ai/models.ts` — model routing
- `src/lib/pipeline/scorer.ts` — `scoreArticles()`, `CANONICAL_CATEGORIES` (13 slugs), `buildInterestBlock()` **← S3.2 edits here**
- `src/lib/pipeline/category-resolver.ts` — `loadCategoryResolver()` (strict category → UUID)
- `src/lib/entities/resolver.ts` — `getResolver()`, `resolveOrCreateTicker()`, `resolveOrCreateTickersBatch()`
- `src/lib/pipeline/market-data.ts` — market data fetchers
- `src/lib/pipeline/user-prefs.ts` — `resolveUserId()`, `loadPrefs()`, `SYSTEM_USER_ID`
- `src/app/api/ops/ai-telemetry/route.ts` — ops telemetry metric (CRON_SECRET-gated)

---

## 6. What's DONE (slices S1–S3.1, with commits + proof)

- **S1 — AI fires + telemetry gate** — commits `fce39ef`, `3af7400`, `a88b1a9`. Fixed: curate→generate clobber (curate was re-stamping `generation_model='heuristic'` over Claude's label); wired `ai_calls_made`/`ai_tokens_used` at the router; fail-loud 0-AI-call watchdog; `GET /api/ops/ai-telemetry`. (See ERR-019, lesson #111.)
- **S2 — Personalization + strict category resolution + cross-brief dedup** — commits `3025e82`, `498fef2`. `categories` table (13 canonical + `uncategorized`) + `category-resolver.ts`; score writes resolved slug + `category_id` (never the old hardcoded `core`); `loadPrefs` reads topics/tickers/excluded; fixed gemini-2.5-flash "thinking" eating the JSON budget (ERR-027). Migration `20260614000000`. (ERR-020, ERR-021, ERR-024.)
- **S3 — Enrich: ticker/entity + market data + NL read + intraday** — commits `abb0648`, `fd0a83c`, `c464a43`. Seeded 14 entities + 22 aliases; `resolveOrCreateTicker`; `scored_articles.tickers/entity_ids`; `market-data.ts`; NL market read (`market-read-v0.1`). Migration `20260615000000`. Honest limit: world/macro source pool rarely names a public ticker, so story-level tickers are sparse; the brief's market read is carried by the always-enriched watchlist (correct design).
- **S3.1 — Stabilize unattended execution** — commits `3a208ce`, `8ae95a9`, `d6fa974`. Batch score (one upsert, throws→`failed` never dangles); DB-side `private.sweep_stale_pipeline_runs()` pg_cron `*/5` (heals dangling `running` rows even if the host is dead); curate brief-consistency invariant; `docs/ops/railway-cutover.md`.

**S3.1 independent verification (Desktop, 2026-06-15, live DB) — what PASSED:**
- ✅ Sweep live (`private.sweep_stale_pipeline_runs`, job `forgeminds_sweep_stale_runs [*/5 * * * *]`) — demonstrably healed the 3 dangling 13:34/14:05/14:36 runs → `failed [swept]`.
- ✅ No dangling `running` (score durations dropped 3.8M ms → ~65K ms; only an in-grace 15:07 tick).
- ✅ Telemetry real: today score `ai_tokens=126,211` / 30 calls; generate `19,552`; enrich `1,315`.
- ✅ Curate→generate consistency: 1 `heuristic` cold-start brief, 0 empty-HTML orphans.

---

## 7. 🚨 THE CRITICAL OPEN BLOCKER — ERR-028 (read this in full)

**Symptom:** Unattended `score` fails ~every tick. ~10 consecutive ticks (14:40–14:51 UTC, 06-15) failed with:
```
scored_articles batch upsert failed: invalid input syntax for type uuid: "284354a-702a-43ac-aabb-a4a713760d49"
```
**139 raw_articles stuck in `pipeline_status='fetched'`**, not advancing.

**Proven root cause:** the **Gemini scorer non-deterministically echoes a CORRUPTED copy of a real article id** — it drops one hex char. Verified against the live DB:
- emitted `284354a-…` → real id `2843554a-702a-43ac-aabb-a4a713760d49`
- emitted `3f363636d-…` → real id `3f36369d-e36d-4ee8-a181-e42883ed811c`

So it's a mangled **article_id**, not a ticker/entity. S3.1's guard `validArticleIds.has(score.articleId)` (in `src/app/api/cron/score/route.ts`, ~line 132) is supposed to drop it but isn't, on the live host — and because the upsert is **all-or-nothing**, one bad UUID rejects the whole batch → run throws → 0 articles advance → same batch re-fetched next tick → **infinite failure loop**. The occasional `completed` runs (100 in / 100 scored) are simply rounds where the AI happened to return all-clean ids.

**Two contributing causes:** (1) AI structured-output corruption (same family as ERR-027); (2) the live Cloudflare bundle may predate/omit the filter (stale-deploy, ERR-026 class — `forgeminds_base_url` is still Cloudflare, Railway cutover not done). Either way the fix is the same hardening + the cutover.

**This means S3.1's headline goal ("stable unattended execution") is NOT met.** Logged as ERR-028 (PENDING) in `errors-fixed.json`.

---

## 8. Live DB snapshot (verified 2026-06-15 ~15:08 UTC, dev `ymgbjtgczgnooscigplb`)

- `raw_articles` (last 24h): **139 fetched**, 84 scored, 27 curated.
- `score` today: 11 completed / **13 failed** (the failures = ERR-028 + 3 swept stale); `ai_tokens=126,211`.
- `pipeline_runs`: no stuck `running` except an in-grace 15:07 tick.
- `private.app_config.forgeminds_base_url` = `https://forgeminds.vctrbbnv.workers.dev` (Cloudflare — cutover NOT done).
- Sweep job present and firing.

---

## 9. ROADMAP — what's planned / ready / still to do

**Immediate (this is the next work):**
- [ ] **S3.2 — Scorer id-hardening + batch resilience (closes ERR-028).** PS prompt in §10. ← DO THIS NEXT.

**Founder-only actions (agent cannot do — no creds/secrets):**
- [ ] **Railway cutover** — deploy + env vars + `UPDATE private.app_config SET value='https://<railway-url>' WHERE key='forgeminds_base_url'`. Runbook: `docs/ops/railway-cutover.md`. This is the real host fix and removes the stale-deploy hypothesis.
- [ ] **P7 off-platform backup** — daily `pg_dump` to B2/S3 (architecture §6) before any external pilot. NOW DUE (the dev DB is also the only env, no backups — a standing data-protection gap).

**Then (slices, gated, in order):**
- [ ] **S4 — WF2 outputs:** charts from `ticker_data.intraday_json` (Recharts web / QuickChart email) + social drafts + video prompts → closes the WF1+WF2-parity acceptance gate (architecture §9).
- [ ] **S5 — Action engine + saved-items destination** (fixes ERR-022 dead Save/Dismiss/Act buttons).
- [ ] **S6 — Railway cutover (founder) + backups** (overlaps the founder actions above).
- [ ] **S7 — Dogfood week:** Pipedream OFF 5–7 trading days, founder rates ForgeMinds ≥ Pipedream +0.5. This is the V1 verdict (gate #3).

**Still to plan / open follow-ups (not yet sliced):**
- `sources.last_fetched_at` never updated → source-health "healthy" lie (ERR-025 ops follow-up).
- Finance-source-weighted ingest (source-quality loop) — the lever for more *story-level* tickers (S3 honest limit).
- Audio / "Listen" private-podcast feed (founder high-interest, IDEAS_BACKLOG T1.7) — gated after the product is solid.
- Email E2: buy a ForgeMinds domain → Cloudflare Email Service; remove `RESEND_TEST_RECIPIENT` (memory `forgeminds-email-delivery`).
- The 5 rule-update proposals in `PENDING_APPROVALS.md` (Self-Reflection Report) await founder approve/reject.
- The longer Phase 2 closed-alpha plan (CURRENT_SPRINT §2.x) remains valid intent but is paused behind S1→S7.

---

## 10. ⭐ THE EXACT NEXT PROMPT FOR PS CLAUDE (Slice S3.2)

> Paste this to PS Claude (PowerShell, project root, Sonnet 4.6). It is self-contained.

```
ROLE: PS Claude, executor (one-writer repo lock). S1/S2/S3 done; S3.1 done + Desktop-verified
against the live dev DB. Build ONE slice this session — S3.2 — then STOP and report for founder
review. Dev project ymgbjtgczgnooscigplb only. Never read .env; CRON_SECRET / API keys by name only.

CONTEXT: S3.1's fail-loud surfaced a CRITICAL blocker (ERR-028). The unattended `score` step fails
~every tick with: scored_articles batch upsert failed: invalid input syntax for type uuid
"284354a-702a-43ac-aabb-a4a713760d49". PROVEN: the Gemini scorer non-deterministically echoes a
CORRUPTED copy of a real article id (drops one hex char: real 2843554a-... -> emitted 284354a-...).
The S3.1 guard validArticleIds.has(score.articleId) in src/app/api/cron/score/route.ts is NOT
stopping it on the live host, and because the upsert is all-or-nothing, one bad uuid rejects the
whole batch -> run throws -> 0 articles advance -> same batch re-fetched next tick -> failure loop.
139 raw_articles are stuck in pipeline_status='fetched'. forgeminds_base_url is still Cloudflare
(Railway cutover not done — that's a separate founder action). Full detail: errors-fixed.json ERR-028.

INTENT (additive, two defensive layers + observability):
1. PARSE-TIME id validation in src/lib/pipeline/scorer.ts — the real fix. In the per-batch parse
   loop, build a Set of the batch's input ids (batch.map(a => a.id)) and DROP any returned item whose
   item.id is not in that Set OR fails a UUID-shape regex, BEFORE it becomes a ScoreResult. Count the
   drops and return the count in ScoreRunTelemetry (e.g. mangledIdsDropped).
2. KEEP the route's validArticleIds.has(score.articleId) filter as layer 2 (do not remove it).
3. BATCH RESILIENCE in src/app/api/cron/score/route.ts — before the upsert, drop any row whose
   article_id OR any entity_ids[] value fails a UUID-shape check, so one malformed value can never
   nuke the batch. Keep the all-or-nothing throw AFTER this guard (inputs now guaranteed clean).
4. OBSERVABILITY — write mangled_ids_dropped into pipeline_runs.metadata so we can see how often
   Gemini corrupts ids.
5. Redeploy the fixed bundle to the current live host (Cloudflare worker, existing deploy path) so the
   dispatcher runs the fix. (Do NOT attempt the Railway cutover — founder action.)

CONSTRAINTS: additive only; preserve S3.1's sweep + fail-loud + telemetry + curate->generate
invariant. VIBE Rule 52 (no silent catch — log the drop count), Rule 53 (keep the single batched
upsert; no N+1 regression), Rule 24 / lesson #105 (validate AI output against real ids, never trust
verbatim), lesson #111 (truthful telemetry). Dev only; code-only (no migration needed). One commit,
conventional message, reference ERR-028.

VERIFICATION (prove against the LIVE DB after deploy, not just locally — lesson #108):
1. select status, count(*) from pipeline_runs where step_name='score'
     and started_at > '<deploy_ts>' group by status;   -> completed, ZERO uuid-syntax failures.
2. select pipeline_status, count(*) from raw_articles
     where created_at > now()-interval '24 hours' group by 1;  -> the 'fetched' backlog drains.
3. A round containing a mangled id STILL completes (drops the 1 bad article, scores the rest):
   verify items_created > 0 on a tick where metadata.mangled_ids_dropped > 0.
4. score ai_tokens_used > 0 and ai_calls_made > 0 (telemetry still real).
5. npx tsc --noEmit + lint clean; curate->generate label consistency unchanged.

HONESTY NOTE: the definitive unattended confirmation needs the fixed bundle to actually reach the
live host. If the Cloudflare redeploy path is unavailable, say so plainly — then true confirmation
waits on the founder's Railway cutover (docs/ops/railway-cutover.md). S3.2 + the cutover + the P7
backup are the three prerequisites before the S7 dogfood week.

Audit gate at end. STOP. Report what was built, tested (with the live-DB query outputs), any errors
or remaining gaps, and the commit hash.
```

---

## 11. Errors & lessons reference (for cold pickup)

**`errors-fixed.json` (project root) — ERR-019 … ERR-028.** Most relevant now:
- **ERR-019** — the briefs *looked* heuristic because of a telemetry gap + curate→generate clobber, NOT a dead AI (corrected after S1).
- **ERR-026** — Cloudflare Workers/OpenNext is a poor fit for heavy Node/AI server code → move to Railway (host-independent brain on Supabase).
- **ERR-027** — gemini-2.5-flash "thinking" tokens starved the JSON output → empty JSON → silent default 5/5/5 scores. Fix: `thinkingBudget:0` + output headroom. Golden rule: disable thinking for structured extraction; never swallow a parse error into defaults.
- **ERR-028** (PENDING — the current blocker) — AI emits a corrupted copy of a real article id; one bad uuid nukes the all-or-nothing batch → score failure loop. Fix = S3.2.

**`.claude/rules/reference/lessons.md` (mirrored in factory `lessons-archive.md`) — #104–111.** Key ones:
- #104 Runtime-truth DoD: "status=completed" ≠ "did its job"; gate on `ai_calls>0` + a human-rated real output.
- #105 Strict resolution: AI maps to existing DB UUIDs, never invents.
- #106 Architect-first applies to the PRODUCT, anchored to a concrete benchmark.
- #107 Dogfood gate: a human must run the product's own loop and rate a real output.
- #108 Verify live DB/telemetry over handoff docs.
- #111 An untracked metric is not evidence — wire telemetry, prove it on a known-true case, then trust its zero.

**`golden-paths.md`:** GP-014 (diagnose a pipeline via `pipeline_runs` telemetry), GP-015 (strict-resolution AI→DB-UUID).

---

## 12. File map (the paths a fresh tool needs)

| Purpose | Path |
|---|---|
| Approved V1 architecture | `docs/architecture/forgeminds-v1-finance-core.md` |
| Strategy/external-review brief | `docs/architecture/strategy-architecture-brief-2026-06-14.md` |
| Slice roadmap / status | `CURRENT_SPRINT.md` (S1…S7; S3.1 verified-with-blocker; S3.2 added) |
| Decisions log | `DECISIONS.md` (3 entries 2026-06-14: broad engine, V1 strategy, Railway+Supabase stack) |
| Errors | `errors-fixed.json` (ERR-019…028) |
| Lessons | `.claude/rules/reference/lessons.md` (#104–111) |
| Golden paths | `golden-paths.md` (GP-014, GP-015) |
| Railway cutover runbook | `docs/ops/railway-cutover.md` |
| Pending approvals | `PENDING_APPROVALS.md` (5 rule proposals + items) |
| Score route (ERR-028) | `src/app/api/cron/score/route.ts` |
| Scorer (S3.2 edits) | `src/lib/pipeline/scorer.ts` |
| Entity resolver | `src/lib/entities/resolver.ts` |
| Market data | `src/lib/pipeline/market-data.ts` |
| AI router | `src/lib/ai/router.ts` |

---

## 13. Quick verification queries (run against dev to re-confirm state)

```sql
-- Is score still failing on the malformed uuid? (ERR-028)
select to_char(started_at,'HH24:MI') t, status, items_created, ai_tokens_used,
       left(coalesce(error_message,''),80) err
from pipeline_runs where step_name='score' and started_at > now()-interval '3 hours'
order by started_at desc limit 20;

-- Is the backlog draining? (139 fetched -> scored after S3.2)
select pipeline_status, count(*) from raw_articles
where created_at > now()-interval '24 hours' group by 1 order by 2 desc;

-- Did the cutover happen? (Cloudflare vs Railway)
select key, value from private.app_config where key='forgeminds_base_url';

-- Telemetry truthful today? (gate #1)
select step_name, count(*) filter (where status='completed') done,
       count(*) filter (where status='failed') failed, sum(ai_tokens_used) tok
from pipeline_runs where started_at::date = current_date group by step_name order by step_name;
```

---

## 14. Uncommitted as of this handoff

Desktop edited (NOT yet committed — PS holds the write-lock; fold into the S3.2 commit or commit as a `docs:` checkpoint): `errors-fixed.json` (ERR-028), `CURRENT_SPRINT.md` (S3.1 verified-with-blocker + S3.2 line), `NEXT_SESSION.md` (this file).

**The single most important next action: run the S3.2 PS prompt in §10. Nothing else (S4+) starts until the score failure loop is cleared on the live host.**
