# ForgeMinds — Comprehensive Product Review (Personal + Business Lens)

> **Date:** 2026-07-03 · **Author:** Fable (Cursor, Chief-Architect review pass) · **Mode:** READ + VERIFY + PLAN — zero `src/` edits, zero commits.
> **Verification substrate:** live dev DB `ymgbjtgczgnooscigplb` via `npx supabase db query --linked` + `npx supabase db advisors --linked` (Supabase MCP plugin was not connectable this session; the authenticated CLI was the verification path). Every DB claim below was run fresh 2026-07-03 ~13:30–14:15 UTC. Code claims verified against the working tree at commit `d46cac0` (HEAD, master, single worktree, clean src/).
> **Discipline:** lesson #108 (DB > docs), #104/#111 (status='completed' is not evidence), #107 (dogfood is the verdict). Anything I could not verify live is explicitly marked **UNVERIFIED**.

---

## 1. Executive summary (the 10 lines)

1. **The single most important truth: ForgeMinds is currently a fully-built, fully-committed AI product whose AI has not fired in 19 days.** Every fix is written, tested, and sitting at HEAD — none of it is running, because the live host is still the broken Cloudflare Worker with dead API keys.
2. Verified live: **0 AI calls / 0 tokens on all 611 pipeline runs in the last 72h, every one reporting `completed`** — ERR-029 (silent heuristic degradation) is still the live behavior.
3. Verified live: every brief since 06-15 is `generation_model='heuristic'`; since 06-29 they also have `summary_html = NULL` — the dashboard shows "Summary pending" every day, and **0 emails delivered in 7 days**. The product is delivering zero value right now.
4. The fail-loud guard (`AI_ZERO_CALL`, commit `654113d`) has fired **0 times in 30 days** → the committed bundle (fail-loud + Anthropic-only loop + substring-validation gate) is **not deployed** (inference from telemetry; the Worker bundle itself is not inspectable — see §3 note).
5. **Top action #1 (FOUNDER, ~1–2 h): host cutover to Vercel Hobby** — deploy HEAD, set env vars (`ANTHROPIC_API_KEY` + the §4B list), flip `private.app_config.forgeminds_base_url`, verify `ai_calls_made>0`. Everything else is downstream of this.
6. **Top action #2 (FOUNDER, ~1 h): P7 off-platform backup.** There are **zero backups** of the only database this product has. One `pg_dump` cron to B2/S3. Do not invite a single tester before this.
7. **Top action #3 (AGENT, after AI fires): 48-h soak verification** — AI_ZERO_CALL fires when keys are wrong, `completed` + tokens when right, substring-gate metadata visible, backlog sane, briefs `claude-*` with real HTML.
8. **Top action #4 (FOUNDER, 5–7 trading days): S7 dogfood** — Pipedream OFF, daily 1–5 rating in a log, ≥ +0.5 vs Pipedream = V1 verdict. (S4 charts/social + S5 saved-items can land during the same window — agent work.)
9. **Top action #5 (both): stale-docs purge** — NEXT_SESSION.md/CURSOR_HANDOFF.md still command "fix ERR-028 first" (disproven 07-01); CLAUDE.md says the stack is Vercel Fluid; the ERR-028 "139 stuck articles" picture is gone. §2 has the full contradiction table with corrective edits.
10. Business lens in one line: the wedge (breadth + does-the-work outputs + learning loop) is sound against the 2026 field including Google Finance, unit economics work at Haiku/Sonnet prices **only with per-user cadence caps** (§5D), and nothing about GTM matters until gates 1–3 pass — don't spend a dollar on marketing before dogfood.

---

## 2. Area A — Live-state reconciliation (doc claim vs DB truth vs fix)

Re-verified the CURRENT LIVE STATE block myself. Result: **the block is accurate in every material claim** (two small precision notes below). The stale documents are the older handoffs.

### 2.1 What I verified fresh (queries + results)

| # | Check | Query (paraphrased) | Live result 2026-07-03 |
|---|---|---|---|
| V1 | AI telemetry 72h | `pipeline_runs` group by step,status; sum ai_calls/tokens | ingest 101 ✓ / score 102 / curate 102 / enrich 102 / generate 102 / deliver 102 — **all `completed`, ai_calls=0, ai_tokens=0 on every step** (1 ingest `failed`) |
| V2 | Brief models 30d | `briefs` group by date, generation_model, html-null | Every brief 06-15→07-03 `heuristic`. `summary_html IS NULL` on 06-29, 06-30, 07-01, 07-02, 07-03. **No briefs at all on 06-13, 06-20/21, 06-27/28** (weekends + 2 gap days). Last `claude-sonnet-4-6` brief: **2026-06-14** |
| V3 | Fail-loud deployed? | count runs with `error_message ILIKE '%AI_ZERO_CALL%'` 30d | **0** → the 654113d guard has never executed on the live host |
| V4 | Mangled-id telemetry | count runs with `metadata` containing `mangled_ids_dropped` | **0** → S3.2 layer-1 also not live |
| V5 | Host cutover | `private.app_config.forgeminds_base_url` | `https://forgeminds.vctrbbnv.workers.dev` — **still Cloudflare** |
| V6 | ERR-028 loop | `raw_articles` pipeline_status 7d | scored 422 / curated 78 / **fetched 4** — no failure loop, backlog drains (via heuristic default scores = the ERR-029 failure mode, not health) |
| V7 | Cron alive | `cron.job` + `job_run_details` 24h | 6 dispatchers `* * * * *` + sweep `*/5` all active; **100.0% success 24h** |
| V8 | RLS | `pg_class.relrowsecurity`, public | **75/75 tables RLS ON** |
| V9 | ERR-025 | `sources.last_fetched_at` | **NULL on all 15 sources** — the "source health lie" is still live |
| V10 | ERR-022 | `saved_items` / `article_outcomes` counts | saved_items **0**, article_outcomes **4** — Save has never written a destination row users can find; the buttons are barely used |
| V11 | Users/catalog | `auth.users`, `source_catalog` | **1 user** (the founder test user), catalog **218 active** (onboarding unlocked, ≥50 gate) |
| V12 | Email | `delivery_log` sent 7d | **0 deliveries** in 7 days |
| V13 | Advisors | `db advisors --linked --type all --level info` | 189 findings — see §4C |

Precision notes on the prompt's block: (a) "every brief since 06-27 is NULL-html" — actually NULL starts **06-29**; 06-27/28 produced **no briefs at all**; heuristic-labeled goes back to 06-15. (b) "ai_calls=0 on every step across 72h, all completed" — confirmed, except one `failed` ingest run.

### 2.2 Doc-vs-truth contradiction table (the correcting edits)

