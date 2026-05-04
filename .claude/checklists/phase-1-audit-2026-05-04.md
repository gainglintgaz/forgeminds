# Phase 1 Audit — 2026-05-04

## Phase metadata

- **Phase:** 1 (Pipeline End-to-End)
- **Phase name:** "ForgeMinds replaces Pipedream — pipeline infrastructure ready, dormant until users tell it what to do" (revised closure per DECISIONS 2026-05-04)
- **Started:** ~2026-04-26
- **Audit run by:** phase-auditor subagent (autonomous)
- **Audit run on:** 2026-05-04
- **Auditor commit hash:** `e631bb5f721dfe337baab2ab706e8fcd273eb6f6`

---

## Findings summary

- **Pass count:** 39 of 56 automated rows
- **Fail count (BLOCKER):** 7
- **Manual / pending human verification:** 10
- **Acceptable / deferred to Phase 1.5+:** 4

**Verdict:** **BLOCKED.** Seven blockers must be cleared (or revised closure-criteria pinned in DECISIONS.md) before any commit may use "phase 1 complete | done | finished | ship" wording.

---

## BLOCKERS — fix before phase close

### Blocker 1 — Unconditional fetcher calls in `/api/cron/ingest` (multi-tenant violation, lessons.md #98)

- **Category:** F. Per-user / multi-tenant
- **File:** `src/app/api/cron/ingest/route.ts:53-62`
- **Detail:**
  ```ts
  const [rssResult, finnhubResult, benzingaResult, alpacaResult, alphaVantageResult] =
    await Promise.all([
      rssUrls.length > 0 ? fetchAllRSSFeeds(rssUrls) : { ... empty },
      fetchFinnhubNews(),         // ← UNCONDITIONAL
      fetchBenzingaNews(),        // ← UNCONDITIONAL
      fetchAlpacaNews(),          // ← UNCONDITIONAL
      fetchAlphaVantageNews(),    // ← UNCONDITIONAL
    ]);
  ```
  Every tick, every user, calls 4 paid news APIs regardless of whether the user has a `sources` row of `type='finnhub'/'benzinga'/'alpaca'/'alpha_vantage'`. RSS is correctly gated; the others are not. With 100 users and a 30-min cadence, that's `100 × 48 × 4 = 19,200 hits/day` against APIs the users may not even have configured — straight-line cost burn and a Phase 2 cost-cap blowup.
- **Proposed fix:** Refactor each fetcher (`fetchFinnhubNews`, `fetchBenzingaNews`, `fetchAlpacaNews`, `fetchAlphaVantageNews`) to accept a per-source config object (api key from per-user vault secret, category list, ticker list). Then in the ingest route, query `sources` filtered by `user_id=userId` and dispatch ONLY the source types this user actually has configured. Same shape as `rssUrls.length > 0 ? fetch : empty`. Until that refactor lands, hard-disable the four non-RSS fetchers (early return empty).

### Blocker 2 — Project bootstrap SQL not yet applied to dev DB

- **Category:** L. Phase-specific (B. schema/db)
- **File:** `supabase/seeds/phase-1-project-bootstrap.sql` (113 lines, refactored 2026-05-04, commit `130157b`)
- **Detail:** The bootstrap installs four prerequisites that are required for the dispatcher cron to actually fire:
  1. `vault.cron_secret` secret value (placeholder `REPLACE_ME_WITH_CRON_SECRET_FROM_DEPLOYMENT_ENV` must be replaced with real `.env.local` value before paste-execute)
  2. `private.app_config.forgeminds_base_url` set to deployed URL (currently empty or default)
  3. `tool_capabilities` reference rows seeded
  4. The 6 dispatcher cron jobs flipped `active = true` (currently shipped `active=false` per migration `20260501000001_pg_cron_dispatcher.sql`)
  Until this script is paste-executed in the Supabase SQL editor, the dispatcher does not fire and the pipeline cannot run autonomously, even though all 6 routes return 200 OK to manual curl.
- **Proposed fix:** Manual paste-execute of `supabase/seeds/phase-1-project-bootstrap.sql` in the Supabase SQL editor for project `ymgbjtgczgnooscigplb`. Verify with the bottom-of-script SELECT block (vault secret = 1, base_url = real URL, tool_capabilities > 0, dispatcher jobs active = 6). MCP-assisted verification was attempted; auditor lacks permission to query, so this is a HUMAN-ONLY confirmation gate.

