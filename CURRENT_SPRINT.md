# ForgeMinds — Current Sprint

> **Standing rule:** This file is the active path. The bar is in `GOAL.md`. The parking lot is in `IDEAS_BACKLOG.md`. The history is in `DECISIONS.md`. Don't re-litigate the bar here — point at GOAL.md if pressure builds.

---

## 🔁 2026-06-14 DRAWING-BOARD RESET — supersedes the Phase 2 plan below

The active path is now the founder-APPROVED finance-core V1 in
`docs/architecture/forgeminds-v1-finance-core.md` (Appendix B slices S1→S7).
The Phase 2 closed-alpha content below remains valid intent but is paused
behind the slice sequence (S7 = the dogfood/alpha week).

**Slice status (build in thin, founder-reviewed slices):**
- [x] **S1 — Make the AI fire + telemetry gate** — DONE 2026-06-14, pending founder review.
  - Verified diagnosis: generate DID fire (claude) but curate re-runs clobbered its `generation_model` → 'heuristic' (mislabel), and `ai_calls_made`/`ai_tokens_used` were never written (telemetry invisible). Dispatcher also stalled after 06-13.
  - Fixes: curate seam (no clobber); telemetry columns written on score+generate; fail-loud 0-AI-call watchdog; `GET /api/ops/ai-telemetry`.
  - Proof (dev, user 3707759d, 06-14): score 1582 tok + generate 1830 tok today; brief `generation_model=claude-sonnet-4-6`. Commits `fce39ef` + `3af7400`.
- [x] **S2 — Finance personalization + strict category resolution + cross-brief dedup** — DONE 2026-06-14, pending founder review.
  - Strict resolution (ERR-021): `categories` table (13 canonical + `uncategorized`) + `category-resolver.ts`; score writes the resolved slug + `category_id`, never the old hardcoded `core`; misses → `uncategorized` (review), never invented. Migration `20260614000000` (advisors clean).
  - Personalization (ERR-020): `loadPrefs` reads topics/tracked_tickers/excluded_topics; scorer scores a real per-user `relevance_score`; test user seeded (7 topics / 11 tickers / 4 excluded). Also fixed gemini-2.5-flash thinking eating the JSON budget (scoring had been silently defaulting).
  - Cross-brief dedup (ERR-024): curate excludes articles from the user's prior briefs.
  - Proof (dev, user 3707759d): 14 real categories (was 1); brief leads with SpaceX $1.78tn float (finance), finance/AI/macro rel 8-10, sports/royals rel 1; cross_brief_overlap=0; score+generate ai_tokens today >0. Commits `3025e82` + `498fef2`.
  - **Deferred to S3** (entity layer belongs with tickers/market): ticker/entity UUID resolution into the empty `entities` table (scored_articles.tickers/entity_ids still unwritten). Personalization uses ticker TEXT in the scoring prompt, which is sufficient for S2's relevance.
- [x] **S3 — Enrich: ticker/entity resolution + market data + NL interpretation + intraday** — DONE 2026-06-15, pending founder review.
  - Strict ticker/entity resolution: seeded 14 entities + 22 aliases; scorer extracts tickers[]; `resolveOrCreateTicker` (symbol canonical→create, malformed→skip, never invent); scored_articles.tickers/entity_ids written; curate aggregates → briefs.ticker_symbols.
  - Market data: `market-data.ts` (Finnhub quote+profile2+metric, CoinGecko crypto, Alpaca IEX intraday); enrich enriches tracked ∪ story tickers, cost-guarded; rich ticker_data + intraday_json filled. Migration `20260615000000` (advisors clean).
  - NL market read: cheap gemini call → ticker_data.interpretation + prompt_version (market-read-v0.1); generate weaves real ticker/price/52w/PE + the read into finance stories.
  - Proof (dev, user 3707759d): 11/11 tracked enriched (AAPL P/E 34.9, TSLA +1.82% P/E 395, BTC $66.8k +3.9%); 9 intraday; 11 NL reads; brief story reads "TSLA closed at $406.43, up 1.82%… SPY $741.75 and QQQ $721.34 near 52-week highs"; score/enrich/generate ai_tokens all >0. Commits `abb0648` + `fd0a83c` + `c464a43`.
  - **Honest limit:** scored_articles.tickers populated for only 1 story this run — the source pool is world/macro news that rarely names a public ticker; the brief's market read is carried by the always-enriched tracked watchlist (correct design). A finance-source-weighted ingest (source-quality loop) is the lever for more story-level tickers.
