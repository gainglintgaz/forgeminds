# ARCHITECTURE.md -- ForgeMinds V1 (broad engine, finance-instrumentation-first)

> **Status:** DRAFT pending the project owner's approval
> **Owner:** Victor + Claude (desktop session)
> **Probe:** external multi-AI adversarial review (2 reviews, 2026-06-14) + this session's live-DB / code forensics; the formal 6-agent architect-probe was substituted by the external review per founder. Surfaced ~12 assumptions; 7 explicit (see §7).
> **Foundational scope:** inception (new V1 sprint) -- §0 required.

> **Reconciliation note:** this artifact supersedes the prior generic framing in `GOAL.md` for V1 scope. The vision in GOAL.md (multi-tenant AI-first intelligence OS, Voice DNA + Community Brain moat) stays; this doc sharpens it to a *concrete, benchmarked, finance-first* V1 and explicitly defers the rest. Companion: `docs/architecture/strategy-architecture-brief-2026-06-14.md` (the externally-reviewed thesis).

---

## §0 -- Foundational Requirements (inception)

- **Target OS / platforms:** Web only -- responsive (desktop + mobile browser). Native desktop (Tauri) is an explicit **non-goal** for V1 (§8).
- **Runtime / language:** Next.js 16 / TypeScript hosted as a **standard Node container on Railway** (full Node runtime -- this is the fix for the Cloudflare `workerd` ChunkLoadError, ERR-026; verified: heavy Node/AI-SDK server code + long AI calls need full Node, not an edge isolate). Background pipeline runs on **Supabase** (Postgres + `pg_cron` dispatcher + Edge Functions / Deno). All AI through `src/lib/ai/router.ts`. Embeddings via `pgvector`.
- **Audience:** **Others** (broad, multi-vertical public -- any topic). V1 *proof* runs on the founder (finance) -> small pilot. "Others" forces portability + de-personalization from commit 1: **no hardcoded `victor`** anywhere; every value per-user.
- **Tenancy:** **Multi-tenant** from day 1 (per VIBE Rule 17). The `user_preferences` config spine (~38 columns) and the per-user `pg_cron` dispatcher already exist; every UX-affecting value is a column, not a literal.
- **Distribution model:** SaaS web app. Freemium is **designed-in now** (Explorer free / Builder ~$12-20 / Architect ~$30-50) but does **not** gate the alpha.
- **Data + privacy boundary:** PII **never** to AI APIs (`privacy.md`). Per-user data isolated by **RLS** in Supabase. The **brain (Postgres/pgvector/cron) is host-independent**, so the web host stays swappable (portability requirement). **No cross-user data flow in V1** -- Community Brain / cohort aggregates are deferred (§8). Secrets are server-side env only (`CRON_SECRET` on cron routes; no `NEXT_PUBLIC_` secrets).

---

## §1 -- Goal

After V1 ships, **Victor can turn OFF his hand-built Pipedream finance workflow and run his daily finance/markets intelligence on ForgeMinds** -- a personalized brief that matches or beats Pipedream: relevant finance/markets/econ/crypto/bonds/commodities stories scored against *his* tickers and topics, enriched with ticker + market data and a natural-language interpretation, packaged with intraday charts, social-post drafts and video prompts in *his* voice, delivered on *his* schedule. At the same time, **any user can pick any topic** (medicine, sports, farming, fashion...) and get a genuinely deep AI brief from discovered sources on day one (Layer-1 understanding-depth), with finance-grade live-data instrumentation (Layer-2) arriving per-domain over time.

**Layer boundary (concrete -- so the team knows exactly which bucket new code goes in):**

| Layer | What it does | Scope | Code home |
|---|---|---|---|
| **Layer 1 -- universal** | full-text fetch, summarize, general entity extraction (names/places), a relevance/impact score, configurable lenses, voice | works for ANY source/topic, day one | shared engine (`score`/`generate`, `router.ts`) |
| **Layer 2 -- bespoke** | live-data enrichers (Finnhub/Alpaca/AlphaVantage calls, ticker resolution, market-data NL interpretation) + domain execution prompts (charts, "trading memo", video prompt) | finance first; one domain at a time | finance-specific modules (`enrich`, finance prompt set) |