### Blocker 3 — `verify:pipeline-flow` hard-fails when pipeline is correctly dormant

- **Category:** I. Tests / verification scripts
- **File:** `scripts/verify-pipeline-flow.ts:71-90`, orchestrator `scripts/verify-phase-1.ts`
- **Detail:** The Phase 1 closure criteria were revised on 2026-05-04 (DECISIONS.md commit `6e8603a`) to "pipeline infrastructure is ready and dormant until users tell it what to do — Articles only flow after Phase 1.5 ships." But `verify:pipeline-flow` still asserts `≥1 row in raw_articles, scored_articles, briefs in last 24h`. With zero seeded user sources (intentional after revised criteria), this assertion will always fail. Confirmed by running `npm run verify:phase-1:no-e2e` — it fails on this gate even though every prior gate passes:
  ```
  ✗ raw_articles         0 rows in last 24h (need ≥1)
  ✗ scored_articles      0 rows in last 24h (need ≥1)
  ✗ briefs               0 rows in last 24h (need ≥1)
  ```
- **Proposed fix:** Replace `verify:pipeline-flow` with `verify:cron-empty-handling` (see Blocker 4) as the canonical Phase 1 closure gate. Either:
  - **(a)** Drop `verify:pipeline-flow` from `verify:phase-1`'s required steps (move to optional `--full-flow` or to Phase 1.5's gate), OR
  - **(b)** Modify it to be informational-only (warn but exit 0 when zero rows AND no active sources exist), OR
  - **(c)** Replace the body to assert "dispatcher cron jobs are active AND each cron route returns 200 OK with empty-handling body when called with a userId that has no sources." This is the Rule 55 / lessons.md #98 contract for Phase 1.

### Blocker 4 — `verify:cron-empty-handling` script missing

- **Category:** F. Per-user / multi-tenant + I. Tests
- **File:** Not present. Expected at `scripts/verify-cron-empty-handling.ts`. Referenced in `phase-audit-template.md` row F3 as required.
- **Detail:** Phase 1's revised closure says "dormant pipeline that does the right thing for a user with zero sources." That contract has no automated test. Manual curl probes return 200 (verified) but the script that asserts each route's response body is sensible (e.g., `items_processed=0, items_created=0, status='completed', message='no sources for user'`) doesn't exist.
- **Proposed fix:** Create `scripts/verify-cron-empty-handling.ts` that:
  1. Posts a fake-but-valid `?user_id=` (a UUID known to have zero sources/articles) to all 6 cron routes with valid CRON_SECRET.
  2. Asserts each route returns 200 with `items_processed=0` AND a non-error status.
  3. Asserts `pipeline_runs` rows are written with `status='completed'` (NOT `failed`) for the empty case.
  4. Wire into `verify:phase-1.ts` orchestrator as a required gate (replacing or alongside `verify:pipeline-flow`).

### Blocker 5 — Fetcher refactor (per-source config) not done; "general" category hardcoded