- [~] **S3.1 — Stabilize unattended execution** — code DONE; **Desktop-verified 2026-06-15 vs live DB: sweep + fail-loud + telemetry PASS, but a CRITICAL blocker surfaced (ERR-028)**; **Railway deploy is a founder action (pending)**.
  - Root cause confirmed (live DB): dispatcher invokes the Cloudflare Workers host (ERR-026) which kills heavy AI routes mid-run → 3 score runs dangling in `status='running'`. The serial N+1 in score made it worse.
  - Fixes (host-independent): batch score (resolveOrCreateTickersBatch + one upsert; bad AI ids filtered; throws→`failed` never dangles); pg_cron `forgeminds_sweep_stale_runs` (*/5) heals dangling `running` rows from the DB even if the app host is dead; curate brief-consistency invariant (changed set → reset stale Claude summary to placeholder → generate re-heals).
  - PS proof (dev, point-in-time): score `completed` (not running), 92 scored in one batch, ai_tokens>0; sweep cleared the dangling rows; invariant reset a Claude-summary-on-mismatched-set → generate re-upgraded to claude-sonnet-4-6.
  - **Desktop independent verification (2026-06-15, live DB):** ✅ sweep live (`private.sweep_stale_pipeline_runs`, pg_cron `*/5`) — demonstrably healed the 3 dangling 13:34/14:05/14:36 runs → `failed [swept]`; ✅ no dangling `running` (durations dropped 3.8M ms → ~65K ms); ✅ telemetry real (today score ai_tokens 126,211 / 30 calls, generate 19,552); ✅ curate→generate consistency (1 heuristic cold-start brief, 0 empty-HTML orphans).
  - **❌ CRITICAL BLOCKER (ERR-028) — headline goal NOT met:** unattended `score` fails ~every tick on the live (Cloudflare) host — ~10 consecutive ticks 14:40–14:51 failed `invalid input syntax for type uuid: "284354a-…"`. Proven: the Gemini scorer emits a *corrupted* copy of a real article id (real `2843554a-…`, one hex char dropped); S3.1's `validArticleIds.has` guard isn't stopping it on the host, and one bad uuid rejects the all-or-nothing batch → 0 articles advance → 139 stuck in `fetched` → failure loop. The pipeline no longer *hangs*, it now *fails every score tick*. → **S3.2 must land before the dogfood.**
  - **Pending (founder):** the actual Railway deploy + env vars + `UPDATE private.app_config ... forgeminds_base_url` cutover — runbook at `docs/ops/railway-cutover.md`. Agent can't deploy (no Railway creds/secrets). Also resolves the stale-Cloudflare-deploy hypothesis under ERR-028. Commits `3a208ce` + `8ae95a9` + `d6fa974`.
  - **Now-due:** P7 off-platform backup (architecture §6) once on the new host.