The rule: **Layer-1 code must contain zero finance-specific logic** (so it stays universal); everything finance-specific lives in Layer-2 modules. Adding a new vertical (sports/medicine) = a new Layer-2 module, not a Layer-1 change.

**Verbatim founder request:**
> "I basically want to test the ... finance / markets / economic / stocks / crypto / bonds / commodities news I'm getting now from the Pipedream workflow I built ... This is far worse than the feeds I'm getting with Pipedream right now."
> "is there a way to not build just for finance ... and be good still but more broad and wide and also deep and fully into the subjects and all the ins and outs from the start?"

---

## §2 -- Personas

### P1: Victor -- finance power user (primary)
- **State:** runs a working Pipedream finance pipeline daily; testing ForgeMinds as a replacement.
- **Need:** a brief that is *more* relevant + deeper than his Pipedream output, with the same content package (tickers, charts, social/video drafts).
- **Expects:** stories scored against HIS tracked tickers/topics; live market data + NL interpretation; his voice; on his schedule.
- **Complains about:** generic headlines, "3 stories . core", missing tickers, shallow text, dead buttons.

### P2: Broad-vertical user (edge: non-finance depth)
- **State:** a doctor / professor / sports follower who picks a non-finance topic in onboarding.
- **Need:** the few things that matter in *their* field, with real analysis, not headlines.
- **Expects:** relevant sources discovered for their niche; expert-level AI reasoning (Layer-1).
- **Complains about:** a generic digest; a faked "live data" widget for a domain we haven't instrumented (honesty matters).

### P3: Hostile second user (edge: scale / no-help)
- **State:** maximally unlike Victor -- no RSS knowledge, different timezone, signs up cold.
- **Need:** onboard in < 10 min and get a working pipeline with zero hand-holding.
- **Expects:** honest locked states, a brief on schedule in their timezone, working save/dismiss/act.
- **Complains about:** hardcoded `victor`, dead UI, a brief that never arrives, no "where do I find what I saved".

---

## §3 -- 9-scenario map (per VIBE Rule 11)

**Common (3):**
1. Victor opens his morning brief: ≥10-15 finance stories scored against his tickers/topics, each with ticker + market data + NL interpretation, ≥1 intraday chart, ≥1 social draft + video prompt -- and it reads better than today's Pipedream email.
2. A user onboarded on "regenerative farming" gets a Layer-1 deep AI brief from discovered farming sources (no finance instrumentation, but real analysis).
3. A user taps an item -> "Draft X post" -> the action layer returns a voice-matched draft they can edit + publish.

**Edge cases (3):**
4. AlphaVantage hits its 25/day cap (or Finnhub is down): the step logs the failure, uses **last-known-good**, and the brief still ships -- never a broken/empty brief.
5. A thin news day (few items clear the relevance floor): an **honest "quiet day" state**, not a fabricated full brief.
6. Cross-brief dedup: a story delivered in yesterday's brief is **excluded** from today's (fixes ERR-024).

**Adjacent surfaces (3):**
7. Audio/podcast channel (deferred; the brief is the source artifact it would read).
8. Saved-items destination page -- Save now has a home (fixes ERR-022).
9. Settings/tunability -- topics, tracked tickers, excluded topics, schedule, density, voice anchors -- all per-user.

---

## §4 -- Two-way data flow (per `two-way-traceability.md`)

### Forward: where do numbers come FROM?

| Surface / element | Source rows (table + column) | Helper (file) | Source-kind |
|---|---|---|---|
| Brief story | `briefs.article_ids` <- `scored_articles` <- `raw_articles` | `src/app/api/cron/{ingest,score,curate}/route.ts` | rss / api |
| Relevance score | `scored_articles.composite_score` (router task=`score`) | `src/lib/pipeline/scorer.ts` | ai |
| Ticker + market data | `ticker_data.price_cents/change_percent` (Finnhub quote) | `src/app/api/cron/enrich/route.ts` | api |
| NL interpretation | `scored_articles.one_line_summary` + brief text (router task=`generate-brief`) | `src/app/api/cron/generate/route.ts` | ai |
| Chart | intraday JSON (Finnhub/Alpaca) -> Recharts (web) / QuickChart PNG (email) | enrich + deliver | api |
| Social draft / video prompt | router (task=`social` / content) in the action layer | `src/lib/ai/router.ts` | ai |