| # | Doc + claim | Live truth | Correcting edit (executor draft) |
|---|---|---|---|
| C1 | `CURSOR_HANDOFF.md` §3/§4: "score BROKEN, fails every tick (ERR-028), 139 articles stuck; S3.2 is your first task" | Loop not reproducing since ≥06-30 (V6: only 4 fetched). ERR-028 fix already committed (654113d). The live blocker is ERR-029 + no deploy | Prepend a dated banner: "⚠️ SUPERSEDED 2026-07-01/03 — ERR-028 is fixed-in-code and its loop is gone. The live blocker is ERR-029 + host cutover. See NEXT_SESSION.md header + docs/reviews/2026-07-03-comprehensive-review.md." (Full draft §6.1) |
| C2 | `CURSOR_HANDOFF.md` §3 table: "Score ❌ / everything else ✅ working" | ALL AI steps are non-working live (0 AI calls); they only *report* completed | Same banner covers it; replace the table's ✅ marks with "✅ code / ❌ live until deploy" |
| C3 | `NEXT_SESSION.md` §§5–13 (06-15 body): ERR-028 blocker, S3.2 prompt, "139 stuck," Railway-as-target | Header (07-01) already supersedes; body still commands the wrong work; Railway free tier is gone | Collapse §§5–13 under "HISTORY (pre-07-01) — do not execute"; update §3 target-host row to "Vercel Hobby (07-03 decision pending founder)" |
| C4 | `CURRENT_SPRINT.md` S3.2/S3.3 "BUILT… pending activation" + S6 "host decision reopened" | Correct — but nothing marks that **d46cac0 (substring gate) + b8ff95d (Anthropic-only)** are also awaiting the same deploy | Add one line to S3.2/S3.3: "Also awaiting the same deploy: b8ff95d (Anthropic-only core loop) + d46cac0 (substring-validation gate). Nothing at HEAD later than the 06-15 bundle is live." |
| C5 | `.claude/CLAUDE.md` Stack: "Vercel Fluid Compute · Stripe billing" + "AI router for all **Gemini**/Claude/Grok/Perplexity calls" + "brief via Claude **Haiku**" | Host = Cloudflare (broken) with Vercel proposed; Stripe not wired; **Gemini retired 07-02**; briefs = Sonnet, score = Haiku | Rewrite Stack para (draft §6.2). This was already flagged in PENDING_APPROVALS 06-14 and **never applied** — 3rd surfacing |
| C6 | `BRIEF.md` Stack: "Multi-model AI: Gemini Flash, Grok…" + Key Registry "Host env = Railway (target)" | Gemini retired; Railway rejected (free tier gone) | Update stack line + registry header to "Host env = Vercel (target, decision pending) / Cloudflare Worker secrets (current)" |
| C7 | `DECISIONS.md` 2026-06-14: "Railway chosen" (still latest host decision on file) | Railway killed its free tier (noted only in CURRENT_SPRINT S6); no superseding entry exists | **A new DECISIONS entry is required** the day the founder picks the host (draft §6.3) — decision log currently ends on a rejected choice |
| C8 | `docs/ops/railway-cutover.md` is the referenced runbook in 6+ places | Wrong host | Add banner "superseded by vercel-cutover runbook (§4B of this review)"; write `docs/ops/vercel-cutover.md` from §4B |
| C9 | `errors-fixed.json` ERR-028 `status: "PENDING — fix not yet applied"` | Fix IS applied in code (654113d parse-time validation + route guard); pending only deploy; loop not reproducing | Update status: "FIXED in code 2026-07-01 (654113d, folded into ERR-029 slice); loop not reproducing live since ~06-30; deploy pending" |
| C10 | `GOAL.md` §5 "AI cost ≤ $1.20/user/mo Builder" vs S3.1-era live burn | Verified 06-15 telemetry: score alone 126k tok/day for ONE user ≈ $4–8/mo at Haiku prices before generate | Not a doc *error* but an unreconciled tension — needs the §5D cadence-cap decision, then update GOAL.md band or the default cadence |
| C11 | Memory/handoffs: "dashboard shows briefs" | `/dashboard` renders a raw `raw_articles` feed (no scores, no brief); briefs live under `/briefs` | UI fix in §5E (P1) or correct the docs' description of the surface |
| C12 | `.cursor/rules/*.mdc` + `AGENTS.md` renamed to `.disabled` — **uncommitted**, unexplained | Working tree has them disabled; git status dirty for ~20 files | Founder decision: either commit the disable with a one-line DECISIONS note ("Cursor mirrors off to cut context noise; CLAUDE.md remains canonical") or restore. Don't leave the rule layer in an uncommitted limbo |

**Deployed vs committed:** commits `3a208ce/8ae95a9/d6fa974` (S3.1) were deployed 06-15 (sweep verified firing). Everything after — **`654113d`, `1b7700f`, `b8ff95d`, `c1376b6`, `d46cac0` — is committed, NOT deployed** (V3/V4 prove the runtime behavior is pre-654113d). GitHub `origin/master` is also stale (local-only commits; the remote answers to `d46cac0`? — `git branch -a` shows origin/master present but the 06-15 handoff said 26 commits unpushed; **UNVERIFIED** how far origin lags today — run `git rev-list origin/master..master --count` before relying on the remote).

---

## 3. Area B — Critical path to a live, trustworthy V1

### 3.0 The one blocker, restated precisely

The dispatcher (healthy, 100% cron success) invokes a host that (a) cannot run the heavy AI routes (ERR-026) and (b) carries dead/stale AI keys (ERR-029) and (c) runs a pre-06-15 bundle without any of the fail-loud/anti-fabrication code. **No code change can fix this. It is a deploy + secrets + one-UPDATE-statement task, and it is founder-only** (Vercel login + key values).

### 3.1 Host recommendation: **Vercel Hobby** (verified 2026-07-03)

| Criterion | Vercel Hobby | Why it wins |
|---|---|---|
| Cost | **$0** | Railway free tier discontinued; Cloudflare proven unfit (ERR-026) |
| Runtime fit | Next.js-native full Node, no OpenNext translation layer | Removes the ERR-026 class entirely |
| Function duration | **300s max on Hobby** (Fluid) | Routes declare `maxDuration=120` — fits with 2.5× headroom |
| Invocation budget | 1M/mo free; dispatcher ≈ 6 routes × 60 × 24 × 30 ≈ **260k/mo** | Fits. Fluid bills only *active CPU* (~4 CPU-hr/mo free) — AI-wait time is I/O, not CPU |
| Cron | Vercel cron limited to 1/day on Hobby — **irrelevant**: pg_cron in Supabase does all scheduling via HTTP | The architecture already sidesteps the one Hobby limit that would hurt |
| ⚠️ The catch | **Hobby is non-commercial-use only** (Vercel fair-use policy). Dogfood + free closed alpha = fine. The moment payments/ads go live → **Pro $20/mo mandatory** | Budget it as a launch-day line item, not a today cost |