- [x] **S3.2/S3.3 — Fail-loud on zero AI calls + scorer id-hardening (ERR-029 + ERR-028 layer-1)** — BUILT 2026-07-01 (desktop session, write-lock held), pending founder review + host activation.
  - **Live-DB verification 2026-07-01 rewrote the priority (lesson #108):** ERR-028's failure loop was NOT reproducing (score: 91/91 runs in 72h, 0 uuid failures) — but ALL steps showed `ai_calls_made=0` while reporting `completed`. The host's Gemini/Anthropic secrets were dead (stale + the 07-01 key rotation): for ~16 days the pipeline shipped heuristic default-scored briefs as green runs. Logged as **ERR-029** (inverse twin of ERR-019).
  - Fixes (additive, tsc+lint clean): `scorer.ts` — no fabricated default scores on batch failure (failed batches contribute nothing; articles stay `fetched` + retry, bounded by lookback) + parse-time drop of AI-returned ids not in the input batch / not UUID-shaped (`mangledIdsDropped` — the S3.2 layer-1 defense, folded in); `score/route.ts` — throws `AI_ZERO_CALL` → `status='failed'` on work>0 + 0 AI calls, advances `pipeline_status` ONLY for persisted rows, metadata gains `mangled_ids_dropped`/`batches_failed`/`articles_unscored`; `generate/route.ts` — throws `AI_ZERO_CALL` on attempts>0 + 0 successes (briefs re-heal next tick).
  - **ACTIVATION (founder, 2 steps):** (1) put the NEW `GEMINI_API_KEY` + `ANTHROPIC_API_KEY` into the live host secrets; (2) deploy this bundle. Until both land, the OLD silent code runs live. Verify after: `pipeline_runs` flips to `failed AI_ZERO_CALL` (if keys dead) then `completed` with `ai_calls_made>0` (keys live).
  - Original S3.2 batch-resilience remainder (per-row upsert isolation) NOT built — parse-time validation + the existing route filter make it moot unless ERR-028 resurfaces with `mangled_ids_dropped>0` telemetry to prove it.
- [ ] S4 WF2 outputs (charts from intraday_json + social drafts + video prompts) · S5 action+saved-items · S6 host cutover (founder — Railway decision reopened 2026-07-01: Railway killed its free tier; Vercel Fluid Compute now also solves ERR-026 at $0 — pick before deploy) + P7 backups · S7 dogfood week.

**Known still-open (not S1 scope):** dispatcher restart on a working host (S6 Railway; Cloudflare deploy is broken per ERR-026), empty personalization (S2), single 'core' category (S2), `sources.last_fetched_at` never updated (ERR-025 ops follow-up).

---

## 🟢 ACTIVE PHASE — Phase 2: PROVE THE LOOP (closed alpha)

**Locked:** 2026-05-16 (re-scoped from earlier "Phase 2: Pipeline End-to-End" after the 51/100 strategic audit)
**Theme:** Stop designing. Get 3-5 real strangers using ForgeMinds for 4 weeks. Measure whether the core flywheel (outcomes → Voice DNA → ranking) actually spins on people who aren't Victor.
**Definition of done:** All five §3.1 claims in `GOAL.md` are simultaneously true. Specifically: ≥5 external alpha users × 4 weeks × ≥10 outcomes each × measured Voice-DNA-ranking delta of ≥+10 percentile-points for at least 3 of them × at least 1 action outcome logged × at least 1 Community Brain k=5 hit.

**What this is NOT:**
- A "build the pipeline" phase. The pipeline is INFRASTRUCTURE to enable the alpha, not the goal.
- A "more features" phase. Features lock to alpha-supporting minimum.
- A "polish" phase. Polish is post-proof.

---

### Phase 2 sub-phases (gated; no skipping)

#### 2.0 — Strategic checkpoint commit (this sprint)

**Goal:** Lock the higher bar in artifacts so it survives pressure.

- [x] `GOAL.md` written — composite scorecard 51/100, target ≥70/100 before any V1 ship-related decision
- [x] `IDEAS_BACKLOG.md` written — sequenced T0/T1/T2/T3/T4 with explicit unlock gates
- [x] `CURRENT_SPRINT.md` re-scoped to alpha-prove-the-loop (this file)
- [ ] `DECISIONS.md` entry for 2026-05-16: "Phase 2 re-scoped from pipeline plumbing to closed alpha. Composite scorecard 51/100. Target ≥70/100 before V1."
- [ ] Single strategic-checkpoint commit: `docs(phase-2): lock the bar — closed-alpha refocus + ideas backlog + scorecard 51/100`

Hard gate: nothing in 2.1+ begins until 2.0 is committed.

---

#### 2.1 — Minimum pipeline for alpha (NOT the full pipeline)

**Goal:** The thinnest possible pipeline that lets an external user receive 1 brief, capture outcomes, and contribute to Voice DNA.

**Five hard requirements (no more, no less):**

1. **Ingest fires for users who have sources** — `/api/cron/ingest` dispatcher pulls articles from a user's configured sources. Only invokes per-source-type fetchers the user actually has rows for. (lessons.md #98 already addressed.)

2. **Scoring produces a composite_score** — Gemini Flash scores articles 0-1 against user profile + intent. NOT all 10 modules. NOT Voice DNA yet. Just baseline scoring.

3. **Curation picks top N** — `max_articles_per_brief` from `user_preferences`. Density caps respected.

4. **Brief generated + persisted** — One `briefs` row per cycle. HTML + plain text. Includes `prompt_version`.

5. **Brief delivered to dashboard** — `/dashboard` shows it. No email yet (email is 2.3 polish). No fancy enrichment (Phase 3+).

**Five hard requirements that are EXCLUDED from 2.1:**

- ❌ Email delivery (Resend) — deferred to 2.3
- ❌ Voice DNA integration in scoring — that's what the alpha tests
- ❌ Action engine — Phase 3
- ❌ Brain features — Phase 4+
- ❌ Community Brain — Phase 8

**Gate to enter 2.2:** A non-Victor user can complete a brief cycle end-to-end without intervention. Verified by a real test (e.g., Victor's friend signs up, sees their first brief within their configured cadence, without Victor SQL-ing anything).

---

#### 2.2 — Outcome capture UI (T0.1 from IDEAS_BACKLOG)

**Goal:** Save / dismiss / rate UI on `/briefs/[id]` wired to `upsert_article_outcome` RPC. Sub-30-second friction.

- [ ] `<OutcomeButtons>` component per article (save / dismiss / "took action")
- [ ] `<RatingChip>` 1-5 stars + worth-it boolean
- [ ] Optimistic UI (no spinner; revert on error)
- [ ] `behavioral_events` fan-out happens server-side via the RPC (already wired in `upsert_article_outcome`)
- [ ] `compliance_audit_log` writes for every outcome event (per `compliance.md` §7)
- [ ] DMG-aware visibility: outcome counts visible to user ("3 outcomes captured this week")

**Gate to enter 2.3:** Outcome capture takes < 5 seconds per article on first try by a stranger. Tested by a real non-Victor user.

---

#### 2.3 — Alpha-readiness polish (the minimum to NOT embarrass)

**Goal:** A fresh signup → first brief → outcome capture loop that doesn't require any operator hand-holding.

- [ ] Brief email delivery via Resend (transactional). Per `email-deliverability.md` SPF/DKIM/DMARC first.
- [ ] Account deletion endpoint actually wipes data (per `compliance.md` §8 DSR)
- [ ] Data export endpoint returns valid JSON
- [ ] Hostile second-user test pass: complete §3.2 from `GOAL.md` against a recruited stranger
- [ ] Compliance audit log populated for every regulated event
- [ ] Off-platform backup (T0.4) running daily + first restore drill done
- [ ] Pre-launch QA matrix 15-test pass (per `hostile-architect.md`)
- [ ] Stripe NOT wired yet — alpha is invite-only and free

**Gate to enter 2.4:** §3.2 (hostile second user) and §3.5 (compliance posture) from `GOAL.md` are TRUE.

---

#### 2.4 — Alpha recruiting (no code, all human)

**Goal:** 3-5 external users with skin in the game commit to a 4-week alpha.

- [ ] Identify candidates from Victor's network. Target diversity:
  - 1 finance person (testing tickers, earnings, M&A categories)
  - 1 journalist / writer (testing voice DNA on long-form)
  - 1 researcher / academic (testing scientific journal sources)
  - 1 developer / product person (testing tech sources)
  - 1 strategist / consultant (testing cross-category synthesis)
- [ ] Personal outreach by Victor (NOT a marketing site — this is "would you do me a favor")
- [ ] Each user signs a one-page expectations doc:
  - 4 weeks minimum usage
  - Capture ≥ 10 outcomes per week
  - 30-minute exit interview
  - Their data stays theirs; opt out anytime
- [ ] Track recruiting in a private `alpha-users.md` (NOT committed; sensitive data)

**Gate to enter 2.5:** ≥3 users confirmed and onboarded. Personal accounts on the dev project (NOT prod yet).

---

#### 2.5 — Alpha run (4 weeks of patience)

**Goal:** Let the data accumulate. Resist the urge to ship features.

- [ ] Weekly check-in with each alpha user (15 min, voice or async)
- [ ] Weekly metric snapshot to `alpha-metrics.md` (private):
  - Outcomes captured per user
  - Save/dismiss ratio per user
  - Edit / correction count per user
  - Voice-DNA-ranking delta (week-N vs week-1) per user
  - Bug reports + UX friction notes
- [ ] Bug fixes — yes; new features — no
- [ ] Voice DNA still being captured passively (edits, dismissals, save patterns) but NOT yet driving ranking
- [ ] At end of week 4: a Voice-DNA-on / Voice-DNA-off A/B is presented to each user, blinded

**Gate to enter 2.6:** 4 weeks elapsed. Real data exists.

---

#### 2.6 — Delta measurement + go/no-go decision

**Goal:** Honest verdict. Did the flywheel spin?

- [ ] Compute Voice-DNA-ranking delta per user (week-1 stated relevance vs. week-4 stated relevance)
- [ ] Required for green light: ≥ 3 of 5 users show ≥ +10 percentile-points improvement
- [ ] Required for green light: at least 1 user logged a Phase-3 action outcome (even if Phase 3 is incomplete, the outcome rating)
- [ ] Required for green light: at least 1 cohort crossed k=5 in Community Brain
- [ ] Exit interview with each alpha user
- [ ] Re-score the 6-axis scorecard from `GOAL.md` §2
- [ ] `DECISIONS.md` entry: "Alpha results — what we proved, what we didn't, what we changed"

**Three possible outcomes:**

1. **Green light** — All three required items hit. Composite scorecard ≥ 65/100. → Move to Phase 3 (action engine + the rest of the pipeline modules).
2. **Yellow light** — Some hit, some didn't. Composite 55-64/100. → Diagnose what's missing, run a 4-week Phase 2b alpha with refinements. NOT Phase 3.
3. **Red light** — Flywheel did not spin. Composite < 55/100. → Stop. Strategic pivot or wind-down decision. Honest founder conversation, not a sprint.

---

## ✅ PHASE 1.5 CLOSED — 2026-05-15

- Phase 0: CLOSED (commit d09300a)
- Phase 1: CLOSED 2026-05-12 (commit ab471e0)
- Phase 1.5: CLOSED 2026-05-15 (commit ebd4b9d) — ALL GATES PASSED
  - Catalog: 218 rows, 100% embedded, 13 distinct categories, 51 subcategories, median quality 0.850
  - Skeleton: 100% — every Phase 1.5 file/route/component exists + passes all gates
  - Cost-audit: PASSED 2026-05-24 (commit e2b46b8)
  - verify:phase-1-5: ✅ 11/11 gates
- Phase 2 prep: migration landed (commit 16e73d3) — `article_outcomes` table + `source_suggestions` audit columns
- 2026-05-16 strategic checkpoint: scorecard 51/100, Phase 2 re-scoped to closed alpha

---

## 🔮 PHASES 3+ (per IDEAS_BACKLOG, gated on alpha proof)

Locked in `IDEAS_BACKLOG.md`. Do not pull forward without an explicit DECISIONS.md entry. Specifically:

- **Phase 3** (Action engine + full pipeline modules) gates on alpha green light (§2.6)
- **Phase 4** (Brain — dot connector + long memory) gates on Phase 3 + ≥1 action outcome
- **Phase 5** (Voice DNA full surface) gates on first user crossing N=10 edits
- **Phase 6** (Trust escalation + outcome tracking) gates on action outcomes flowing
- **Phase 7** (Build kickoff packages) gates on multi-action-vector user
- **Phase 8** (Community Brain default-on cohort surface) gates on first k=5 hit
- **Phase 9** (Agents) gates on Trust Ladder Loop 6+ for ≥3 users
- **Phase 10** (Mobile / PWA) gates on web retention week-12 ≥ 40% across paying users

The order is the order. No skipping.

---

## Anti-drift reminders (re-read at every session start)

- **The standard is `GOAL.md`.** Not "we've done a lot of work." Not "look at the architecture." Not "the demo works." The bar is a composite ≥70/100 with all axes above their hard floors and all §3 claims simultaneously true.
- **Phase 2 is closed alpha, not pipeline build.** Building more pipeline modules before the alpha is built on speculation. Defer.
- **Features in `IDEAS_BACKLOG.md` are gated.** A T1 item cannot be picked up before the corresponding T0 proof is green. Promoting requires an explicit founder approval + `DECISIONS.md` entry.
- **Every commit subject containing "done|complete|finished|ship" requires an `AUDIT GATE` block.** Pre-commit hook enforces. Don't try to talk your way around it.
- **A "complete" feature is one a stranger can use end-to-end without intervention.** Not "the code compiles." Not "the test passes." A stranger.

---

## Next sessions — concrete prompts

### Session A — Strategic checkpoint commit (15 minutes)

```
Resume ForgeMinds. GOAL.md + IDEAS_BACKLOG.md + CURRENT_SPRINT.md rewrite
are drafted (just landed in 3 Write tool calls in the prior session).

Tasks:
1. Append a DECISIONS.md entry dated 2026-05-16 titled "Phase 2 re-scoped:
   pipeline plumbing → closed alpha; scorecard 51/100; target ≥70/100."
   Cite GOAL.md §2, IDEAS_BACKLOG.md sequencing, and the Explore-agent
   strategic audit conclusions.
2. Stage GOAL.md, IDEAS_BACKLOG.md, CURRENT_SPRINT.md, DECISIONS.md.
3. Commit with subject: "docs(phase-2): lock the bar — closed-alpha refocus
   + ideas backlog + scorecard 51/100"
4. No code changes. No pipeline work. Only this strategic checkpoint.

Stop after commit. Report git log oneline -3.
```

### Session B — Phase 2.1 minimum pipeline kickoff (after Session A)

```
ForgeMinds Phase 2.1 — minimum pipeline for alpha (CURRENT_SPRINT.md §2.1).

Five hard requirements, no more, no less:
  1. /api/cron/ingest fires per-user, only invokes per-source-type fetchers
  2. /api/cron/score produces composite_score (baseline only — NO Voice DNA yet)
  3. /api/cron/curate picks top N per user_preferences.max_articles_per_brief
  4. /api/cron/generate writes a briefs row with prompt_version
  5. /briefs/[id] page renders the brief

EXCLUDED from this session: email, Voice DNA, action engine, Brain, Community.

For each route: read what exists (Phase 0/1 left skeletons), audit against
the actual live schema columns, fix what's broken, leave what works.

Gate: a non-Victor user (Victor's friend on a real signup) can see their
first brief land on /dashboard within their configured cadence, with zero
SQL intervention.

Audit gate at end. Stop. Report.
```

### Session C — Phase 2.2 outcome capture UI (after Session B verifies)

```
ForgeMinds Phase 2.2 — outcome capture UI (CURRENT_SPRINT.md §2.2).

Build <OutcomeButtons> + <RatingChip> on /briefs/[id], wired to
upsert_article_outcome RPC (already landed in commit 16e73d3).

Friction floor: < 5 seconds per article.

compliance_audit_log writes for every outcome.

Stop after the friction-floor test passes with a non-Victor user.
```

---

*This file is the active path. Re-read at every session start. The bar is in `GOAL.md`. The parking lot is in `IDEAS_BACKLOG.md`. The history is in `DECISIONS.md`.*
