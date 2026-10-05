# ARCHITECTURE.md -- ForgeMinds Slice I1 (insight & decision-support layer)

> **Status:** DRAFT pending the founder's approval
> **Owner:** Claude (design-only session, 2026-07-09) -- read-only against dev DB `ymgbjtgczgnooscigplb` and the codebase; zero code/migrations touched.
> **Probe:** `/architect-probe` ran 2026-07-09 -- 6 parallel persona subagents (Senior Architect, Senior Engineer, Domain Expert [securities-regulation counsel mindset, with cited web verification], End User, Hostile Architect, Auditor), each reading the real source files + live dev-DB schema. **82 questions surfaced: ~44 ANSWERED-FROM-CONTEXT (cited evidence, incorporated below), ~31 NEEDS-FOUNDER-INPUT (each resolved to a recommended default carried into SS7), ~7 NEEDS-RESEARCH/ATTORNEY (5 resolved via live web research with citations; 2 are hard attorney gates that cannot be resolved by an AI session).**
> **Foundational scope:** feature -- foundations locked in `docs/architecture/forgeminds-v1-finance-core.md` (approved 2026-06-14). SS0 omitted.
> **Relationship to prior work:** extends the approved finance-core design (Layer-1/Layer-2 boundary) and the approved actions design (`full-os-phase-1-actions.md` -- Analyze + `resolveActionConfig` + `analysis_lenses`). **Composes with H1** (`curation-hardening-vra.md`, pending approval): the daily AI budget cap and injection firewall are treated as Tier C's prerequisites, and this artifact patches one gap in H1's scope (SS7.12). Sequenced against `v1-execution-plan-2026-07-08.md` E1-E6.

---

## SS1 -- Goal

After I1 ships, **the brief stops telling Victor only WHAT moved and starts telling him WHY it moved, where the number sits in context, and -- on his explicit opt-in only -- what an experienced observer would watch or how a hedge is typically structured.** Three tiers, three different risk postures, one shared Layer-1 mechanism.

**Verbatim founder request (2026-07-09):**
> "these numbers and analysis need to expand include more insights and analytics etc because it doesn't really tell me why it went up or [down] and whether it presents a good opportunity to standby or be on a watch or actually buy or sell or hedge or do options, etc and how to trade... can any of this be built as an extra or spinoff or just for me (it can be opinion or insight, doesn't have to be full blown advice)... remember this app is not just for me or not even just for finance, i'm just testing it on investment/finance/trading hobbies -- this app is no one size fits all."

| Tier | What it delivers | Mechanism | Risk posture |
|---|---|---|---|
| **A -- causal "why"** | Each ticker story states what the curated articles SAY caused the move ("(per Reuters) deliveries beat guidance"), or honestly says no driver is in today's coverage | Prompt change in `generate` + per-article ticker threading + `causal_citations`; zero AI-cost delta beyond slightly longer prompt | Journalism/summarization -- lowest |
| **B -- decision-support statistics** | Per-ticker factual context: position in 52w range, distance from 52w high/low, day change, P/E, market cap -- "as of {date}", no imperatives, no predictions, no price targets | **Deterministic server-side computation** (no AI) injected into the MARKET DATA corpus + rendered as a structured stats block; snapshotted on the brief | Factual data display -- low |
| **C -- opinion/insight lens** | On-demand, per-article, EXPLICIT OPT-IN (OFF by default): "what I'd watch (and what would change my mind)", "what a hedge here typically looks like" -- scenario/educational register, banned-phrase-gated, heavily disclaimed | New rows in `analysis_lenses` (an *opinion pack*) served by the existing `/api/actions/analyze` route with a new server-side entitlement gate | Opinion commentary -- the regulated-adjacent tier; SS6 draws the exact boundary |

### SS1.1 -- Slice decomposition + sequencing recommendation (vs E3-E6 + H1)

The three tiers have different prerequisites and risk; they ship as three sub-slices:

| Sub-slice | Ships | Reasoning |
|---|---|---|
| **I1-A (Tier A)** | **Immediately -- BEFORE E6 dogfood. CONFIRMED** (the PS-prompt's hypothesis is right) | It upgrades the exact artifact the dogfood rates against Pipedream; the founder's verbatim complaint ("doesn't really tell me why") is a dogfood-blocking gap. Zero schema beyond one additive column; prompt + validation-scope change; E2 (ticker threading data) landed today (`a8f31d2`), so the inputs exist. |
| **I1-B (Tier B)** | **With E3** (WF2 outputs), before E6 | Tier B and E3 touch the same render surfaces (brief page + HTML email). Bundling avoids double-touching `deliver`/email templates. Zero AI cost (deterministic), so no H1 dependency. |
| **I1-C (Tier C)** | **After H1 lands AND after E4's founder click-through** ; may overlap the E6 dogfood week as founder-only opt-in; **NOT an E6 blocker** | (1) H1's budget cap + injection firewall are Tier C's cost/safety prerequisites (SS7.12); (2) the Analyze surface Tier C rides on has **zero real runs today** (`action_template_runs` is empty, verified live) -- E4's click-through must prove the vehicle before the opinion payload boards it. |

### SS1.2 -- Spinoff vs lens: VERDICT = LENS inside ForgeMinds (gated), not a spinoff

The founder floated "an extra or spinoff or just for me." Four grounds for the lens verdict (Hostile Architect F11, unanimous across personas):

1. **A spinoff needs the same data.** It would either duplicate the entire ingest→score→curate→enrich pipeline (second codebase, duplicated `FINNHUB_API_KEY`/secrets, a textbook `wired-not-orphaned.md` violation destined to rot) or read the same dev DB from a second repo -- which buys **zero regulatory isolation** (same data, same blast radius) while paying full price for a second deploy target, auth surface, and secrets set.
2. **The containment the spinoff idea is chasing already exists in-product**: OFF-by-default + server-side entitlement + banned-phrase gate + disclaimer wrapper + `prompt_version`/`sources[]` logging. Regulatory posture follows *who receives what content under what gate*, not which repo the code lives in.
3. **The founder's own "no one size fits all" vision requires the lens-pack mechanism in-product regardless** -- a per-user insight-lens config is Layer-1 work that serves every future vertical. A "just for me" spinoff serves exactly one user and one domain, then orphans.
4. **Rollback is stronger in-product**: Tier C has a *data kill-switch* (`UPDATE analysis_lenses SET is_active=false WHERE pack='finance_opinion'` -- no deploy). A spinoff's kill-switch is "remember to maintain the second app."

---

## SS2 -- Personas

### P1: Victor -- finance dogfood user (primary)
- **State:** about to run the E6 dogfood; his standing complaint is the brief states facts without causes and never helps him decide watch-vs-act.
- **Need:** the "why" behind each move, the factual context (52w position, valuation), and -- because he asked for it explicitly -- an opinionated read he understands is opinion.
- **Expects:** causal claims he can verify against the cited article in one click; stats that say "as of Friday's close" on a Monday; opinion that is concrete ("what would change this read") rather than hedge-everything boilerplate.
- **Complains about:** a dodge. If Tier C ships vague "consider your risk tolerance" filler, it reproduces the exact "doesn't really tell me" complaint with a disclaimer bolted on (End User Q8).

### P2: Future non-finance vertical user (edge: Layer-1 portability)
- **State:** onboards on oncology-trial news or regenerative farming next year.
- **Need:** the same three-tier mechanism with zero finance leakage -- causal "why" from articles (Layer-1, works day one), a domain stats block (a DIFFERENT stats schema, not relabeled tickers), an opinion pack written for their domain with their domain's banned-phrase classes (dosage/diagnosis imperatives, not price targets).
- **Complains about:** "52-week high" framing on a drug trial; an opinion lens whose guardrails only understand finance.

### P3: The attorney / regulator reading Tier C 12 months out (edge: forensic + legal review)
- **State:** asked to sign off Tier C for public ship (or investigating a complaint).
- **Need:** for any user and any date: exactly which opinion outputs were rendered, under which consented disclaimer version, produced by which lens text (not just which lens *slug* -- the row is editable data), with which banned-phrase checks passing.
- **Complains about:** a `prompt_version` that didn't change when the lens text did; an audit log the user could cascade-delete; consent that was never recorded.

---

## SS3 -- 9-scenario map (per VIBE Rule 11)

**Common (3):**
1. Morning brief: each ticker story now reads "TSLA $406.43 +1.8% -- deliveries beat guidance **(per Reuters)**"; below the prose a compact stats block: "52w range position: 78% · 4.2% below 52w high · P/E 68.1 · **as of Jul 9 close**". Web and email render the identical `stats_snapshot`.
2. Victor opts in to the opinion lens (one-time consent interstitial), clicks "What I'd watch" on a story on `/briefs/[id]`: an amber **OPINION -- not advice** card renders a scenario read ending with an explicit invalidation trigger ("this read flips if Thursday's delivery numbers miss"), source-linked, logged.
3. A non-finance user's brief does Tier A causal attribution from their articles (pure Layer-1 -- "the trial met its primary endpoint (per NEJM)"); no stats block renders (no domain provider registered); no opinion pack exists for their domain yet -- nothing finance-flavored leaks.

**Edge cases (3):**
4. No article states a cause for a move: the brief says "moved +3.1% -- no clear driver in today's coverage" (per the founder's own standing rule: honest zero over false insight). Never an invented cause.
5. Monday 6am brief from Friday's `ticker_data`: every stat carries "as of Fri Jul 4" (weekend staleness is normal, annotated, never silently current); a new listing where `high_52w == low_52w` renders no range-position stat (division guard); crypto rows render no P/E (asset-type branch); missing 52w bounds render "--".
6. A steered/malicious article tries to turn the opinion lens into a pump narrative: the banned-phrase gate (price-target/imperative/urgency classes) rejects the output, retries once with a stricter directive, then **withholds** ("This insight was withheld -- it tripped N content-safety rules"), logging rule-ids only. A budget-exhausted day: the lens button returns the honest "today's AI budget is used up" state (H1 convention), never a dead button.

**Adjacent surfaces (3):**
7. HTML email: same causal prose + a static stats table from the same `stats_snapshot`; **no Tier C content in email ever** (opt-in interactive surface only).
8. `GET /api/ops/ai-telemetry` + run rows gain the third rejection counter (`rejected_for_banned_phrase` + rule-ids), queryable separately from `rejected_for_fabrication` (live today) and `rejected_for_injection` (H1).
9. Settings: the opinion-lens toggle (OFF) with the locked-state copy (SS6.5b); consent recorded to the new `consent_log`; lens runs land in `action_template_runs` (a saved-history UI for analyze runs is a flagged fast-follow, not this slice).

---

## SS4 -- Two-way data flow (per `two-way-traceability.md`)

### Forward: where does each displayed element come FROM?

| Surface / element | Source rows | Derivation | Source-kind |
|---|---|---|---|
| Tier A causal claim | `raw_articles` (title+summary of the brief's own `article_ids`) | AI paraphrase constrained to article-stated causes; inline "(per {source_name})"; `briefs.causal_citations` (new additive jsonb) maps `{ticker, article_id}` validated server-side against `article_ids` | ai (grounded) |
| Tier A market figures | `ticker_data` latest row per symbol | Already flows via the MARKET DATA corpus; substring-gate-validated (`brief-validation.ts`) | api |
| Tier B stat ("4.2% below 52w high") | `ticker_data.{price_cents, high_52w_cents, low_52w_cents, pe_ratio, change_percent, market_cap_cents, fetched_at}` | **Pure deterministic formula** in `src/lib/pipeline/finance-insights.ts` (`computeTickerStats`, `formula_version='stats-v1'`); NO AI; snapshotted to `briefs.stats_snapshot` with `as_of = fetched_at` | derived |
| Tier C opinion output | ONE `raw_articles` row (single-source confinement, unchanged from Analyze) + the lens row's `prompt_skeleton` | AI synthesis under the lens; `action_template_runs` row carries `resolved_data.{tier:'tier_c', lens, lens_prompt_hash, sources[]}`, `prompt_version`, `generation_model`, grounding + banned-phrase results | ai (opinion, gated) |
| NL market read (`interpretation`) | `ticker_data.interpretation` (AI, enrich-time) | **Hardened this slice** (SS7.16): grounding-checked at enrich against the numeric quote payload; rendered inside the labeled stats block as AI content, no longer silently fused into prose as if it were data | ai |

### The compute-then-inject contract (the load-bearing engineering decision -- Senior Engineer Q1/Q2)

Tier B stats are **derived numbers that do not exist verbatim in any source text**. The substring anti-fabrication gate (`brief-validation.ts`) rejects any `$`/`%`/decimal token not literally present in `sourceText`, and the one-shot strict-regeneration retry re-sends the SAME user prompt -- it structurally cannot rescue a number that was never in the corpus. Therefore:

1. Stats are computed **server-side, deterministically, before the AI call**.
2. The formatted stat strings are **appended verbatim into the MARKET DATA block** (which is already part of `sourceText`, `generate/route.ts:375-380`) -- so Tier A prose MAY quote them and still pass the gate.
3. The same computed object is rendered as a **structured stats block outside the AI prose** (web component + email table) and **snapshotted to `briefs.stats_snapshot`** (mirrors H1's `degraded_sources` snapshot precedent: a brief re-opened next week shows what was true when generated; live recompute would drift).

Getting this ordering wrong means every finance brief burns two guaranteed-fail AI calls (first pass + doomed retry) and lands with `summary_html = NULL` -- a correctness bug today and a budget-cap bug the day H1 ships.

### Reverse: where do the new rows GO TO?

| Source row | Consumer surface(s) |
|---|---|
| `briefs.causal_citations` | Brief story rendering (the "why" drill: click the cause → the cited article row/url); founder 30-second verification; future NLI validation (V2) |
| `briefs.stats_snapshot` | Web stats block; email stats table; `MARKET DATA` corpus (via injection pre-AI); forensic "what did the user see that day" queries |
| `action_template_runs` (tier_c rows) | Inline opinion card on `/briefs/[id]` + `/dashboard`; `compliance_audit_log` mirror row (`event_type='opinion_lens_rendered'` -- the codebase's own mirror-not-replace precedent, `20260518100001`); regulator query `WHERE resolved_data->>'tier'='tier_c'`; H1 `ai_daily_spend` tally |
| `consent_log` (new) | The opt-in gate check; attorney review evidence ("which disclaimer version did the user consent to, when") |
| `analysis_lenses` opinion rows | The Analyze lens picker (only when server confirms entitlement); the data kill-switch |

**Provenance reconciliation (stated explicitly so no future auditor hunts for a missing table):** `action_template_runs` -- with `resolved_data.sources[]`, `prompt_version`, `generation_model`, `fact_check_*` -- **is this codebase's `ai_output_provenance` implementation** (permitted by `composable-outputs.md` SS5 "or equivalent"; Auditor Q10). No parallel provenance table is created.

### SS4.4 -- The non-finance lens sketch (proof no finance leaks into Layer-1)

**Layer-1 mechanism (generic):** lens rows with `pack`/`requires_opt_in`/`lens_version`; a per-user opt-in preference + consent row; a banned-phrase CHECKER that evaluates configurable phrase-class packs; a stats-block RENDERER that renders whatever a registered per-vertical stats provider returns; causal-attribution prompt directive ("state causes only when an article states them, cite the source").

**Medicine pack (Layer-2 data + one provider, future slice):**
- Lens row: `trial_read` -- "What does this Phase-III result mean: endpoints hit/missed, effect size as stated, what the next catalyst is (readout, FDA date). NOT medical advice; state only what the article reports." `pack='medicine_opinion'`, `requires_opt_in=true`, `hallucination_risk='high'`.
- Stats provider: `{trial_phase, enrollment_n, primary_endpoint, readout_date}` -- a DIFFERENT schema, not relabeled ticker columns (End User Q10: Tier B is per-vertical by nature; the Layer-1 part is only the renderer + snapshot plumbing).
- Banned-phrase pack: dosage-imperative / diagnosis / "stop taking your medication" classes -- same checker, different data.

Nothing above requires touching `finance-insights.ts`; nothing in the Layer-1 checker/renderer/gate names a ticker. That is the boundary test.

---

## SS5 -- Stakeholder concerns (persona findings)

### Senior architect
The load-bearing structural finding: `generate/route.ts` is simultaneously the shared Layer-1 synthesis engine AND the only place finance prompt logic (`renderMarketBlock`, 15 finance-token occurrences today) lives inline. I1 triples that finance surface -- so I1 is the moment the boundary gets fixed or permanently baked in. **Extract `src/lib/pipeline/finance-insights.ts` (Layer-2)** holding `renderMarketBlock`, `computeTickerStats`, and the finance prompt fragments; `generate/route.ts` calls through a narrow interface. Also: thread tickers per-article in the prompt (extend `ArticleForBrief` with `tickers[]` from `scored_articles.tickers`, grouping each ticker's market line under its matching story) so Tier A's causal linkage is structural, not model guesswork; `loadPrefs()` selects an explicit named-column list -- any new preference column must be added there or it silently never loads.

### Senior engineer
Compute-then-inject (SS4) is the slice's one load-bearing engineering decision. Also: (1) Tier A causal language is invisible to the substring gate -- the gate checks numbers/cashtags, never whether the causal clause is true; mitigation is prompt-side (article-paired attribution) + `causal_citations` + an honest documented scope statement (NLI entailment = V2). (2) H1's budget design as written tallies only `score` + `generate` -- **the Analyze route (Tier C's vehicle) is not in H1's tally list and has zero cost gate today**; SS7.12 patches this. (3) `action_template_runs` has no idempotency -- every lens re-click is a fresh Sonnet call; accepted for opinion (a fresh take is legitimate) but every call MUST tally against the budget. (4) The repo has **zero test files**; the new pure functions (stats math, banned-phrase checker) get a minimal vitest harness -- the first tests in the project. (5) Prompt-version bumps: `generate-v0.3` for Tier A; Tier C lenses need data-level versioning (see Auditor).

### Domain expert (securities regulation -- full analysis in SS6)
Tiers A and B are green in every realistic posture. Tier C is green for personal use unconditionally, and can remain lawful publicly ONLY if it stays strictly **impersonal** -- the gate that matters is a *personalization* gate, not a paywall gate. The already-shipped `what_should_i_do` lens + `facts_plus_opinion` stance sit closer to the line than Tier A/B and currently ship **unguarded to any authenticated user** -- they get retro-gated under the same opt-in (SS7.8).

### End user
Today's brief already fuses fact and machine-opinion invisibly: the AI-written `interpretation` is woven into prose with no label, no grounding check, no wrapper -- I1 is partly a FIX, not just an addition (SS7.16). The Analyze apparatus (Tier C's home) exists only on `/dashboard`, not on `/briefs/[id]` where Victor actually reads -- it gets wired there. Opinion needs its own visual language (amber OPINION chip distinct from the green Grounded badge; today `key_facts` and `what_should_i_do` render pixel-identical). Tier C must be concrete to be worth shipping: every scenario ends with an explicit invalidation trigger ("this read flips if X") -- attention-framing that satisfies the "watch or act" need without directive verbs.

### Hostile architect
CRITICAL findings, all addressed in SS7: the un-tallied Analyze cost hole (F1 → SS7.12); the injection×opinion gap -- H1's jailbreak-syntax firewall cannot catch a steered pump narrative that the opinion stance explicitly permits (F2 → banned-phrase classes run ON OUTPUT for every opinion render + honest scope statement); stale-data lie on Mondays (F3 → mandatory "as of" on every stat); division-by-zero/asset-type honesty (F4/F5 → guards in `computeTickerStats` + unit tests); the client-side-only lens gating pattern is ALREADY broken for `what_should_i_do` today -- any authenticated user can POST it directly (F12 → server-side entitlement inside the route, proven by a curl test in SS9); the single most dangerous failure mode is a plausible-but-wrong causal claim inside the founder's own trusted brief cascading into a real-money trade (F10 → per-claim citations + no-driver fallback + documented gate scope).

### Auditor
Two pre-existing structural contradictions surfaced (both predate I1; Tier C is where they start to matter): (1) `compliance_audit_log` **cascade-deletes on account deletion today** (verified live, `confdeltype='c'`), contradicting compliance.md §7's append-only design -- the audited party can delete the evidence; fix = retain/tombstone on deletion (founder decision, SS7.16). (2) `analysis_lenses` has **no `updated_at` and no version column** -- a lens-text edit is invisible to every run stamped with the same `prompt_version`; fix = `updated_at` + `lens_version` columns + snapshot `lens_prompt_hash` into each run's `resolved_data` (two-line code change; makes every run forensically self-contained). Also: `consent_log` does not exist yet (build it now -- retrofitting consent history is impossible); stamp `resolved_data.tier` at write time so the regulator query doesn't depend on the CURRENT state of an editable lookup table; the `perBriefValidation` array caps at 25 entries -- a documented forensic blind spot at multi-user scale.

---

## SS6 -- Real-world friction & the Tier-C regulatory boundary

> **Standing disclaimer:** this analysis is not legal advice (compliance.md §11). Its job is to make the mandatory attorney review (compliance.md §10, ai-native.md SS6) fast and cheap -- not to replace it. Attorney sign-off recorded in `DECISIONS.md` is a **hard, non-skippable gate** before any non-founder sees Tier C.

### 6.1 The framework (verified against 2024-2026 authority by the Domain Expert persona, citations in SS11)

- **RIA triad -- Investment Advisers Act of 1940 §202(a)(11)** (*SEC v. Capital Gains*, 375 U.S. 180 (1963); IA Release 1092): investment adviser = (i) advice/analyses/reports concerning securities, (ii) for compensation (ANY economic benefit; bundled subscription fees count), (iii) as a regular business. All three prongs required.
- **Publisher's exclusion -- §202(a)(11)(D) + *Lowe v. SEC*, 472 U.S. 181 (1985):** bona fide publications of general and regular circulation carrying **disinterested, IMPERSONAL** commentary are excluded -- including PAID newsletters (compensation alone does not defeat the exclusion).
- **Fresh and directly on point -- the *Seeking Alpha* dismissal (S.D.N.Y., Aug 2024):** the court rejected the argument that "regular circulation" requires fixed intervals -- real-time/event-driven publishing does not forfeit the exclusion. **Favorable: ForgeMinds' daily/event-driven cadence is fine on that prong.**
- **The impersonality line has a futures-side twin:** *CFTC v. Vartuli*, 228 F.3d 94 (2d Cir. 2000) -- computed-for-your-conditions signals are NOT impersonal publishing (CTA definition, CEA §1a(12)); *Taucher v. Brown-Hruska* (D.C. Cir. 2005) protects pure publishers. If Tier C ever describes **futures / options-on-futures** hedges, a second regulator (CFTC/NFA) enters.
- **AI-washing enforcement is live NOW and tier-independent:** *In re Delphia* / *In re Global Predictions* (SEC, Mar 2024) -- marketing must never overstate what the AI does. Applies to ForgeMinds' copy today, even at Tier A.
- **Posture shift:** the SEC withdrew the Predictive Data Analytics proposal (S7-12-23) in mid-2025; the 2026 posture is principles-based. Do NOT build assuming that withdrawal is permanent cover -- the underlying adviser-definition + anti-fraud framework is fully intact.
- **State trap:** below ~$100M AUM, registration is state-level; the §222(d) de minimis exemption is **"fewer than 6 clients per state"** -- a public SaaS with 6+ users in one state receiving *personalized* advice can trigger that state's registration at zero AUM. Strong independent argument for keeping public Tier C impersonal.

### 6.2 The load-bearing distinction: personalization of SELECTION vs personalization of ADVICE

ForgeMinds personalizes **selection** -- which stories/tickers surface, scored against the user's interest graph. A watchlist-filtered feed is editorial curation (Bloomberg terminals, Finviz screens, follow-these-tickers feeds all remain publishers). What breaks the publisher's exclusion is personalization of **advice**: tailoring a recommendation to THIS user's holdings/positions/situation and speaking to the advisability of a transaction *for that person*.

**The dividing question for any Tier C sentence: "Would this sentence read identically for every user who clicked this article, or is it computed from THIS user's holdings/watchlist/position size?"** Identical-for-all = publisher side. Computed-from-your-position = adviser side (*Vartuli* is the proof of the same line in the futures world).

Concretely for the hedge language: "*a protective put is a hedge that consists of buying a put against a long position; traders often reference support levels as candidate strikes*" = options-encyclopedia education (OptionStrat-class, safe). "*Buy the TSLA $380 put -- that's your 52-week low -- to hedge your position*" = a computed-for-you recommendation wearing a disclaimer, and **a disclaimer does not cure personalized advice** (substance beats labels -- *Capital Gains*, the AI-washing orders).

### 6.3 Regulatory verdict per tier × posture

Postures: **P1** = founder-only, free (current). **P2** = public SaaS, free tier. **P3** = public SaaS, paid.

| | P1 founder-only free | P2 public free | P3 public paid |
|---|---|---|---|
| **Tier A -- causal why** | Outside the Act (no advisee, no compensation, no business -- you cannot be an adviser to yourself). **Very high confidence.** | Journalism/summarization; publisher-excluded. **High.** | Publisher-excluded (*Lowe*: paid is fine) while disinterested/impersonal. **High.** |
| **Tier B -- statistics** | Outside the Act. **Very high.** | Impersonal stats on user-SELECTED tickers; excluded. **High.** | Excluded while stats stay impersonal; risk rises only with portfolio-awareness. **Medium-high.** |
| **Tier C -- impersonal** (identical-for-all, article-scoped, no holdings knowledge) | Outside the Act. **Very high.** | Compensation prong is the fragile point (freemium funnel = indirect-compensation argument); otherwise publisher-shaped. **Medium.** | *Lowe*-shaped paid-newsletter posture; defensible but fact-dependent -- attorney must confirm on real output samples. **Medium.** |
| **Tier C -- personalized** (watchlist/holdings-computed strikes, portfolio-aware imperatives) | Outside the Act by posture, but **do not build this variant** -- the code should be public-shippable. | Advice prong likely met; exclusion likely lost. **Do not ship.** | **Compensation + personalized advice + regular business = RIA (and 50-state) registration. High confidence it is over the line.** |

**Bottom line:** compensation does not decide this -- **personalization does**. The gate this artifact designs (SS6.5) is therefore a *personalization firewall* plus an entitlement gate, not merely a paywall or a toggle.

### 6.4 Banned-phrase classes (Tier C output gate; deterministic, fail-closed; final list = attorney's)

BANNED (reject payload → one strict retry → withhold + log rule-ids): **guaranteed-return** ("guaranteed", "risk-free", "can't lose"); **price-target** ("price target", "will hit/reach $X", "headed to $X"); **income-promise** ("passive income", "N% monthly", "double your money"); **urgency** ("act now", "before it's too late", "buy now/today", "load up", "back up the truck"); **personalized-imperative** ("you should buy/sell/short", "I recommend you", "go long/short this"); **allocation/position-sizing** ("put N% of your portfolio", "invest $X into", "all-in"); **interested-touting** (naming a security the founder/ForgeMinds holds without a disclosure token).

PERMITTED register: scenario/conditional ("one scenario is...", "if X then historically moves like this have..."); generic strategy education ("a collar consists of..."); watch framing ("what I'd keep an eye on"); historical base rates with caveats; explicit "opinion, not advice, not tailored to your holdings."

Honest scope statement (ships WITH the filter, lesson #64): *this catches known phrase patterns, not intent; paraphrase-evasion is possible; the structural defenses are the impersonality firewall + single-source confinement + opt-in + the withheld state -- not the regex alone.*

### 6.5 What changes at public ship -- the Tier-C gate design

- **(a) Server-side, fail-closed entitlement** (feature-flags.md §4: a client-evaluated flag on a regulated surface is a surface that doesn't exist; Hostile F12 proved the client-array pattern is already bypassable today): the Analyze route checks, in order -- lens `requires_opt_in`? → user's `opinion_lens_enabled` (default false)? → consent recorded? → (until attorney sign-off) user on the server-side internal allowlist (a role/allowlist column -- never a hardcoded name, per the project's own de-personalization rule)? Any failure → HTTP 403 with the honest locked copy. Gated **at the generation function** (data-integrity.md AI Input Gate): the ungated payload is never created, not merely hidden.
- **(b) Locked-state copy (honest, dateless):** "Insight Lens -- personal opinion/insight framing (scenarios, 'what I'd watch', strategy explainers) is in private testing and off for all accounts pending legal review, because opinionated market commentary can cross into regulated investment-advice territory. What you have now -- the causal 'why' and the factual statistics -- is informational and not investment advice."
- **(c) BYOK is honestly assessed as weak protection:** it shifts who pays the model provider (marginally weakening the compensation prong) but ForgeMinds still authors the prompts, lenses, and data enrichment -- the editorial/advisory function stays with the service. BYOK + paid subscription + personalized output is NOT a safe harbor. BYOK is only meaningful combined with no service fee AND strict impersonality.
- **(d) Attorney-review packet** (the deliverable that makes the review fast): the 10-item checklist from the probe -- selection-vs-advice line on 20 real output samples; freemium indirect-compensation opinion; *Lowe*-fit of the paid-impersonal posture; no-account-linkage confirmation; banned-phrase list + disclaimer-stack sufficiency; CTA/NFA sign-off if futures language ever appears; per-state de minimis map; AI-washing review of marketing copy; founder position-disclosure hygiene; sign-off recorded in `DECISIONS.md` + `compliance_audit_log`.

### 6.6 Other friction

- **Audit/evidence:** every Tier C render mirrors to `compliance_audit_log` (`event_type='opinion_lens_rendered'`, prompt/model version -- the live `20260518100001` mirror-not-replace precedent); the opt-in writes `consent_log` (new table per compliance.md §8); the three rejection counters (fabrication / injection / banned-phrase) stay separately queryable; rule-ids only, never raw matched text (H1 convention).
- **Scale:** stats computation is one batched `.in()` query per brief (the existing pattern, Hostile F13) -- must stay batched, never per-ticker loops. At 100 users the deterministic stats add ~zero cost; Tier C cost scales with clicks and is budget-tallied (SS7.12).
- **Multi-tenant (Rule 55):** new per-user values are real columns: `opinion_lens_enabled`, plus the existing `analyze_defaults` jsonb absorbs lens defaults. No new hardcoded knobs.
- **i18n/a11y:** V1 English; the OPINION chip + withheld/locked states use text + color-chip conventions already in the design system (never color alone).
- **Privacy/security:** no PII to AI (unchanged -- article text + market data only); the personalization firewall doubles as a privacy boundary (user holdings never exist in the system to leak); `CRON_SECRET`/cookie-auth unchanged; RLS on the new `consent_log` (owner-only) and existing tables unchanged.

---

## SS7 -- Explicit assumptions (REQUIRES FOUNDER APPROVAL)

Each resolves NEEDS-FOUNDER-INPUT probe questions to a recommended default. Approve, reject-with-correction, or scale down each.

1. [pending] **Slice decomposition + sequencing (SS1.1):** I1-A immediately (before E6 -- CONFIRMED as the probe hypothesized); I1-B bundled with E3; I1-C after H1 + E4's founder click-through, allowed to overlap the dogfood as founder-only opt-in, never blocking E6.
2. [pending] **Tier A design:** per-article ticker threading in the prompt (extend `ArticleForBrief` with `tickers[]`; group market lines under their stories); causal-attribution directive ("state a cause ONLY when one of this story's articles states it; cite inline '(per {source_name})'; otherwise say the driver isn't in today's coverage"); `GENERATE_PROMPT_VERSION` → `generate-v0.3`. **Honest documented scope:** the substring gate validates numbers/cashtags, NOT causal truth -- full-claim NLI validation is V2; V1's protections are the directive + citations + the no-driver fallback.
3. [pending] **`briefs.causal_citations` (additive jsonb):** the synthesis JSON gains a `causal_citations: [{ticker, article_id}]` field; server validates each `article_id ∈ briefs.article_ids` (reject the pairing otherwise, keep the brief); UI renders the "why" as a drill to the cited article. Brief-level citation alone fails the 30-second test the moment two stories cover different tickers.
4. [pending] **Layer-2 extraction:** `renderMarketBlock`, `computeTickerStats`, and all finance prompt fragments move to new `src/lib/pipeline/finance-insights.ts`; `generate/route.ts` (Layer-1) calls a narrow interface. Acceptance: the finance-token grep on the route file goes 15 → 0 (SS9).
5. [pending] **Tier B V1 scope = derivable-only stats:** 52w-range position, distance from 52w high/low, day change, P/E (with asset-type branch: none for crypto; rendered-but-labeled for ETFs), market cap, volume -- all from existing `ticker_data` columns. **Realized volatility and next-earnings-date are DEFERRED to a B2 follow-up** (they require a new candle-history/earnings-calendar fetch + additive columns that exist nowhere today -- confirmed by two personas independently). Every stat renders with "as of {fetched_date}"; no hard staleness cutoff in V1 (weekend staleness is annotated, not suppressed); division guard when `high_52w == low_52w`; null inputs render "--" (never fabricated).
6. [pending] **Compute-then-inject + snapshot (SS4):** stats computed deterministically pre-AI; injected verbatim into the MARKET DATA corpus; rendered as a structured block outside AI prose; snapshotted to **`briefs.stats_snapshot` (additive jsonb)** with `as_of` + `formula_version='stats-v1'` -- the H1 `degraded_sources` snapshot precedent. Web and email render the identical snapshot.
7. [pending] **Tier B portability:** the stats block renderer + snapshot plumbing are Layer-1; the stat schema comes from a per-vertical provider (finance is the only provider this slice); the medicine sketch (SS4.4) is the non-goal proof, not a build item.
8. [pending] **Tier C = opinion lens pack:** additive `analysis_lenses` columns (`pack text default 'core'`, `requires_opt_in boolean default false`, `lens_version int default 1`, `updated_at timestamptz`); seed 2 finance opinion lenses -- `what_to_watch` (scenario read; every output ends with an explicit invalidation trigger: "this read flips if X") and `hedge_education` (generic strategy education ONLY -- never computes strikes/sizes from user data). **Retro-gate the shipped `what_should_i_do` lens AND the `facts_plus_opinion` stance under the same `requires_opt_in` gate** -- they are opinion-capable surfaces currently shipping unguarded to any authenticated user (verified live).
9. [pending] **Opt-in mechanics:** `user_preferences.opinion_lens_enabled boolean not null default false` (+ added to any explicit select-lists that need it); **new `consent_log` table** per compliance.md §8 (`consent_type='opinion_lens_v1'`, versioned; re-consent only when disclaimer text changes); first-ON interstitial renders the full Tier-C disclaimer; enforcement is server-side in the Analyze route (403 + locked copy), never UI-only.
10. [pending] **THE PERSONALIZATION FIREWALL (the regulatory load-bearing line, SS6.2-6.3):** Tier C prompts receive the ONE article and the lens skeleton -- **never** `tracked_tickers`, holdings, positions, portfolio data, or account linkage; no strike/size computation from user data; output is identical-for-all-users-who-click-this-article by construction. Enforced by a permanent grep tripwire (SS9) + code review. This single constraint is what keeps public Tier C on the publisher side of *Lowe*/*Vartuli*.
11. [pending] **Banned-phrase gate:** new Layer-1 pure module (checker mechanism) + finance phrase-class pack as data (SS6.4 classes); runs on EVERY opinion-lens output (including the retro-gated `what_should_i_do`); **fail-closed**: one strict retry, then withheld state (output persisted for forensics, never rendered); `rejected_for_banned_phrase` + rule-ids logged in `resolved_data`, distinct from fabrication and injection counters; ships WITH its honest scope statement.
12. [pending] **Budget composition (patches H1's scope):** H1's SS4 tally list gains a third writer -- `/api/actions/analyze` tallies every call's real cost into `ai_daily_spend` and entry-gates at the top of the route (honest "budget used up" JSON, never a dead button, never touching the pipeline's `AI_ZERO_CALL` semantics). Until H1 lands, Tier C's exposure is contained by being founder-only + OFF-default. No dedup cache on lens re-runs (a fresh opinion take is legitimate) -- but every run costs budget.
13. [pending] **Tier C provenance + audit:** `resolved_data.tier='tier_c'` stamped at write time (regulator query must not depend on the current state of an editable lookup table); `resolved_data.lens_prompt_hash` snapshots the lens text actually used (closes the editable-lens forensic gap); `compliance_audit_log` mirror row per render (`event_type='opinion_lens_rendered'`); `AiOutputDisclaimer` gains a **hardcoded** not-advice line keyed to the lens risk tier (today it renders provenance but no advice disclaimer -- ai-native SS4.2 gap, verified) + a distinct amber OPINION visual treatment; the Analyze action (with lens picker) gets wired onto `/briefs/[id]` where the founder actually reads.
14. [pending] **Spinoff vs lens: LENS** (SS1.2). The "just for me" posture is achieved by the opt-in + allowlist + dark-at-public-ship gate, not by a second codebase.
15. [pending] **Public-ship gate:** requires-opt-in lenses additionally gated by a server-side internal allowlist until attorney sign-off (per SS6.5d packet) is recorded in `DECISIONS.md`; locked-state copy per SS6.5b; **no Tier C content in email**; no futures/options-on-futures content (CTA regime) without separate sign-off.
16. [pending] **Bundled pre-existing fixes** (surfaced by the probe; small, in-scope): (a) enrich's `interpretation` gets the deterministic grounding check against its own quote payload + is rendered as labeled AI content inside the stats block (today it is ungated machine-opinion fused into prose -- and worse, it enters the anti-fabrication corpus, so a hallucinated number in it could *ground* a hallucinated number in the brief); (b) `analysis_lenses.updated_at` added; (c) the `compliance_audit_log` ON DELETE CASCADE contradiction (audited party can delete the evidence -- verified live) is flagged for a founder decision: recommend retain/tombstone `user_id` on account deletion for audit rows while `action_template_runs` (user content) keeps cascading; (d) a minimal vitest harness for the new pure functions (first tests in the repo).

**Founder approval block:**
```
[ ] All assumptions approved as-is
[ ] Approved except: <list of #>
[ ] Reject + correction: <list of # + corrections>
[ ] Scale-down: <new smaller scope>

Signed: __________  Date: __________
```

> No code or migration commits until the founder replies with the exact keyword **build approved** (per `execution.md` Phase 0 SS6 / `architect-first.md` SS4).

---

## SS8 -- Non-goals (what I1 is NOT building)

- **Realized volatility + next-earnings-date stats** -- require new fetchers (candle history, earnings calendar) + columns that exist nowhere; deferred to B2 with its own probe of API cost.
- **NLI/entailment validation of causal claims** -- V2 of `brief-validation.ts` (its own docstring already defers this); V1 ships the directive + citations + honest scope statement instead.
- **Portfolio/holdings-aware Tier C** -- not deferred: **forbidden by design** (SS7.10). This is the variant that converts ForgeMinds into an RIA at public ship.
- **Brokerage/account linkage** of any kind (also keeps the robo-adviser line bright).
- **Futures / options-on-futures / commodity-futures hedge content** -- a second regulatory regime (CTA/NFA); out until separately cleared.
- **A standing in-brief Tier C section** (auto-appended opinion in every brief) -- the probe split on this (Architect Q8 argued the founder's complaint is about the brief); resolved as a **fast-follow decision (I1b)**: ship on-demand first, measure click friction during the dogfood, and only then decide whether an opt-in per-brief insight section (one extra gated AI call/day) earns its cost and regulatory surface.
- **Public Tier C enablement** -- hard-gated on the attorney packet (SS6.5d).
- **A spinoff app** (SS1.2 verdict).
- **Non-finance stats providers / opinion packs** -- the mechanism is designed portable (SS4.4); only the finance pack ships.
- **Conversational lens config** (Rule 56 Phase 2, per the approved actions design) and a **saved-history UI for analyze runs** (flagged gap; fast-follow with E5 surface work).

---

## SS9 -- Acceptance criteria (runnable)

**Tier A:**
- [ ] `select prompt_version from briefs where summary_html is not null order by created_at desc limit 1;` → contains `generate-v0.3`.
- [ ] `select jsonb_typeof(causal_citations) from briefs order by created_at desc limit 1;` → `array`; every element's `article_id` ∈ that brief's `article_ids` (join check returns 0 orphans).
- [ ] Founder read: each ticker story states an article-attributed cause with "(per {source})" OR the explicit "no clear driver in today's coverage" line -- zero uncited causal claims.
- [ ] Retry non-regression over 3 days post-ship: `select avg(coalesce((metadata->'validation'->>'regenerated_count')::int,0)) from pipeline_runs where step_name='generate' and started_at > '<ship-date>';` ≤ pre-ship baseline + 0.2.

**Layer boundary:**
- [ ] `grep -c "MARKET DATA\|renderMarketBlock\|pe_ratio\|52w" src/app/api/cron/generate/route.ts` → **0** (baseline today: 15); all matches live in `src/lib/pipeline/finance-insights.ts`.
- [ ] The banned-phrase CHECKER module contains no finance literals (finance classes live in the pack data file): `grep -in "ticker\|hedge\|price.target\|52w" src/lib/actions/banned-phrases.ts` → 0 (pack data file excluded).

**Tier B:**
- [ ] `select stats_snapshot->0->>'as_of', stats_snapshot->0->>'formula_version' from briefs order by created_at desc limit 1;` → non-null, `stats-v1`.
- [ ] Unit tests green: `computeTickerStats` -- `high==low` guard (no Infinity/NaN), null P/E for crypto, null-input → omitted stat, asset-type branching.
- [ ] Fabrication non-regression over 3 days: `select sum(coalesce((metadata->'validation'->>'rejected_for_fabrication')::int,0)) from pipeline_runs where step_name='generate' and started_at > '<ship-date>';` → 0 (proves compute-then-inject worked; derived stats never trip the gate).
- [ ] Email + web render the identical snapshot (manual founder check on one brief).

**Tier C:**
- [ ] Entitlement gate (server-side proof, not UI): `POST /api/actions/analyze {lens:'what_to_watch'}` as an authenticated non-opted-in user → **HTTP 403** + locked copy. Same POST after opt-in → 200.
- [ ] `select requires_opt_in from analysis_lenses where slug in ('what_should_i_do','what_to_watch','hedge_education');` → all `true` (retro-gate applied).
- [ ] `select resolved_data->>'tier', resolved_data->>'lens_prompt_hash', prompt_version, generation_model from action_template_runs order by created_at desc limit 1;` → `tier_c`, non-null hash, versioned.
- [ ] `select count(*) from consent_log where consent_type='opinion_lens_v1' and granted;` ≥ 1 before the first opinion render; `select count(*) from compliance_audit_log where event_type='opinion_lens_rendered';` ≥ 1 after it.
- [ ] Banned-phrase synthetic: force an output containing "price target of $500 -- you should buy now before it's too late" → run row shows `resolved_data.banned_phrase_rule_ids` non-empty (≥3 distinct classes), output **withheld** in the UI, and the counters remain distinct: banned-phrase ≠ `fact_check_warnings` ≠ (post-H1) `rejected_for_injection`.
- [ ] **Personalization-firewall tripwire (permanent):** `grep -n "tracked_tickers\|loadPrefs\|ticker_data\|portfolio\|holdings" src/app/api/actions/analyze/route.ts src/lib/actions/*.ts` → zero matches in the opinion prompt path (config/defaults reads excluded by file review; documented in the commit).
- [ ] Post-H1: `select spent_cents from ai_daily_spend where user_id='<founder>' and spend_date=current_date;` increments after one lens call (the analyze route tallies).
- [ ] Disclaimer wrapper: `grep -n "not.*advice" src/components/ai/ai-output-disclaimer.tsx` → the hardcoded line exists; raw-div tripwire (ai-native SS8.4) clean.
- [ ] No Tier C in email: `grep -rin "tier_c\|opinion_lens\|what_to_watch" src/lib/email/ src/emails/` → 0.

**Process:**
- [ ] All migrations additive-only; `get_advisors` clean after each (data-protection SS4.3).
- [ ] This artifact committed with `docs(arch):` prefix before any `feat(` commit implementing I1; founder has replied **build approved**.

---

## SS10 -- Rollback plan

- **Time-to-rollback:** minutes; the three sub-slices are independently revertable (different files, different migrations).
- **Tier A:** `git revert` the prompt commit → `GENERATE_PROMPT_VERSION` returns to `generate-v0.2`; `causal_citations` column sits unused (harmless additive). Briefs fall back to today's behavior.
- **Tier B:** stop rendering the stats block (one component revert); `stats_snapshot` keeps populating or is skipped -- either is harmless; the injected stat lines in MARKET DATA can be reverted independently.
- **Tier C:** the **data kill-switch needs no deploy**: `update analysis_lenses set is_active=false where pack='finance_opinion';` (and/or `update user_preferences set opinion_lens_enabled=false;`) -- the server-side gate then 403s every opinion request instantly. Full code revert available behind it.
- **Data-loss risk:** none -- every schema change is `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`; reverts leave unused columns/tables, never destroy rows.
- **Communication:** solo founder dogfood; if Tier C is killed mid-dogfood, the dogfood continues unaffected (Tier C was never an E6 gate).
- **Validation post-rollback:** a brief still generates within one tick; `GET /api/ops/ai-telemetry` still `telemetry_gate_pass:true`; Analyze with a core lens (`key_facts`) still 200s.

---

## SS11 -- Source persona-probe artifacts

Six parallel persona subagents ran via `/architect-probe` on 2026-07-09, each reading the real source files + (where tooled) the live dev DB; the Domain Expert additionally verified 2024-2026 authority via web research. 82 questions total; ~44 answered from context with cited evidence; ~31 resolved to recommended defaults now in SS7; ~7 needed research/attorney (5 researched, 2 are the standing attorney gates in SS6.5d).

- **Senior Architect** (15q). Key: `generate/route.ts` is both the Layer-1 engine and the only inline home of finance prompt logic -- I1 is the moment the boundary gets fixed (`finance-insights.ts` extraction) or permanently baked in; per-article ticker threading; Tier B "derivable-only" trim; `loadPrefs` named-column gotcha; I1 slots after E2, before E6.
- **Senior Engineer** (14q). Key: compute-then-inject or the substring gate burns two doomed AI calls per brief (the retry re-sends the identical user prompt and cannot rescue a derived number); H1's tally list omits the Analyze route entirely; no idempotency on lens runs (accepted, budget-tallied); zero test files in the repo; prompt-version bump discipline.
- **Domain Expert** (15q + verdict tables; securities-regulation depth with live citations: *Lowe v. SEC* 472 U.S. 181; *SEC v. Capital Gains* 375 U.S. 180; IA Release 1092; the Aug-2024 *Seeking Alpha* S.D.N.Y. dismissal; *CFTC v. Vartuli* 228 F.3d 94; *Taucher v. Brown-Hruska* 396 F.3d 1168; SEC AI-washing orders *Delphia*/*Global Predictions* Mar-2024; S7-12-23 withdrawal 2025; Advisers Act §222(d) state de minimis). Key: the gate that matters is a personalization firewall, not a paywall; selection-personalization is publisher-safe, advice-personalization is not; the shipped `what_should_i_do` lens is the impersonality TEMPLATE Tier C must not exceed -- and it currently ships ungated.
- **End User** (15q). Key: today's brief already fuses ungated machine-opinion (`interpretation`) into prose -- I1 is partly a fix; the Analyze surface isn't on the brief page the founder reads; opinion needs its own visual language; concrete invalidation-trigger framing is what makes watch-vs-act honest AND useful; Tier B email = static always-visible table.
- **Hostile Architect** (13 findings, severity-tagged; 8-phase). Key: F1 the un-tallied Analyze cost hole (CRITICAL); F2 injection×opinion -- a steered pump narrative sails past both the substring gate and H1's jailbreak-syntax list (CRITICAL); F10 the founder trading on a plausible-but-wrong causal claim is the single most dangerous failure mode (CRITICAL); F12 client-side-only lens gating is already bypassable today for `what_should_i_do` (CRITICAL, present-tense); F3-F5 stale-data + derived-stat honesty; F11 spinoff verdict = LENS.
- **Auditor** (10q, live-DB-verified). Key: `compliance_audit_log` cascade-deletes on account deletion today (contradicts its own append-only design); `analysis_lenses` has no version/updated_at -- lens edits are forensically invisible (fix: `lens_prompt_hash` per run); `consent_log` doesn't exist; stamp `tier` at write time; `action_template_runs` IS the `ai_output_provenance` equivalent (state it, don't fork it); the 25-entry `perBriefValidation` cap is a documented forensic blind spot at scale.

---

## SS12 -- Cross-rule integration

- [x] `architect-first.md` -- feature-scoped artifact; SS0 correctly omitted; the 30+-question bar exceeded (82).
- [x] `two-way-traceability.md` -- SS4 forward + reverse per tier; `causal_citations` closes the "why" drill; `action_template_runs` reconciled as the provenance table (no fork).
- [x] `hostile-architect.md` -- SS5/SS11 Persona 5 ran the 8-phase test; its four CRITICALs each map to an SS7 assumption (10, 11, 12, 13).
- [x] `ai-native.md` SS4 -- fail-closed banned-phrase gate; hardcoded disclaimer wrapper line (closing a verified gap); SS6 legal boundary honored via the attorney packet; AI Input Gate = the server-side entitlement check.
- [x] `data-integrity.md` (DMG) -- per-stat render floors (null → omitted, never fabricated); "as of" data-basis disclosure on every stat; opinion output gated at the function.
- [x] `compliance.md` -- §3.2 three-layer disclaimer stack applied per tier (SS6.5 / Domain Expert Section 7); §7 audit-log mirror; §8 consent_log; §10 attorney escalation is the hard gate.
- [x] `data-citizenship.md` -- every stat carries source/derivation/destinations/provenance (formula + `as_of` + snapshot + drill).
- [x] `data-protection.md` -- additive-only migrations; `get_advisors` after each; the audit-log cascade contradiction flagged for decision (SS7.16c).
- [x] `feature-flags.md` §4 -- the Tier-C gate is server-evaluated, fail-safe OFF.
- [x] `wired-not-orphaned.md` -- the spinoff verdict (SS1.2) is this rule applied; the retro-gate of `what_should_i_do` un-orphans an existing risk surface.
- [x] VIBE Rules: 11 (9 scenarios), 14 (cents math in stats), 16 (reuse: lenses/analyze/resolveActionConfig/snapshot precedent), 21/25 (budget composition), 35 (runnable gates in SS9), 46-48 (year/as-of scope labels + data-basis disclosure), 50 (this probe), 52 (fail-loud), 55 (per-user columns), 56 (structured lens picker is the sanctioned fallback; conversational = Phase 2), 57 (deepens AI-at-core), 59 (conflicts resolved explicitly: snapshot-vs-live per H1 precedent; fail-open vs fail-closed split by violation class).
- [x] Per-domain primers applied: **finance.md** (RIA checklist, "not investment advice", sparse-data gates) + **saas.md** (multi-tenant, server-side entitlement).

---

*Template version: 2026-05-17 (v4.4.5), per `scripts/templates/ARCHITECTURE.md.template`. This artifact: feature-scoped, drafted 2026-07-09, pending `build approved`.*