Fallbacks if Vercel misbehaves: Fly.io (~$3–5/mo small VM) or Render ($7/mo starter). Do not revisit Cloudflare for the app tier. Supabase remains the host-independent brain either way — this decision is reversible (that's the point of the dispatcher reading `forgeminds_base_url` from the DB).

### 3.2 The cutover runbook (split by owner)

**FOUNDER-ONLY (creds/secrets/deploy) — ~60–90 min total:**
1. `npm i -g vercel && vercel login` (once).
2. From the project root: `vercel` (link) → `vercel --prod` → note `https://forgeminds-<x>.vercel.app`.
3. In the Vercel project → Settings → Environment Variables (Production, mark secrets Sensitive): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (**must exactly equal Supabase vault secret `cron_secret`** — the known 401 gotcha), `ANTHROPIC_API_KEY` (the NEW 2026-07-01 key), `FINNHUB_API_KEY`, `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `ALPHA_VANTAGE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TEST_RECIPIENT`, `NEXT_PUBLIC_APP_URL`(= the vercel.app URL). Note: `GEMINI_API_KEY` is NOT needed (retired b8ff95d). Confirm the Anthropic key sits in a Workspace with a spend cap (BRIEF.md §Spend caps).
4. `vercel --prod` again if env vars were added after the first deploy (they apply on next build).
5. Smoke: `curl -H "Authorization: Bearer $CRON_SECRET" https://<vercel-url>/api/cron/score` → 200 (or an explicit AI error — either proves routing).
6. The cutover statement (SQL editor, dev project): `UPDATE private.app_config SET value='https://<vercel-url>' WHERE key='forgeminds_base_url';`
7. Watch 2–3 dispatcher ticks. Done. (Leave the Cloudflare Worker up but orphaned; delete its secrets after 48h clean — including the retired `GEMINI_API_KEY` per BRIEF.md.)

**AGENT-DOABLE (after founder steps):** the entire §3.4 verification battery; writing `docs/ops/vercel-cutover.md`; updating the C1–C9 docs; the S4/S5 slices.

### 3.3 P7 backup design (do immediately after cutover, before any tester)

- **What:** nightly `pg_dump` of `ymgbjtgczgnooscigplb` → Backblaze B2 (or S3/GCS — different vendor than Supabase, per data-protection §2.2).
- **How (recommended minimal):** a GitHub Actions scheduled workflow (or the founder's Windows Task Scheduler) running `pg_dump "$SUPABASE_DB_URL" | gzip | b2 upload …`. Creds live in the runner's secret store, never in the repo. Retention: 14 daily + 8 weekly. Cost ≈ **$0–1/mo** at current DB size.
- **Agent-doable:** the script + workflow file + a `docs/ops/backup-restore-runbook.md`. **Founder-only:** creating the B2 bucket/key, adding the two secrets, and running the **first restore test** (restore to a scratch Supabase project, verify row counts + RLS present + one JS-SDK query works — the lesson-#96 grants check).
- Acceptance: a dated dump exists off-platform AND a restore drill is logged in STATUS/DECISIONS. Until then GOAL.md §4.9 is violated and the dev DB is a single point of total loss.

### 3.4 The 3 V1 gates — concrete measurement

| Gate | Measured by | Pass threshold |
|---|---|---|
| **1. Telemetry** | `select step_name, sum(ai_calls_made), sum(ai_tokens_used) from pipeline_runs where started_at>now()-interval '24 hours' group by 1` + `GET /api/ops/ai-telemetry` | score AND generate both `ai_calls>0` on every business-hours day for **5 consecutive days**, AND ≥1 verified AI_ZERO_CALL firing during the key-swap window (proves the guard is real, lesson #111 — trust a zero only after the instrument catches a known-true failure) |
| **2. Strict resolution** | (a) `select count(*) from scored_articles sa where not exists (select 1 from categories c where c.id=sa.category_id)` = 0; (b) same shape for `entity_ids[]` vs `entities`; (c) `metadata->>'mangled_ids_dropped'` visible (even as 0) on score runs; (d) `metadata->'validation'` (claims_checked / claims_unvalidated) present on generate runs, `claims_unvalidated=0` on persisted briefs | All four true over the same 5-day window; any invented UUID or unvalidated persisted claim = fail |
| **3. Dogfood** | S7 protocol below | mean(ForgeMinds daily rating) − Pipedream baseline ≥ **+0.5** over 5–7 trading days, ≥2 real decisions/time-saves logged |

### 3.5 S7 dogfood protocol (founder, the V1 verdict)

- **Precondition:** gates 1–2 green ≥5 days; S4 (charts/social/video prompts) + S5 (saved-items destination or buttons hidden) landed — otherwise the comparison vs Pipedream WF1+WF2 is structurally unfair to ForgeMinds.
- **Day 0:** rate the last 5 Pipedream briefs 1–5 (the baseline, written down first). Turn Pipedream WF1+WF2 **OFF**.
- **Daily (5–7 trading days), ≤5 min:** read the ForgeMinds brief on dashboard + email; log to a private `dogfood-log.md`: rating 1–5, "did it surface what mattered today? (miss list)", "did an output get used? (post drafted, chart read, decision made)", every Save/Dismiss/Rate click made naturally.
- **Measured:** mean rating vs baseline; misses count; ≥2 concrete decisions/time-saves; outcome-capture friction notes.
- **Go/no-go:** ≥ +0.5 → V1 verdict PASS → proceed to preview URL + tester recruiting (§7). Between −0.5 and +0.5 → fix the top-3 named misses, re-run 3 days. ≤ −0.5 → stop; re-open the product thesis at GOAL.md altitude with the miss list as evidence (no code before diagnosis).
- Pipedream goes back ON at the first sign the pipeline stalls — the dogfood is a test, not a bet.

---

## 4. Area C — Code / security / safety audit

### 4A. What's clean (verified, with the check used)

| Check | Result |
|---|---|
| Secrets in bundle | `NEXT_PUBLIC_` grep across `src/`: only the Supabase URL + anon key (public by design). No AI key, no service-role, no `VITE_`. ✅ |
| Server-side AI only | All provider calls behind `src/lib/ai/router.ts`, imported only from cron/API routes. ✅ |
| Cron/destructive auth | All 6 cron routes + `/api/ops/ai-telemetry` + `/api/seed` check `Authorization: Bearer CRON_SECRET`. `/api/actions/*` + `/api/onboarding/*` + `/api/settings` use session auth (`getUser()`) + RLS-scoped clients; onboarding has a $0.10/run cost cap. ✅ |
| RLS | 75/75 public tables `relrowsecurity=true` (V8). ✅ |
| Silent catches | Grep for empty `catch {}`: none in `src/`. Catches log with context or rethrow (VIBE 52). ✅ |
| N+1 in cron hot paths | Score uses batch resolve + single upsert; brief page uses `.in()`; no `.from(` inside loops found in cron routes. ✅ |
| Column drift | `verify:columns` exists and was green at d46cac0 (111 sites / 75 tables per that commit's AUDIT GATE — not re-run this session) |
| Buried intelligence (code) | No `*Engine/*Detector/*insight*` module in `src/lib` without a consumer — file-level tripwire clean. (Schema-level is another story: see 4C-7) |
| Worktrees/branches | Single worktree, single branch `master`. ✅ |
| errors-fixed hygiene | ERR-019→029 all logged with root cause + golden rule — genuinely good institutional memory. ✅ |

### 4B. Findings (severity-ordered)

| # | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| C-1 | **CRITICAL** | The entire post-06-15 safety layer (fail-loud, Anthropic-only, substring-validation) is **not live**; the deployed bundle still contains the ERR-029 fabricate-defaults behavior | V3=0, V4=0, V1 all-zero telemetry | Host cutover (§3.2). No code work can substitute |
| C-2 | **CRITICAL** | **No backups** — dev DB is the only environment and only copy; violates GOAL §4.9 + data-protection §2.2 | Founder-confirmed; no backup artifacts in repo/ops | P7 (§3.3) |
| C-3 | HIGH | `public.forgeminds_pg_cron_stats` is SECURITY DEFINER **executable by `anon`** via PostgREST RPC — anonymous internet users can read pipeline/cron operational stats (recon surface) | Advisors: `anon_security_definer_function_executable` (this is NEW vs the 2026-05-04/05 accepted list) | One-line migration: `revoke execute on function public.forgeminds_pg_cron_stats(integer) from anon, authenticated;` (it's an ops introspection fn — service_role only). AGENT-DOABLE |
| C-4 | HIGH | **ERR-025 still open:** `sources.last_fetched_at` NULL on all 15 sources → any "source health" display lies, and source-staleness can't be detected | V9 | Small slice: ingest updates `last_fetched_at` per source on each fetch. AGENT-DOABLE |
| C-5 | HIGH | **ERR-022 half-open:** Save/Dismiss/Act write rows (`article_outcomes`=4) but `saved_items`=0 ever, there is **no /saved surface**, dismissed items are not removed from view, and the sidebar shows 3 dead-grey "Soon" items (Archive/Content/Analytics) | V10 + `sidebar.tsx` + page inventory (no saved/archive route) | S5 slice: a `/saved` page reading `saved_items` + dismiss removes from list + honest locked-copy on the Soon items (GOAL §4.3 forbids vague "Soon"). AGENT-DOABLE |
| C-6 | MEDIUM | `dangerouslySetInnerHTML` renders `summary_html` (AI output) with no sanitizer — currently mitigated by prompt rules + trusted pipeline, but it's one prompt-injection-shaped article away from stored XSS in every user's dashboard **and email** | `briefs/[id]/page.tsx:197` | Add `sanitize-html`/DOMPurify server-side at generate-persist time (single choke point). AGENT-DOABLE, small |
| C-7 | MEDIUM | 68× `auth_rls_initplan` WARNs (per-row `auth.uid()` re-evaluation) + 12× `multiple_permissive_policies` (saved_items, shared_brains) — a real at-scale perf tax on the hottest tables (raw_articles, scored_articles, briefs) | Advisors | Mechanical migration: wrap as `(select auth.uid())` in policies; merge duplicate SELECT policies. Not urgent at 1 user; do before alpha (it's 1 migration). AGENT-DOABLE |
| C-8 | MEDIUM | 36× unindexed FKs + 65× unused indexes | Advisors (INFO) | Post-dogfood cleanup migration; ignore for now |
| C-9 | MEDIUM | **0 deliveries in 7 days** (V12) while `deliver` reports `completed` — same "completed ≠ did its job" family; expected while briefs have NULL html, but there is no fail-loud on deliver-eligible-but-0-sent | V12 | After AI fires, verify delivery resumes; consider a deliver-side warn metric. AGENT |
| C-10 | LOW | `AI_ZERO_CALL` guard covers score+generate only; enrich's NL market read degrades to visible NULL (documented + acceptable), curate/deliver have no AI so fine — but note the ops metric `/api/ops/ai-telemetry` is the only aggregated view and nothing *pushes* an alert (no email/webhook on failure) | 654113d commit body | Post-cutover: a tiny pg_cron watchdog that emails on `failed` streaks ≥3 (or founder checks the ops endpoint daily during soak). EITHER |
| C-11 | LOW | Known accepted advisor findings persist: 3× extensions in public, `track_event`/`upsert_article_outcome` SECURITY DEFINER for authenticated (by design), leaked-password protection (needs Supabase Pro) | Advisors + DECISIONS 2026-05-04 | No action; keep on the accepted list. `forgeminds_pg_cron_stats` (C-3) is NOT on that list — it's new |
| C-12 | LOW | Uncommitted working-tree drift: `.cursor/rules/` disabled, `AGENTS.md.disabled`, modified PENDING_APPROVALS/CHANGELOG/SESSION_DEBRIEF, untracked `CURSOR_HANDOFF.md` + a seeds file | `git status` | One `docs:`/`chore:` checkpoint commit after the founder decides C12 (§2.2) — a review artifact shouldn't sit on a dirty tree |

### 4C. Correctness review of the committed-but-undeployed fixes

Read at HEAD: `scorer.ts` (parse-time input-ID set + UUID-shape drop, `mangledIdsDropped`, no default scores on batch failure), `score/route.ts` (AI_ZERO_CALL throw on work>0∧calls=0; advances `pipeline_status` only for persisted rows; metadata `mangled_ids_dropped/batches_failed/articles_unscored`), `generate/route.ts` (AI_ZERO_CALL; substring-validation via `brief-validation.ts` — numbers ($/%/decimals) + cashtags checked against the exact model input; regenerate-once-then-fail-closed; NULL html re-heals), `router.ts` (Gemini removed from map AND fallbacks; Haiku score / Sonnet generate; grok/perplexity fallbacks land on live Anthropic tiers). **Design is correct and consistent with lessons #104/#105/#111 and ai-native SS4.1 fail-closed.** Two forward-looking notes: (i) the AI_ZERO_CALL error string is matched by nothing downstream — fine, but keep the string stable since the V1 gate-1 query greps it; (ii) `brief-validation` V1 scope excludes bare integers/years and bare (non-cashtag) tickers — documented, acceptable, revisit post-dogfood. **All of this remains unverifiable in production until deploy** — after cutover, gate-2's four queries (§3.4) are the proof.

### 4D. Left-behind / proven-not-wired inventory (the honest orphan list)

- **Schema far ahead of product:** ~75 tables incl. Community Brain (community_embeddings/trends/behavioral_aggregates), Voice DNA (voice_profiles/training_samples), dot_connections, action_plans, trust_levels, shared_brains, event chains, content_drafts/published_items — designed, RLS'd, **zero UI/pipeline consumers**. This is the 51/100 "well-architected vapor" verdict in table form. No action now (correctly gated in IDEAS_BACKLOG), but it explains the advisor noise and is the standing wired-not-orphaned ledger.
- **Actions API without a surface:** `/api/actions/{save,analyze,draft,act,draft/approve}` exist and are well-built; only save/dismiss/rate are reachable from UI (outcome bar); analyze/draft/act have **no button anywhere** → either surface in S5 or leave and say so in the sprint file.
- **`(marketing)` route group is an empty directory** — remove or fill (it reads as an abandoned intention).
- **Deferred keys** (OpenAI embeddings, Perplexity, Grok, Stripe…) correctly parked in BRIEF.md — but note `TASK_MODEL_MAP` still routes `generate-social→grok` and `research→perplexity` whose keys are unprovisioned; fallbacks save it (both land on Anthropic) — fine, documented in router comments. ✅
- **Email E2** (domain, dedicated Resend/CF sending, remove `RESEND_TEST_RECIPIENT`, shared-FinKeel-key SEC item) — correctly tracked in PENDING_APPROVALS; blocked on domain purchase; becomes the launch blocker at GTM time (§7).
- **`docs/ops/` contains 5 stale PS_PROMPT_* one-shot files** — archive to `docs/ops/archive/`.

---

## 5. Areas D + E — Business, competitive, financial + UI/onboarding

### 5A. Competitive position (2026 field, business lens)

| Competitor class | Who | What they have | ForgeMinds' honest position |
|---|---|---|---|
| Big-tech vertical | **Google Finance briefings** (Jun-2026) | Scheduled watchlist-tied personalized market briefs, push, free, mobile, real-time data | **Do not fight on finance-terminal parity.** Wedge: breadth (any vertical, Layer-1), does-the-work outputs (drafts/charts/video prompts vs read-only briefing), learning loop. Already the locked 06-25 DECISIONS position — reaffirmed, still correct |
| DIY automation | Pipedream, n8n, Zapier+LLM | The founder's own benchmark; infinitely flexible, no learning, single-user, brittle | This IS the benchmark. Beating it = the V1 gate. FM's edge: persistence, multi-tenant, outcomes→ranking |
| AI readers | Feedly AI (Leo), Readwise Reader, Artifact-descendants, "AI newsletter" tools (Meco/Zette-likes) | Relevance filtering, summaries, some personalization | They stop at reading. None close the loop outcome→tomorrow's ranking→in-your-voice output. FM's Layer-1 + action outputs are the differentiation IF the learning loop demonstrably works (GOAL §3.4 — currently unproven, 4 outcome rows) |
| Finance terminals | Bloomberg→Koyfin/TradingView tiers | Data depth, charts | Not the market. FM is an intelligence/attention product, not a data terminal |
| Horizontal LLM apps | ChatGPT tasks/pulse-style scheduled prompts, Perplexity finance | On-demand answers, some scheduled digests | No per-user compounding memory-of-outcomes; no source graph. FM's moat thesis holds — but only post-data. Day-one value is copyable by all of these (lesson #109) |

**Defensibility verdict:** the wedge is real but **entirely conditional on the learning loop being observable** (GOAL §3.4). Right now moat evidence = 0 (4 outcomes, 1 user, no Voice-DNA delta). Correct strategy stays: prove day-one value vs Pipedream (dogfood), then prove the delta on 5 strangers (alpha), then talk moat in public.

### 5B. Monthly burn — verified prices, two scales

**Now → dogfood (1 active user):**

| Item | $ / mo |
|---|---|
| Vercel Hobby | 0 (non-commercial OK for dogfood) |
| Supabase Free | 0 (500MB cap — watch raw_articles growth; prune job exists) |
| Anthropic — score: Haiku 4.5 $1/$5 per MTok; at the verified 06-15 volume (~126k tok/day input-heavy, 1 user) ≈ $0.15–0.25/day; generate: Sonnet $3/$15, ~20k tok/day ≈ $0.15/day | **~6–12** |
| Market data: Finnhub free tier, CoinGecko free, Alpaca IEX free, AlphaVantage free | 0 |
| Resend test mode | 0 |
| Backblaze B2 backups | ~0–1 |
| **Total** | **≈ $6–13/mo** (all Anthropic; the prepaid cap makes the ceiling structural) |

**At 1k users (500 weekly-active, default cadence), the naive math breaks:**

| Item | $ / mo | Note |
|---|---|---|
| Anthropic at ~$0.20–0.40/active-user/day naive | **$3,000–6,000** | ⚠️ 3–15× over the GOAL.md band (≤$1.20 Builder) |
| — with per-user cadence caps (1–2 brief cycles/day, score once per cycle, prompt caching on the fixed prompt+catalog blocks, batch API 50%) | **$150–600** ($0.30–1.20/user) | Inside band. **This is a P1 engineering requirement, not an optimization** |
| Vercel Pro (commercial) | 20 + usage | Mandatory at first paid user |
| Supabase Pro | 25 | Needed anyway for PITR + leaked-password toggle before public launch |
| Finnhub/market data paid tier | 0–50 | Free tiers throttle around this scale; watchlist-dedup across users helps |
| Resend | 20 | 50k emails/mo tier |
| Domain + email infra | ~1–2 | E2 |
| **Total at 1k users** | **≈ $220–720/mo** with caps | vs revenue: 5% paid conversion × $14.99 = $750 MRR — breakeven-ish; 10% = $1.5k MRR — healthy |

**ai-first-principles Q3/Q4 verdict:** cost/session with caps ≈ $0.01–0.04 → **must-monetize freemium** (not scalable-to-free at unlimited cadence, not enterprise-only). The free Explorer tier MUST be cadence-capped (3 briefs/wk as the landing page already promises) or it burns tokens for non-payers.

**First-dollar path:** dogfood pass → free closed alpha (5 users, invite-code, $0) → alpha green light (GOAL §2.6) → domain + Email E2 + Vercel Pro + Supabase Pro + Stripe (~$70/mo fixed) → switch Builder $14.99 on with a founders'-discount for alpha users. Do not wire Stripe before alpha green (CURRENT_SPRINT 2.3 already says this — reaffirmed).

### 5C. Pricing-page honesty audit (business+trust lens)

The landing page currently **sells features that don't exist** at any tier: "Dot Connector", "Voice DNA (web upload)", "Trust Escalation (auto-publish)", "Deep research on demand", "API access", "Collective Brain priority", "podcast scripts". Per lesson #100/#44 (the "AI as marketing copy" trap) and GOAL §4.3, this is the exact trap the rules name. **Fix before ANY stranger sees the URL** (it's a P1, cheap): reframe the tier cards to what V1.1 actually ships (personalized daily brief, watchlist market data, save/rate loop, email delivery) and move the rest to an explicit honest "On the roadmap — unlocks as the learning loop matures" block. Draft copy in §6.4.

### 5D. Cost-control engineering items promoted by this audit

1. **P1:** enforce per-user brief cadence from `user_preferences` as a hard AI-spend gate (score runs per cycle, not per tick-with-new-articles); free tier = 3 cycles/wk.
2. **P1:** Anthropic prompt caching on the static prompt preamble + interest block (~50–90% input savings on score).
3. **P2:** batch API for overnight scoring (50% off) where latency doesn't matter.
4. **P2:** per-user daily token budget column + refuse-with-visible-notice past it (the router has no per-user cap today; GOAL §3.3 requires caps that "actually trip").

### 5E. UI / design / onboarding findings (personal lens)

| # | Severity | Finding | Fix |
|---|---|---|---|
| U-1 | **CRITICAL (UX)** | The product's home surface (`/dashboard`) is a raw headline feed (`raw_articles`, no scores, no brief, no market data). The actual product (the brief) hides one level down at `/briefs`. Violates VIBE 43 (dashboard intelligence early) and undersells the entire pipeline | Make `/dashboard` lead with today's brief (or its locked/pending state) + watchlist strip; demote the raw feed below or to its own tab. AGENT, medium |
| U-2 | HIGH | Sidebar: 3 of 7 items are grey "Soon" stubs; no Saved/Brain destination exists while Save buttons write to it | S5: add `/saved`; replace "Soon" with honest locked copy or remove (GOAL §4.3) |
| U-3 | HIGH | Brief page shows "Summary pending … runs every 30 minutes" **every day for 19 days** — an honest string that has become a lie through repetition; no staleness escalation | After fail-loud is live this self-heals; still add: if brief >6h old with NULL html, say "generation is delayed — we're on it" (distinct from fresh-pending) |
| U-4 | MEDIUM | Landing page: pricing/features honesty (5C); copy is decent but text-only — zero product visuals; "Multi-Model Intelligence" card names Gemini-era architecture ("Gemini for speed") | §6.4 rework: one hero screenshot of a real brief + market strip (show-don't-tell), fix the models card, honest tiers. There are no separate tutorial/instruction pages beyond onboarding (the "text-heavy tutorials" concern mostly resolves to the landing + onboarding wizard) |
| U-5 | MEDIUM | Onboarding is genuinely good (single free-text intake → AI proposals; honest catalog-locked state; cost-capped) — but post-confirm the user lands with default cadence and no "your first brief arrives ~X" expectation set | Add a post-confirm expectation line + first-brief push/email; hostile-second-user test (GOAL §3.2) remains unrun — schedule it in alpha prep |
| U-6 | LOW | Outcome bar has optimistic UI + revert + a real provenance tooltip (excellent, data-citizenship-compliant); rating exists. Dismiss doesn't remove the card from the list (ERR-022 residue) | Fold into S5 |
| U-7 | LOW | Design-system lock: no `design-system.json` in repo root (design-system.md SS1 says no screen without a lock) — the app uses consistent shadcn/zinc conventions but the lock artifact + Visual-QA screenshot discipline don't exist | Post-dogfood: write the lock from the de-facto system; don't block the critical path on it |

---

## 6. Concrete proposed edits (drafts for the executor — apply only after founder approval)

### 6.1 `CURSOR_HANDOFF.md` — banner (insert at line 2)

```markdown
> **🔴 SUPERSEDED IN PART — 2026-07-03.** §3 (status table), §4 (ERR-028 as THE blocker + S3.2-first), and §10 are STALE.
> Live truth (verified vs dev DB 2026-07-03): ERR-028's failure loop is gone and its fix is COMMITTED (654113d);
> the live blocker is **ERR-029 + host cutover** — the deployed Cloudflare bundle predates every fix since 06-15 and
> makes 0 AI calls while reporting completed. Current plan: `docs/reviews/2026-07-03-comprehensive-review.md` §3.
> Read this file only for: philosophy (§1), product shape (§2), env/security rules (§6), free-URL options (§7).
```

### 6.2 `.claude/CLAUDE.md` — Stack section replacement

```markdown
## Stack
Next.js 16 (App Router) · Tailwind v4 · shadcn/ui new-york · Supabase Postgres + Auth + pg_cron + pg_vector
(the host-independent "brain") · **App host: Vercel (Hobby now, Pro at first paid user) — decided 2026-07-XX,
DECISIONS.md; previously Cloudflare Workers (failed, ERR-026) and Railway (rejected, free tier discontinued).**
Email via Resend (test mode until E2 domain). Stripe: NOT wired (post-alpha). AI: **Anthropic-only core loop**
(Haiku 4.5 score/categorize · Sonnet 4.6 generate) via `src/lib/ai/router.ts`; Gemini retired 2026-07-02
(DECISIONS.md); Grok/Perplexity/OpenAI-embeddings deferred (keys unprovisioned, fallbacks land on Anthropic).
```

### 6.3 `DECISIONS.md` — host entry template (founder fills the date/URL on cutover day)

```markdown
## 2026-07-XX — App host: Vercel (supersedes 2026-06-14 Railway decision)
**Decision:** Deploy the Next.js app to Vercel (Hobby during dogfood/closed alpha; Pro $20/mo mandatory at first
commercial use per Vercel fair-use). `private.app_config.forgeminds_base_url` → https://forgeminds-<x>.vercel.app.
Supabase remains the host-independent brain; the host stays swappable (Fly.io/Render fallbacks priced in review §3.1).
**Why:** Railway discontinued its free tier (2026-07-01 note, CURRENT_SPRINT S6). Vercel is Next.js-native (no
OpenNext layer = ERR-026 class removed), 300s maxDuration covers the 120s routes, pg_cron does all scheduling so
Hobby's 1/day cron limit is irrelevant, dispatcher volume (~260k invocations/mo) fits the 1M free allowance.
**Caveat (accepted):** Hobby is non-commercial-only — Pro upgrade is a launch-day line item, tracked in the GTM
checklist. **Rejected:** staying on Cloudflare (ERR-026, proven), Railway paid (~$5-10/mo for zero advantage over $0).
```

### 6.4 Landing page rework sketch (`src/app/page.tsx`) — structure, not final code

1. **Hero:** keep headline; add one real product screenshot (brief + market strip) — show-don't-tell; sub-headline sharpened to the wedge: "A daily brief on anything you care about — that drafts the post, reads the market, and learns what you act on."
2. **Features grid:** cut 6 cards → 4 that exist (Personalized Daily Brief · Live Market Context · Act On It [save/rate→sharper tomorrow] · Your Data, Exportable). Fix "Multi-Model Intelligence" (Gemini reference is stale; AI is Anthropic-consolidated — don't name vendors on the landing page at all).
3. **Pricing:** keep 3 tiers + prices; per-tier bullets reduced to shipped-truth; single roadmap block underneath: "Coming as the learning loop matures: Voice DNA · Dot Connector · Audio briefs · API" (honest, no per-tier fake gating).
4. **Footer:** add Privacy/Terms/AI-disclosure links (compliance §6 requires them at signup — they don't exist yet; stub pages are a P1-before-alpha item).
5. Delete the empty `(marketing)` route group or move this page into it.

### 6.5 One-line security migration (C-3)

```sql
-- 20260703_revoke_pg_cron_stats.sql
revoke execute on function public.forgeminds_pg_cron_stats(integer) from anon, authenticated;
-- ops introspection is service_role-only; advisor 'anon_security_definer_function_executable' clears
```

### 6.6 `errors-fixed.json` ERR-028 status line

```
"status": "FIXED in code 2026-07-01 (654113d — parse-time input-id validation folded into the ERR-029 slice);
failure loop NOT reproducing live since ~06-30 (raw_articles fetched=4 on 07-03); production verification pending
the host cutover; per-row upsert isolation deliberately not built unless mangled_ids_dropped>0 telemetry justifies it"
```

### 6.7 PENDING_APPROVALS — recommended verdicts on the 5 open Self-Reflection proposals (2026-06-14)

| Proposal | Recommendation | Why |
|---|---|---|
| 1. Rule 35 / execution.md: add runtime-truth gate (`ai_calls>0` + human dogfood) to DoD | **APPROVE** — this review is the second time the gap bit (ERR-019, then ERR-029). Wording: add gate (6) "runtime telemetry proves the core inference fired in production + one human-rated real output" | |
| 2. Rule 24: strict-resolution-to-DB-UUID (flag-don't-insert) | **APPROVE** — implemented in code (category/entity resolvers, scorer parse-guard); promote to rule so the next project starts with it | |
| 3. GOAL.md §6: add the dogfood-gate line | **APPROVE** — one line, aligns the bar with lesson #107 | |
| 4. Project CLAUDE.md stack → "Railway + Supabase" | **APPROVE THE INTENT, REJECT THE WORDING** — apply §6.2 (Vercel) instead; the proposal text predates Railway's free-tier removal | |
| 5. Promote lessons #104–110 to factory archive | **APPROVE** — they're already battle-validated twice in this one project | |
| (also in the file) Email-E2 checklist | Keep OPEN, blocked-on-domain — correct as-is. The signal-auto entries (REWORK×3, SECURITY×1 etc.): mark reviewed; the 06-14 REWORK trio was the drawing-board reset itself | |

---

## 7. Prioritized backlog + launch-readiness + GTM

### 7.1 Backlog (P0 blocks a trustworthy live V1 · P1 before external users · P2 post-proof)

| # | Item | Owner | Effort | Acceptance test |
|---|---|---|---|---|
| **P0-1** | Vercel cutover: deploy HEAD + env vars + `forgeminds_base_url` flip (§3.2) | **FOUNDER** | 1–2 h | `pipeline_runs` shows AI_ZERO_CALL `failed` (if a key is wrong) then `completed` with `ai_calls_made>0`; brief flips to `claude-*` with real HTML |
| **P0-2** | 48-h soak verification battery (gates 1+2 queries, §3.4) + write results into CURRENT_SPRINT | AGENT | 1 h + wait | All gate-1/2 queries pass; one provoked AI_ZERO_CALL observed |
| **P0-3** | P7 backup: script+workflow (agent) / bucket+secrets+first restore drill (founder) (§3.3) | BOTH | 2–3 h | Off-platform dated dump + logged restore drill |
| **P0-4** | Stale-doc purge C1–C9 + DECISIONS host entry + checkpoint commit of the dirty tree | AGENT (drafts §6) + FOUNDER (C12 call) | 1 h | No doc instructs work the DB disproves |
| **P0-5** | S7 dogfood week (§3.5) — after P0-1..4 + P1-1/P1-2 | **FOUNDER** | 5–7 d × 5 min | ≥ +0.5 vs Pipedream logged |
| **P1-1** | S4 — WF2 parity: charts from `ticker_data.intraday_json` (Recharts web / QuickChart email) + social drafts + video prompts | AGENT | 2–3 slices | Brief page + email show a real chart; a social draft renders with prompt_version; founder confirms WF1+WF2 parity |
| **P1-2** | S5 — saved-items destination + dismiss-removes + analyze/draft/act surfaced-or-hidden + honest "Soon" copy (C-5, U-2, U-6) | AGENT | 1–2 slices | Dead-button QA test 13 passes on every visible control |
| **P1-3** | Dashboard leads with the brief (U-1) | AGENT | 1 slice | First screen after login shows today's brief or its honest pending state |
| **P1-4** | Landing honesty rework (§6.4) + Privacy/Terms/AI-disclosure stub pages linked at signup | AGENT (copy) + FOUNDER (attorney note: closed-alpha DECISIONS entry per GOAL §3.5) | 1 slice | No claimed-but-unbuilt feature above the fold; compliance links exist |
| **P1-5** | Security/hygiene migration batch: C-3 revoke, C-4 `last_fetched_at`, C-6 sanitizer, C-7 RLS initplan+policy merge | AGENT | 1–2 slices | Advisors: no anon-DEFINER finding; sources timestamps update; sanitizer unit test |
| **P1-6** | Cost caps: cadence-as-spend-gate + prompt caching (§5D 1–2) | AGENT | 1–2 slices | Token/day per user bounded; verified in telemetry |
| **P1-7** | Onboarding stranger-run + first-brief expectation line (U-5); hostile-second-user test | FOUNDER-recruited stranger + AGENT fixes | ½ d | GOAL §3.2 items pass without operator SQL |
| **P2-1** | Email E2 (domain purchase → CF Email/dedicated Resend → remove test-recipient scaffold + shared-key SEC fix) | FOUNDER + AGENT | ½ d + DNS wait | PENDING_APPROVALS checklist all green |
| **P2-2** | Closed alpha per CURRENT_SPRINT 2.4–2.6 (5 strangers, 4 weeks, measured Voice-DNA delta) | FOUNDER + AGENT | 4 wks | GOAL §2.6 green/yellow/red decision logged |
| **P2-3** | Stripe + Vercel Pro + Supabase Pro + pricing switch-on | FOUNDER | 1 d | First real payment against the honest tier |
| **P2-4** | Advisor perf cleanup (C-8), design-system.json lock (U-7), deliver watchdog (C-10), ops alert push | AGENT | rolling | Advisors <20 findings; lock committed |

### 7.2 "We are launch-ready when …" checklist

- [ ] Gate 1: 5 consecutive business days `ai_calls>0` on score+generate, and AI_ZERO_CALL proven to fire on a bad key
- [ ] Gate 2: zero invented UUIDs + substring-validation metadata on every persisted brief (4 queries §3.4)
- [ ] Gate 3: dogfood ≥ +0.5 vs Pipedream, logged
- [ ] Off-platform backup running + one restore drill logged
- [ ] No dead UI (QA test 13); saved-items destination live; dashboard leads with the brief
- [ ] Landing/pricing claims = shipped truth; Privacy/Terms/AI-disclosure linked at signup; closed-alpha attorney-deferral noted in DECISIONS
- [ ] Email E2 done (own domain, own key) — **the E2 domain purchase is the single hard launch blocker on the GTM side**
- [ ] Vercel Pro + Supabase Pro active (commercial use + PITR + leaked-password toggle)
- [ ] Per-user cost caps verified tripping; free tier cadence-capped
- [ ] GOAL.md §6 shippable-gate block satisfied (composite ≥70 re-scored after alpha)

### 7.3 GTM plan (sequenced; nothing before its gate)

**Do NOW (parallel to engineering, $0):** write the positioning one-pager — "Google Finance reads you a briefing. ForgeMinds works for you: any topic, drafts in your voice, gets sharper every time you act." Anti-slop voice rules apply (no "revolutionize/seamless/supercharge"). Draft the 5 personal alpha-invite messages (finance person, writer, researcher, developer, strategist — per CURRENT_SPRINT 2.4). Buy nothing yet.

**Do at dogfood-PASS:** buy the domain (unblocks E2 + real email + a non-vercel.app URL), recruit the 5 alpha users via personal outreach (favor-framing, expectations doc, free forever-founders tier), share the vercel.app preview behind an invite code, wire the feedback path (one `feedback` table + form — don't overbuild).

**Do at alpha-GREEN:** pricing on (Builder $14.99 first; Architect later), founder-story launch post ("I replaced my own $30/mo Pipedream pipeline and then made it learn") on X + HN Show + r/productivity-adjacent subs — the founder's authentic-builder voice, not ad spend; Product Hunt only after ≥20 organic users; paid ads not before 500 organic + CAC<$20 (consulting.md rule). Track only GOAL §5 metrics (loops/user/week, cycle completion, DNA delta) — signups are vanity.

**Never:** market the moat before the moat has data; promise Voice DNA/Community Brain in acquisition copy while GOAL §3.4 is false.

---

## 8. Area F — MD / skills / agents / goals alignment (drift list)

| Artifact | Drift | Action |
|---|---|---|
| `.claude/CLAUDE.md` | Stack line 3× stale (host, Gemini, Haiku-for-briefs) | §6.2 — APPROVE |
| `CURSOR_HANDOFF.md` / `NEXT_SESSION.md` §§5–13 | Command disproven work (ERR-028-first) | §6.1 banner + history-collapse |
| `BRIEF.md` | Multi-model stack line + Railway-target registry header | C6 edit |
| `DECISIONS.md` | Ends on rejected Railway; no host successor entry | §6.3 template ready |
| `errors-fixed.json` ERR-028 | "PENDING, fix not applied" — false | §6.6 |
| `PENDING_APPROVALS.md` | 5 rule proposals open since 06-14 | §6.7 verdicts — founder approves |
| `GOAL.md` | Sound and load-bearing; only §5 cost band needs reconciling with 5D caps decision; §6 gains the dogfood line (approved proposal 3) | Minor |
| `CURRENT_SPRINT.md` | Accurate on S3.2/S3.3; Phase-2 lower half is legacy-but-labeled | C4 one-liner |
| Factory rules vs behavior | RLS ✅, prompt_version ✅, content_hash ✅, CRON_SECRET ✅, money-BIGINT ✅ (price_cents), snake/camel ✅, no NEXT_PUBLIC secrets ✅. Violations: VIBE 51 dead-UI (C-5), VIBE 43 dashboard (U-1), honest-strings on the landing tiers (5C), GOAL §4.9 backups (C-2) | All in backlog |
| `.claude/agents` + skills | source-catalog-curator/validator agents match reality (catalog 218 ✓); factory-promotion of the two agents still pending (06-06 harvest note) | Post-dogfood |
| `.cursor/rules` disabled + `AGENTS.md.disabled` (uncommitted) | Rule mirrors off with no decision record | C12 — founder call |

---

## 9. OPEN QUESTIONS FOR THE FOUNDER (only you can answer)

1. **Host:** approve Vercel Hobby now + Pro-at-launch (§3.1)? (If yes, §3.2 is your ~90-minute checklist; §6.3 is the DECISIONS entry to date-stamp.)
2. **When** will you run the cutover + key placement? Every other workstream is time-blocked behind it.
3. **Backup storage:** Backblaze B2 OK (needs your account + 2 secrets), or prefer S3/GCS?
4. **The 5 rule proposals** in PENDING_APPROVALS (§6.7): approve/reject each — recommendation is approve 1,2,3,5 and approve-with-new-wording 4.
5. **`.cursor/rules` disabled + AGENTS.md.disabled:** intentional and to be committed, or restore?
6. **Landing pricing honesty (5C/§6.4):** OK to strip unshipped features from tier cards into a roadmap block before any tester sees the URL?
7. **Free-tier economics:** confirm Explorer = 3 brief-cycles/week hard cap (it's the landing promise AND the cost survival requirement, §5B/5D).
8. **Dogfood scheduling:** which 5–7 trading-day window, and do you accept the Day-0 baseline-rating protocol (§3.5)?
9. **Alpha recruits:** do the 5 archetype candidates (2.4) exist in your network today, or does recruiting need to start during the dogfood week?
10. **Attorney posture:** confirm closed-alpha operation pre-attorney-review with the explicit DECISIONS entry GOAL §3.5 requires (needed before P1-4 ships the stub ToS/Privacy pages).
11. **Cloudflare teardown:** after 48h clean on Vercel, OK to delete the Worker's secrets (incl. retired `GEMINI_API_KEY`) and revoke the stale `finkeel-cli-mcp-2026-06` Supabase token flagged in BRIEF.md?

---

*Review complete. No `src/` files were edited; no commits were made. The only file written is this report. — Fable, 2026-07-03*