### Reverse: where do numbers GO TO?

| Source row | Consumer surface(s) |
|---|---|
| `article_outcomes` (save/dismiss/act) | per-user relevance weights + interest graph -> next brief's `score` step; saved-items page; outcome aggregates (future) |
| `briefs` row | dashboard brief list, brief detail, email, saved-items |
| `ticker_data` | brief story callouts, charts, market table in email |

### DB-mediated Dual-Brain handoff
- The triage model (Gemini, `score`) writes **structured rows** (resolved IDs, scores) to `scored_articles`; the executive model (Claude, `generate`) **reads those rows** from the DB. Do **not** pass large article strings model-to-model in memory. This is already how the pipeline is shaped (score -> scored_articles -> generate reads) -- make it explicit and keep it: the intermediate state stays **auditable**, and a failed `generate` can re-run off persisted rows.

### Drill-down + strict resolution contract
- Every AI-extracted **category / ticker / entity resolves to an existing DB UUID before insert** (fixes ERR-021; lessons.md #105).
- **On a resolution MISS:** never drop the article and never invent a value. **Keep the article**, leave the entity/category unresolved (a category falls back to an explicit `uncategorized`/pending bucket, not a hallucinated one), and push the miss to a **review queue** so the alias table can be extended. A good article is never lost because one entity didn't resolve.
- **Required schema (migration):** a canonical `categories` source (table/enum of valid UUIDs) + seed the existing `entities`/`entity_aliases` tables (0 rows today) with ticker/entity aliases so the model's text can resolve to a UUID. Flagged for `PENDING_APPROVALS.md` (strict resolution is not just code -- it needs this migration).
- Every rendered story can drill to its source `raw_articles` row (date, source, url).
- Every AI output row carries `prompt_version` + model + token/cost + `sources[]`.

### Render location (charts / WF2 outputs)
- **Dashboard is PRIMARY:** charts render **dynamically (Recharts)** from intraday JSON stored in Supabase -- not static images.
- **Email is SECONDARY:** the daily email digest uses static **QuickChart** PNGs (no client to render Recharts). Generate PNGs only for the email path, never for web users.

---

## §5 -- Stakeholder concerns

### Senior architect
Reuse the existing pipeline (router, `pg_cron` dispatcher, finance fetchers, `score`/`generate`, user-prefs, briefs UI) -- **~85% reuse, fix the seams, do not rebuild** (Appendix A). The brain stays on Supabase (host-independent) so Railway is a swappable presentation layer. Observability is `pipeline_runs` telemetry + a new ops watchdog. The one structural decision: keep curate heuristic but make `generate` actually pick up curated briefs (the load-bearing seam).

### Senior engineer
The load-bearing bug: `generate` processed 0 items -- it never selected the briefs `curate` wrote, so briefs stayed `generation_model='heuristic'` (ERR-019). Fix the selection seam first. Then: the telemetry gate (`ai_calls_made/ai_tokens_used > 0`), the strict-resolution layer, content-hash dedup **plus** cross-brief dedup (ERR-024), the **AlphaVantage 25/day cap** (cache or drop -- hourly runs exceed it), fail-open on a single fetcher error (keep other sources), idempotent deliver. `one_line_summary` must be populated (ERR-023). Confirm the deployed build == current code (stale-deploy was part of the failure). UI reads come from a client store (Zustand) that fetches + filters **at the DB level** (never client-side filtering of large arrays) and re-fetches fresh on mount, so the dashboard never shows stale intelligence.

### Domain expert (finance / compliance)
Market commentary is **not investment advice** -- carry the disclaimer on any generated finance text. Respect API ToS (X, Finnhub, Benzinga, Alpaca, AlphaVantage). No PII to AI. CCPA/GDPR account-deletion + export for user data.

### End user
Must be **relevant AND do the work** (draft/act), not generic headlines. Honest locked states ("quiet day", "topic not yet instrumented"). No dead buttons.

### Hostile architect (per `hostile-architect.md`)
- Cold start: zero data on day one -> carried by Layer-1 depth + action execution (day-one VALUE), not by the (empty) data moat (lessons.md #109).
- 0-AI-calls regression: the **telemetry gate** is the tripwire that catches it before any "done".
- Broad dilutes finance: mitigated -- finance gets full Layer-2 + the dogfood proof; other verticals run Layer-1 only.
- Second-time/dedup, hardcoded `victor`, two-tabs concurrency on the dispatcher -- all addressed (dedup, per-user config, idempotency keys).

### Auditor
Every AI output traceable (`prompt_version` + model + tokens + cost + `sources[]`); `pipeline_runs` records each step's calls/items/cost; `delivery_log` records sends. The 30-second "where did this number/story come from?" test must pass from the UI.

---

## §6 -- Real-world friction

### Applicable regulations
- "Not investment advice" disclaimer on generated finance content.
- CCPA / GDPR: account deletion + data export.
- Third-party API ToS (X, Finnhub, Benzinga, Alpaca, AlphaVantage).

### Audit / evidence requirements
- Logged: `pipeline_runs` (step, status, `ai_calls_made`, `ai_tokens_used`, items, duration), AI provenance (`prompt_version`/model/sources), `delivery_log`.
- Retention: per `privacy.md`; no PII in logs.

### Scale assumptions
- **10 users:** fine on free/low tiers.
- **1K users:** the per-user dispatcher fans out fine; the real constraint is **shared-API-key quota** -- per-user source gating (already in `ingest`) prevents calling fetchers a user never asked for.
- **10K users:** likely need per-user API keys and/or a queue; AlphaVantage unusable at scale (drop or paid).

### Multi-tenant implications (Rule 17/55)
- Per-user-configurable: topics, tracked_tickers, excluded_topics, schedule (tz/cadence/active hours+days), density caps, min score, voice anchors/tone/density, delivery channels, tier.
- Cron dispatcher: yes (exists). Cross-tenant leak surfaces: none if RLS holds (verify).

### i18n / a11y
- V1 English. a11y baseline: no dead UI, keyboard nav, contrast.

### Security boundaries
- AI sees: article text + the user's interest graph (no PII). RLS on every table. `CRON_SECRET` on cron routes. No `NEXT_PUBLIC_` secrets.
- **Backups GAP (P7):** single Supabase project, no off-platform backup. **Must add daily off-platform `pg_dump` before the first external pilot user** (`data-protection.md` §2.2). Dev project `ymgbjtgczgnooscigplb` is the working env; prod requires founder flag.
- Email is Resend test-mode (shared FinKeel key) -> migrate to Cloudflare Email Service at launch (E2, tracked separately in `PENDING_APPROVALS.md`).

---

## §7 -- Explicit assumptions (REQUIRES VICTOR'S APPROVAL)

1. [pending] **Broad engine + finance-instrumentation-first.** Layer-1 (understanding-depth via discovered sources + AI reasoning + lenses) is universal day one; Layer-2 (live structured-data widgets: tickers/charts/market) is bespoke and built for finance first.
2. [pending] **Host = Railway; brain = Supabase; reuse the existing `pg_cron` dispatcher (no Trigger.dev yet).** Off Cloudflare Workers.
3. [pending] **Fix-not-rebuild (~85% reuse).** No fresh schema; extend the existing ~70-table schema.
4. [pending] **WF2 outputs are IN V1 finance scope.** The finance brief is a content *package* -- stories + tickers/market NL + ≥1 chart + ≥1 social draft + ≥1 video prompt + HTML email -- not text only.
5. [pending] **Dogfood = the definition of V1 done.** Victor turns Pipedream OFF for 5-7 trading days, rates ForgeMinds **≥ Pipedream + 0.5** on relevance/depth/voice/actionability, and logs ≥2-3 real decisions informed / time saved.
6. [pending] **Deferrals accepted** (§8): Collective Brain, Dot Connector, morphing-OS UI, Tauri, OAuth voice ingestion, Trigger.dev, non-finance Layer-2, the six self-improving loops.
7. [pending] **Backups (P7) added before the first external pilot user**; prod work requires founder flag.
8. [approved] **ForgeMinds is a STANDALONE broad product for OTHERS** (your earlier locked choice: "broad and generic for customers/users, not me only"). It is **not** being built as a personal intelligence layer welded into VictorForge. Therefore: VictorForge deep-integration (shared MCP catalog / rules engine / Ollama-Gemma fallback), cross-project **personal** seeding (lawn/cars/HOA/travel/health as product defaults), and the Tauri local bridge are **deferred** (§8). Day-one seeding = your **finance** interests written into **your own** `user_preferences` row (the multi-tenant test-user config that powers the dogfood), **not** personal topics baked into the product. *(An external reviewer's draft reverted to the "intelligence layer inside VictorForge" framing pulled from an earlier mega-prompt — `[reject]` this assumption if you actually want that version, since it flips §0 audience from "others" to "me-first" and changes seeding + integration + the dogfood definition.)*

**Victor approval block:**
```
[x] All assumptions approved as-is — Victor, 2026-06-14
[ ] Approved except: <list of #>
[ ] Reject + correction: <list of # + corrections>
[ ] Scale-down: <new smaller scope>

Signed: Victor  Date: 2026-06-14  (verbatim: "All assumptions approved as-is. Plan and architecture well first.")
> **Status update:** APPROVED 2026-06-14. Build may proceed in thin, verified, dogfooded slices (Appendix B S1→S7), founder-reviewed between slices.
> **S1 status (2026-06-14):** DONE pending founder review. AI now fires + is recorded (telemetry gate). Seam fixed (curate no longer clobbers generate's AI label); ai_calls_made/ai_tokens_used written; fail-loud 0-call watchdog + GET /api/ops/ai-telemetry added. Proven live on dev (user 3707759d): score=1582 tok + generate=1830 tok today, brief generation_model=claude-sonnet-4-6. Commits fce39ef (seam) + 3af7400 (telemetry).
> **S2 status (2026-06-14):** DONE pending founder review. Strict category resolution (14 real categories, was 1; `categories` table + resolver, misses→`uncategorized`, never invented) + per-user relevance personalization (ERR-020: scorer reads topics/tickers, brief leads with finance for the seeded user) + cross-brief dedup (ERR-024, overlap=0). Migration `20260614000000` (advisors clean). Also fixed gemini-2.5-flash thinking starving the JSON output. Commits 3025e82 + 498fef2. **Ticker/entity UUID resolution deferred to S3.**
> **S3 status (2026-06-15):** DONE pending founder review. Ticker/entity resolution (14 entities seeded, scorer extracts tickers, `resolveOrCreateTicker`, scored_articles.tickers/entity_ids + briefs.ticker_symbols populated) + market data (Finnhub quote/profile2/metric, CoinGecko crypto, Alpaca intraday — 11/11 tracked enriched w/ price/change/52w/PE, 9 w/ intraday) + NL market read (ticker_data.interpretation) woven into the brief. Migration `20260615000000` (advisors clean). Commits abb0648 + fd0a83c + c464a43. Proof: brief reads "TSLA $406.43 +1.82%… SPY/QQQ near 52-week highs". AWAIT founder go-ahead before S4.
```
> No code commits until Victor replies with the keyword **build approved** (per `execution.md` Phase 0 §6).

---

## §8 -- Non-goals (what we are NOT building in V1)

- **Collective Brain / cross-user anomaly (Z-score):** needs many users; meaningless at N=1 -- deferred (IDEAS_BACKLOG T2).
- **Dot Connector (pgvector long-memory):** needs accumulated saved items -- deferred.
- **Context-morphing OS UI:** polish, not core -- deferred.
- **Tauri local-first desktop:** a separate product -- deferred.
- **OAuth voice ingestion (X/LinkedIn scrape):** API cost + consent friction; V1 uses paste-samples / style anchors (already built) -- deferred.
- **Trigger.dev / Inngest:** the `pg_cron` dispatcher already works -- reuse-before-build.
- **Layer-2 instrumentation for non-finance verticals:** sequenced after finance proof.
- **The six self-improving loops (source-quality, prompt A/B, etc.):** post-dogfood -- deferred.

All deferrals logged in `IDEAS_BACKLOG.md`.

---

## §9 -- Acceptance criteria

- [x] **Telemetry gate (S1, 2026-06-14):** `SELECT sum(ai_tokens_used) FROM pipeline_runs WHERE started_at::date = current_date AND step_name IN ('score','generate')` returns **> 0** — proven live: score=1582, generate=1830 today. Metric surfaced via `GET /api/ops/ai-telemetry` (`telemetry_gate_pass:true`); a dashboard widget on top of that JSON is deferred to a later slice.
- [x] **Strict resolution (S2, 2026-06-14):** `scored_articles.diversity_category` shows **14 distinct real categories** (was only `core`); unresolved AI categories land in the `uncategorized` review bucket (`category_resolution`/`category_id` queryable); 0 invented categories persisted. *(Category resolution done; ticker/entity UUID resolution deferred to S3 with the market-data layer.)*
- [ ] **Dogfood gate (THE definition of done):** Victor runs daily finance ops on ForgeMinds with Pipedream **OFF** for 5-7 trading days; mean daily rating ≥ Pipedream + 0.5; ≥2-3 documented real decisions/time-saved.
- [ ] **WF1+WF2 parity:** a finance brief contains ≥10-15 curated stories with resolved tickers + market data + NL interpretation + ≥1 chart + ≥1 social draft + ≥1 video prompt + a rendered HTML email.
- [ ] **No dead UI** (Dead Button Test): Save -> item appears on the saved page; Dismiss -> item leaves the view; Act -> a draft is produced.
- [ ] **No cross-brief dupes:** a story in yesterday's brief is absent from today's (query on `briefs.article_ids`).
- [ ] **AI provenance:** `SELECT count(*) FROM <ai-output tables> WHERE prompt_version IS NULL OR generation_model IS NULL` returns 0.
- [ ] **Layer-1 broad check:** one non-finance topic produces a real AI brief from discovered sources (manual review).
- [ ] `forge doctor` / `verify-foundational-requirements.mjs` warns clean (this artifact's §0 is complete); pre-commit arch gate satisfied (this doc committed before `feat(` commits).

---

## §10 -- Rollback plan

- **Time-to-rollback:** minutes (per-step `git revert`).
- **Data-loss risk:** none -- all changes are additive on the existing pipeline/schema.
- **Communication:** Victor (single operator); no external users until dogfood passes.
- **Procedure:**
  1. Revert the offending slice's commit(s).
  2. The pipeline falls back to last-known-good behavior (briefs still generate, even if heuristic).
  3. **Pipedream stays ON until the dogfood gate passes** -- never cut over the working flow before the replacement is proven (zero-risk cutover).
- **Validation post-rollback:** a brief still generates; existing briefs render; `/api/health` 200.

---

## §11 -- Source persona-probe artifacts

The formal 6-agent architect-probe was **substituted by external adversarial review** (founder's choice):
- **Two independent external AI reviews** (2026-06-14) stress-tested the thesis -- covering architect (stack), engineer (fix-vs-rebuild, gates), domain (finance), end user (action execution), hostile architect (cold start, over-architecture), auditor (telemetry). Their critiques are reconciled in `DECISIONS.md` (2026-06-14) and `docs/architecture/strategy-architecture-brief-2026-06-14.md`.
- **This session's live-DB + code forensics** = the auditor/engineer evidence (the `pipeline_runs` 0-AI-calls finding, the empty personalization, the single `core` category, the dead surfaces). Captured in `errors-fixed.json` ERR-019..026.
- Probe ran on: 2026-06-14. Questions surfaced: see strategy brief §9 (8 pressure-test questions) + this artifact's §5/§7.

---

## §12 -- Cross-rule integration

- [x] `architect-first.md` -- this artifact satisfies the gate (inception, §0 filled).
- [x] `two-way-traceability.md` -- §4 implements forward + reverse + strict resolution.
- [x] `hostile-architect.md` -- §5 Persona 5 ran the stress test.
- [x] `ai-first-principles.md` -- §5 / §9 enforce AI-at-core at **runtime** (the telemetry gate), not just design.
- [x] `data-integrity.md` (DMG) -- honest locked states (§3.4/§3.5, §9).
- [x] `data-protection.md` -- backups gap (P7) flagged in §6; dev/prod isolation noted.
- [x] `privacy.md` / `secrets-handling.md` -- PII boundary + `CRON_SECRET` + no `NEXT_PUBLIC_` secrets (§6).
- [x] `wired-not-orphaned.md` -- the buried finance API fetchers get surfaced (no built-but-unreachable engines).
- [x] VIBE Rules 16 (reuse), 24 (strict resolution / invisible ledger), 25 (asymmetric compute / cost sentinel), 35 (runtime-truth DoD), 55 (per-user config), 57 (AI-at-core).
- [x] Per-domain primer applied: **finance**.

---

## Appendix A -- Reuse map (fix, don't rebuild; ~85%)

| Capability | File / path | Status | V1 action |
|---|---|---|---|
| AI router (asymmetric: Gemini triage + Claude executive already in the task map) | `src/lib/ai/router.ts`, `src/lib/ai/models.ts` | WIRED | Reuse; add finance tasks + cost caps; ensure telemetry (tokens) logged per call |
| Score (AI relevance) | `src/app/api/cron/score/route.ts`, `src/lib/pipeline/scorer.ts` | WIRED (code) / 0 calls (runtime) | Confirm it fires on real items; score against the user interest graph; populate `one_line_summary` |
| Curate | `src/app/api/cron/curate/route.ts` | HEURISTIC | Keep heuristic selection; add **strict resolution** to real categories + **cross-brief dedup** |
| Enrich (tickers/market) | `src/app/api/cron/enrich/route.ts` | HEURISTIC (Finnhub quote) | Reuse; extend to full market data + NL interpretation; persist intraday JSON for charts |
| Generate (AI brief, Voice DNA) | `src/app/api/cron/generate/route.ts` | WIRED (code) / 0 items (runtime) | **Fix the curate->generate selection seam** (the load-bearing bug); add WF2 outputs (social/video-prompt) |
| Deliver (email) | `src/app/api/cron/deliver/route.ts` | HEURISTIC | Reuse; add charts (QuickChart PNG) + social/video sections; fix the 258-failed delivery path |
| Ingest + finance fetchers | `src/app/api/cron/ingest/route.ts`, `src/lib/pipeline/ingest/{finnhub,benzinga,alpaca,alpha-vantage,rss}.ts` | BURIED/WIRED | Reuse; respect AlphaVantage 25/day cap; content-hash dedup already present |
| Per-user prefs + dispatcher | `src/lib/pipeline/user-prefs.ts`, `supabase/migrations/20260501000001_pg_cron_dispatcher.sql` | WIRED | Reuse as-is; seed finance `topics`/`tracked_tickers` |
| Briefs UI + outcomes | `src/app/(dashboard)/briefs/` | WIRED | Reuse; add **saved-items destination** + wire Dismiss/Act |

**ADD (new):** strict-resolution layer; WF2 outputs (charts via Recharts/QuickChart, social drafts, video prompts); saved-items page; ops/telemetry watchdog + dashboard; AlphaVantage caching; off-platform backup (P7); Railway host move.

## Appendix B -- Build sequence (after `build approved`; thin, dogfooded slices)

> Out of scope for *this* doc (no code yet). Listed so the path is clear. Each slice is verified (telemetry + a human reads the output) before the next.

1. **S1 -- Make the AI fire + telemetry gate.** Fix the curate->generate seam; confirm deployed==code; restart dispatcher; add the "AI tokens today" metric. Verify: `ai_tokens_used > 0`, a real AI-written brief exists.
2. **S2 -- Finance personalization + strict resolution.** Seed `topics`/`tracked_tickers`; resolve categories/tickers to DB UUIDs; ≥3 real categories; cross-brief dedup. *(Requires a migration: a canonical `categories` table/enum + seeded `entity_aliases`/ticker aliases — strict resolution is schema + code, not code alone.)*
3. **S3 -- Enrich: tickers + market data + NL interpretation.**
4. **S4 -- WF2 outputs:** charts + social drafts + video prompts in the brief + email.
5. **S5 -- Action layer + saved-items:** Save destination, Dismiss removes, "Draft post" works.
6. **S6 -- Railway host move + backups (P7).**
7. **S7 -- Dogfood week:** Pipedream OFF 5-7 trading days; founder rates daily; pass the §9 gate.

---

*Template version: 2026-05-17 (v4.4.5). This artifact: inception-scoped, drafted 2026-06-14, pending `build approved`.*