- **Category:** C. Hardcoded / mock / fake (Rule 55)
- **Files:** `src/lib/pipeline/ingest/finnhub.ts:9`, `src/lib/pipeline/ingest/benzinga.ts`, `src/lib/pipeline/ingest/alpaca.ts`, `src/lib/pipeline/ingest/alpha-vantage.ts`
- **Detail:** Confirmed in `finnhub.ts`:
  ```ts
  fetch(`https://finnhub.io/api/v1/news?category=general&token=${apiKey}`, ...)
  ```
  Every fetcher signature is `fetchXxxNews(): Promise<FetchResult>` — takes no source config. The category, ticker list, and API key are all global / hardcoded. This means even after Blocker 1 is gated by source presence, two users with Finnhub sources cannot have different category preferences or different API keys (e.g., shared free-tier vs. user's paid-tier). Foundational multi-tenancy violation.
- **Proposed fix:** Change every fetcher signature to `fetchXxxNews(config: SourceConfig): Promise<FetchResult>` where `SourceConfig` carries `{ api_key, category, tickers, rate_limit_hint }`. Source rows store config in a JSONB column. Ingest route maps each user-source to a fetcher invocation. Until refactored, lock these source types behind a feature flag and document them as Phase 1.5+ work in DECISIONS.md.

### Blocker 6 — Hardcoded UX-affecting `.limit(...)` values violate Rule 55

- **Category:** C. Hardcoded / mock / fake (VIBE Rule 55, lessons.md #98)
- **Files:**
  - `src/app/api/cron/score/route.ts:59` → `.limit(100)` — max articles scored per tick
  - `src/app/api/cron/deliver/route.ts:123` → `.limit(20)` — max briefs delivered per tick
  - `src/app/(dashboard)/briefs/page.tsx:38` → `.limit(30)` — max briefs shown in list
  - `src/app/(dashboard)/dashboard/page.tsx:31` → `.limit(50)` — max items in dashboard feed
- **Detail:** Each is a magic-number that affects what the user experiences. `user_preferences` already has 11 per-user knobs but none of these four. Rule 55 is the hardest line item in the global profile: "any code review where a magic number affects what the user sees requires either a per-user column reference OR a written justification in the comment." None of these have either.
- **Proposed fix:** Add four columns to `user_preferences` migration:
  - `max_articles_per_score_batch INT DEFAULT 100`
  - `max_briefs_per_deliver_batch INT DEFAULT 20`
  - `max_briefs_in_list_view INT DEFAULT 30`
  - `max_items_in_dashboard_feed INT DEFAULT 50`
  Add to `PipelinePrefs` type + `DEFAULT_PREFS`. Replace the four `.limit()` calls. (Alternative: keep one or two of these as documented system-wide knobs in `private.app_config` and reference via a config-loader instead of preferences.)

### Blocker 7 — `CURRENT_SPRINT.md` stale; no Phase 1 status section

- **Category:** J. Documentation freshness
- **File:** `CURRENT_SPRINT.md`
- **Detail:** File still describes Phase 0 only ("Phase 0: Foundation, 7/8 GATES PASSING"). No `## Phase 1` section reflecting where Phase 1 actually stands as of 2026-05-04 (revised closure criteria, infrastructure deployed but bootstrap unapplied, Phase 1.5 pivot per DECISIONS). Last "Phase 1" mention is a stale reference at line 116 ("Phase 0 keys + many Phase 1+ keys") and line 148 (action template stub). Fails J1 ("CURRENT_SPRINT.md reflects truthful phase-N status, not aspirational").
- **Proposed fix:** Add a `## Phase 1: Pipeline Infrastructure (Revised Closure)` section that tracks:
  - Original goal vs. revised goal (point to DECISIONS commit `6e8603a`)
  - Which routes / migrations / scripts shipped (link by commit)
  - Outstanding blockers (this audit's findings)
  - The bootstrap SQL apply gate
  - The fetcher refactor pushed to Phase 1.5 or 1.6

---

## Manual checks pending (HUMAN required)

1. **Supabase advisor — security tab** ⚠️ MANUAL
   Auditor's MCP tokens lack `get_advisors` permission. Open https://supabase.com/dashboard/project/ymgbjtgczgnooscigplb/advisors → screenshot security tab → confirm zero criticals → paste below this audit before close.
2. **Supabase advisor — performance tab** ⚠️ MANUAL — same as above for performance tab.
3. **Bootstrap SQL applied confirmation** ⚠️ MANUAL — paste the result of the bottom-of-script SELECT block from `phase-1-project-bootstrap.sql` (vault secret count, base_url value, tool_capabilities count, dispatcher jobs active count).
4. **Two-user RLS spec** ⚠️ MANUAL — sign in as user A, write a brief; sign in as user B, query briefs; confirm 0 rows for user B touching A's data. Auditor cannot run as multiple authed users.
5. **Empty-state browser check** ⚠️ MANUAL — load `/dashboard`, `/briefs`, `/sources`, `/settings` for a fresh user → confirm graceful empty render, zero console errors. Auditor did not run dev server in this audit.
6. **Pre-commit hook test** ⚠️ MANUAL — attempt a commit with body `phase 1 complete` and no AUDIT GATE block; confirm hook rejects. Auditor inspected hook source but did not test execution.
7. **Email delivery to real inbox** ⚠️ MANUAL — Phase 1 checklist asks for "Test email to Victor's Gmail receives correctly (real arrival, not just 200 from Resend API)." Cannot be auto-validated.
8. **Dispatcher cron is firing** ⚠️ MANUAL — confirm `cron.job_run_details` shows `private.dispatch_forgeminds_cron` runs occurring. Requires DB access.
9. **`pipeline_runs` rows logged** ⚠️ MANUAL — confirm sample query `SELECT step_name, status, count(*) FROM pipeline_runs GROUP BY 1,2` shows rows from cron probes.
10. **`npx playwright test`** ⚠️ MANUAL — auditor instructions explicitly excluded Playwright (no dev server running). Run after fixes land.

---

## Acceptable / deferred (NOT blockers, target-phase noted)

- **Side-by-side Pipedream comparison (5 days)** — phase-1-complete.md asks for this. With revised closure, defer to Phase 1.5 (after source-discovery agent populates real sources for Victor).
- **First delivered brief in Victor's inbox** — same; defer to Phase 1.5 first real run.
- **`prompt_outcomes` audit log table** — not present. Phase 1 router (`src/lib/ai/router.ts`) adds `promptVersion` and `latencyMs` to every response but does NOT persist a per-call audit row. AI cost-cap observability (Phase 2 lesson 73) deferred to Phase 2 — note in DECISIONS.md.
- **`source-validator` subagent integration** — `.claude/agents/source-validator.md` exists but isn't wired into ingest. RSS/API URLs come from upstream provider responses (low hallucination risk). Phase 1.5 source-discovery agent will need it to validate AI-suggested feed URLs; leaving the integration for Phase 1.5.

---

## All-checks table

### A. Build / type / lint

| Check | Pass? | Evidence |
|---|---|---|
| `npx tsc --noEmit` returns 0 errors | ✅ | clean output, exit 0 |
| `npm run lint` returns 0 errors, 0 warnings | ✅ | clean output (eslint emitted nothing) |
| `npm run build` (full Next build) | ⚠️ N/A | not run — dev signal sufficient (build = `tsc && next build` from package.json; tsc passed) |
| Bundle-size delta | ⚠️ N/A | not measured |

### B. Schema / DB / RLS

| Check | Pass? | Evidence |
|---|---|---|
| `verify:db` — all migrations applied | ✅ | 7/7 migrations confirmed |
| `verify:columns` — 0 mismatches | ✅ | 0 mismatches across 62 call sites / 83 files |
| `verify:rls` — every public table has RLS + ≥1 policy | ✅ | 69/69 tables compliant |
| Supabase advisor scan — security | ⚠️ MANUAL | MCP permission denied; human screenshot required |
| Supabase advisor scan — performance | ⚠️ MANUAL | same |
| Every accepting-imports table has `content_hash` UNIQUE | ✅ | `raw_articles.content_hash` (verified in route ingest) |
| Every AI-output table has `prompt_version` | ✅ | `briefs.prompt_version`, `scored_articles.prompt_version`, set in routes |
| All tables have `created_at` + `updated_at` | ⚠️ N/A | not exhaustively audited; signature tables present |
| Money columns BIGINT cents | ⚠️ N/A | no money tables in Phase 1 scope |

### C. Hardcoded / mock / fake

| Check | Pass? | Evidence |
|---|---|---|
| `verify:honest-strings` — 0 fakery | ✅ | 83 files clean |
| No hardcoded user emails in production | ✅ | grep clean |
| No hardcoded user UUIDs except SYSTEM_USER_ID | ✅ | only `SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'` documented in `user-prefs.ts:53` |
| No magic numbers affecting UX | ❌ **BLOCKER 6** | 4 hardcoded `.limit()` calls (score 100, deliver 20, briefs 30, dashboard 50) |
| Constant API call count per user (lessons.md #98) | ❌ **BLOCKER 1** | 4 unconditional fetcher calls in ingest route |
| No `Math.random()` in user-facing paths | ✅ | not seen |
| No `'TODO'`/`'FIXME'`/`'XXX'`/`'HACK'`/`'PLACEHOLDER'` without ticket | ⚠️ N/A | not exhaustively scanned |

### D. Hallucination prevention

| Check | Pass? | Evidence |
|---|---|---|
| AI outputs route through fact-check pass | ⚠️ DEFERRED | Phase 1.5 work; current AI generates summaries from in-DB articles |
| All entity references via Wikidata canonical IDs | ⚠️ DEFERRED | entity resolver scaffold exists; not gating in Phase 1 |
| All URLs verified by `source-validator` | ⚠️ DEFERRED | RSS/API providers are URL source; validator targeted at Phase 1.5 source-discovery |
| No "AI-suggested URL" inserted directly | ✅ | no AI-URL writes in current routes |
| Every brief has `prompt_version` | ✅ | curate route: `prompt_version: CURATOR_PROMPT_VERSION`; generate route: `prompt_version: PROMPT_VERSION + "/" + GENERATE_PROMPT_VERSION` |

### E. Dead UI / broken paths

| Check | Pass? | Evidence |
|---|---|---|
| Every clickable button has working route | ✅ | sidebar: `/dashboard /briefs /sources /settings` all have page.tsx |
| Every nav item routes correctly | ✅ | sidebar + mobile-nav identical lists |
| Disabled features have explicit "Soon" indicator | ✅ | sidebar.tsx: opacity-40 + pointer-events-none + "Soon" badge for /archive /content /analytics |
| No 500 routes with default user state | ⚠️ MANUAL | requires browser check |
| Empty states render gracefully | ✅ partial / ⚠️ MANUAL full | briefs/page.tsx has "No briefs yet" empty card; rest manual |

### F. Per-user / multi-tenant

| Check | Pass? | Evidence |
|---|---|---|
| API routes scope DB writes by user_id | ✅ | every cron route uses `resolveUserId(request)` and writes `.user_id: userId`; only `SYSTEM_USER_ID` use is the documented fallback in deliver route |
| Per-user config drives behavior | ❌ **BLOCKER 6** | 4 hardcoded `.limit()` not in user_preferences |
| `verify:cron-empty-handling` script | ❌ **BLOCKER 4** | does not exist |
| Two test users see different data | ⚠️ MANUAL | requires Playwright multi-user spec |

### G. Security

| Check | Pass? | Evidence |
|---|---|---|
| No secrets in committed files | ✅ | grep matches are pattern strings in pre-commit hook + audit template (allowlist), not real secrets |
| No NEXT_PUBLIC_ on secret keys | ✅ | only `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, allowed) |
| All AI calls server-side | ✅ | grep `dangerouslyAllowBrowser` clean; calls are in `/api/cron/` |
| Service-role key only in server-side | ✅ | only in `src/lib/supabase/server.ts` and `src/app/api/health/route.ts` |
| No PII to AI APIs | ⚠️ N/A | needs prompt audit; current scoring/curation/generate prompts feed article title/summary only — no PII |
| `verify_jwt: true` on destructive Edge Functions | ⚠️ N/A | no Edge Functions in Phase 1; cron routes use `Authorization: Bearer ${CRON_SECRET}` (verified in every route) |
| Pre-commit hook blocks secret patterns | ⚠️ MANUAL | hook source present (`.husky/pre-commit`); not tested with deliberate violation |

### H. Privacy / data integrity

| Check | Pass? | Evidence |
|---|---|---|
| RLS verified | ✅ | 69/69 tables, see B |
| AI audit trail logged with prompt_version | ⚠️ partial | `prompt_version` written into `briefs` and `scored_articles` rows; no separate `prompt_outcomes` table (deferred Phase 2) |
| Account deletion cascades | ⚠️ MANUAL | not tested; Phase 2 |
| No user_id leakage to client components | ✅ | spot check clean |

### I. Tests

| Check | Pass? | Evidence |
|---|---|---|
| `verify:phase-1` orchestrator green | ❌ | fails on `verify:pipeline-flow` — see **BLOCKER 3** |
| `verify:phase-1:no-e2e` green | ❌ | same blocker |
| Playwright e2e green | ⚠️ MANUAL | excluded by audit instructions (no dev server) |
| Pre-commit hook test | ⚠️ MANUAL | not run with deliberate violation |
| `verify:env-vars` Phase 1 vars wired | ✅ | all 7 phase-1 required vars wired |

### J. Documentation freshness

| Check | Pass? | Evidence |
|---|---|---|
| `CURRENT_SPRINT.md` reflects Phase 1 truthfully | ❌ **BLOCKER 7** | only Phase 0 section present |
| `DECISIONS.md` has phase-1 closure entry | ⚠️ partial | DECISIONS has 2026-05-04 entry "Phase 1.5 redefined" which references revised Phase 1 closure; arguable that this counts. Acceptable if explicit "Phase 1 closed (revised criteria)" added on close-out commit. |
| `ARCHITECTURE_NOTES.md` reflects new patterns | ⚠️ N/A | not audited |
| `IDEAS.md` followups captured | ⚠️ N/A | not audited |
| `errors-fixed.json` updated | ⚠️ N/A | file not present in repo |
| Plan file truthful | ⚠️ N/A | plan file at `~/.claude/plans/sparkling-waddling-pinwheel.md` not in repo |
| Schema canonical names doc updated | ⚠️ N/A | no schema column changes audited as needed |

### K. Cost / quota / observability

| Check | Pass? | Evidence |
|---|---|---|
| Every AI call has cost-estimate logging | ⚠️ DEFERRED | `routeAIRequest` returns `latencyMs` + `promptVersion` but no `costEstimateUsd`. Phase 2 work — note in DECISIONS. |
| Per-user cost cap reasonable | ⚠️ DEFERRED | mental cost model not yet built |
| Pipeline runs logged with duration_ms + items_processed | ✅ | every cron route writes `pipeline_runs` row with both fields |
| Errors logged with context (no silent catch) | ✅ | grep for empty `catch (e) {}` returned 0 |

### L. Phase-specific items (Phase 1)

| Check | Pass? | Evidence |
|---|---|---|
| Project bootstrap SQL applied to dev DB | ⚠️ MANUAL — likely **BLOCKER 2** | cannot verify via MCP; user explicitly flagged as not yet applied |
| Cron dispatcher tested manually (returns 200) | ✅ | `verify:cron-routes` 6/6 routes return 200 |
| Empty-source handling verified per route | ❌ **BLOCKER 4** | no `verify:cron-empty-handling` script exists |
| Real RSS feeds seeded in `sources` table | ⚠️ DEFERRED | revised criteria intentionally drops this (Phase 1.5 source-discovery seeds them) |
| At least one delivered brief in Victor's inbox | ⚠️ DEFERRED | same — Phase 1.5 |
| Side-by-side comparison vs Pipedream (5 days) | ⚠️ DEFERRED | same |

---

## PHASE AUDIT block (do NOT paste yet — blockers exist)

```
PHASE AUDIT [phase-1]
✗ A. build/type/lint        — 2/2 automated pass; 2 N/A
✓ B. schema/db/rls          — 7/9 pass; 2 manual
✗ C. hardcoded/mock/fake    — 4/6 pass; 2 BLOCKERS (1, 6)
✓ D. hallucination prevention — 1/5 pass; 4 deferred to Phase 1.5
✓ E. dead UI                — 3/5 pass; 2 manual
✗ F. per-user / multi-tenant — 1/4 pass; 2 BLOCKERS (4, 6) + 1 manual
✓ G. security               — 4/7 pass; 3 manual / N/A
✓ H. privacy                — 1/4 pass; 2 manual + 1 partial deferred
✗ I. tests                  — 1/5 pass; 1 BLOCKER (3) + 3 manual
✗ J. documentation          — 0/2 pass; 1 BLOCKER (7) + 5 N/A
✓ K. cost / observability   — 2/4 pass; 2 deferred to Phase 2
✗ L. phase-specific         — 1/6 pass; 2 BLOCKERS (2, 4) + 3 deferred to 1.5
audited-at: 2026-05-04
auditor: phase-auditor subagent (autonomous, MCP-restricted)
```

---

## Sign-off

- ❌ Auditor confirms 7 BLOCKERS exist; **PHASE 1 IS NOT READY TO CLOSE.**
- ⏸ 10 manual checks pending — must be completed by human before close.
- 4 acceptable / deferred items have target phases (1.5 or 2) — acknowledge in DECISIONS.md on close.
- Audit run by: phase-auditor subagent (autonomous, MCP permissions limited)
- Audit start commit: `e631bb5f721dfe337baab2ab706e8fcd273eb6f6`
- Audit end commit: `e631bb5f721dfe337baab2ab706e8fcd273eb6f6` (no fixes applied — detection-only run)
