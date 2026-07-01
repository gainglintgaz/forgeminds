# ForgeMinds — Ideas Backlog

> **Purpose:** the parking lot for "more brain, more moat, more customizable, more adaptable, more secret-ingredient" architectural moves. Not a TODO list — a *sequenced inventory* gated on the core-loop proof (`GOAL.md` §7).
>
> **Pairs with:** `GOAL.md` (the standard), `CURRENT_SPRINT.md` (the active path), `AI_FIRST_AUDIT.md` (the principles), `DATA_FLYWHEEL.md` (the data contract).
>
> **First locked:** 2026-05-16. Source: 2026-05-16 strategic audit (Explore agent) + founder review.
>
> **Discipline:** every item has prerequisites. Nothing in T2 or T3 may be picked up until the corresponding T0 / T1 proof is green. Captured here so they don't get lost AND so we don't accidentally implement #7 before #1.

---

## Sequencing tiers

| Tier | When | Gate to enter |
|---|---|---|
| **T0 — Now** | The next 2 sprints | Already inferred by current Phase 2 scope or required to make alpha possible |
| **T1 — After alpha proof** | Post 5-user × 4-week alpha | Voice-DNA-ranking delta measured ≥ +10 percentile-points (`GOAL.md` §3.1) |
| **T2 — After flywheel observable** | Post Community Brain first k-hit + action outcome logged | Moat moves from "claimed" to "observed" (`GOAL.md` §3.4) |
| **T3 — After paid users + retention** | Post first cohort of paying Architect-tier users with > 8-week retention | Product-market fit signal exists, not just usage |
| **T4 — Speculative** | Pure exploration; do not pick up until T3 done | Strategic-bet category; revisit annually |

---

## T0 — Now (concurrent with alpha prep)

### T0.1 — Outcome capture UI with instant-close (< 30 sec friction)
- **Vision:** Tap save / dismiss / "took action" on a brief article in under 5 seconds. Phase-3 action outcome logged in < 30 seconds at check-in date.
- **Why moat:** Outcome data is THE training signal for Voice DNA and Trust Ladder unlock. Without instant close, users don't close loops; without closed loops, no flywheel. The friction here determines whether the entire moat-thesis is real.
- **Prerequisites:** `article_outcomes` table (just landed, commit `16e73d3`). `upsert_article_outcome` RPC (just landed).
- **Unlock trigger:** Always-on after Phase 2 alpha begins. The first 5 users MUST capture ≥ 10 outcomes each within 4 weeks.
- **Audit reference:** Audit Section 8 item #1.
- **Complexity:** Medium (one component + RPC wiring + behavioral_events fan-out + DMG-aware UI hiding).

### T0.2 — Minimum-viable brief delivery loop
- **Vision:** Ingest → score → curate → enrich → generate → deliver, in that order, end-to-end for one user with one brief per day (or per their cadence).
- **Why moat:** Required substrate for everything else. No brief = no outcomes = no flywheel.
- **Prerequisites:** Source catalog ✅, user_preferences dispatcher ✅, AI router ✅, briefs schema ✅. Need: actual code path that fires the cron, fetches from user's sources, scores, generates, and writes a brief row.
- **Unlock trigger:** Already in flight (Phase 2 commit `16e73d3` is the migration prep).
- **Complexity:** High (multiple Edge Functions, real data flowing, real failure modes).

### T0.3 — `compliance_audit_log` actually populated
- **Vision:** Per `compliance.md` §7, every regulated event (action recommendation shown, action completed, AI-generated number rendered to user, account deletion) writes a row.
- **Why moat:** Required for alpha (closed-alpha excuse for pre-attorney-review still needs the audit log so the future attorney has something to review).
- **Prerequisites:** Schema migration to create `compliance_audit_log` if not exists.
- **Unlock trigger:** Concurrent with T0.1; can't ship outcome capture without audit-logging it.
- **Complexity:** Low.

### T0.4 — Off-platform backup script + restore drill
- **Vision:** Daily `pg_dump` to Backblaze B2 / S3. Quarterly restore-to-staging drill. Time-to-restore documented.
- **Why moat:** Required by `data-protection.md` §2.2. Before any user has real data in the system, the backup path must be tested.
- **Prerequisites:** B2 bucket + creds. Script (likely in `scripts/pg-dump-offsite.ps1` from factory).
- **Unlock trigger:** Before first alpha user signs up.
- **Complexity:** Low to medium.

### T0.5 — Honest onboarding for the hostile second user
- **Vision:** A stranger with no RSS knowledge, no developer background, completes onboarding in < 10 minutes and ends with a working pipeline. No "let me SQL it in for you" workarounds.
- **Why moat:** Per `GOAL.md` §3.2, this IS the readiness test. If you have to help a single user, the moat doesn't exist.
- **Prerequisites:** Conversational onboarding (`/onboarding/*` Phase 1.5 skeleton). Validate against a real test user.
- **Unlock trigger:** Before alpha launch.
- **Complexity:** Medium (probably 80% there; the last 20% is UX polish + error paths).

### T0.6 — Auto tone: content-adaptive register (status: DISCUSSED, founder 2026-06-10)
- **Vision:** Add **"Auto — match the tone to the story"** as a tone option (arguably the default). A fixed tone is wrong for part of every brief: a scandal wants *investigative*, a Fed decision wants *analytical*, breaking news wants *concise*. In auto mode the model picks the register **per item** based on content type, while **style anchors stay fixed** (anchors = whose voice; tone = register — auto varies register only, never abandons the anchors).
- **Founder framing (verbatim, 2026-06-10):** "tone should probably also be an option to automatically pick if needed the ones that most fits the story, news, analysis, report, etc."
- **Why moat:** Deepens the Voice DNA promise from "one voice setting" to "your writers' voice, correctly modulated per story" — the thing a human editor does. Pure prompt-level intelligence; zero extra AI calls or cost.
- **Implementation sketch (sized against live code/DB 2026-06-10):**
  1. Migration: relax `user_preferences_style_tone_check` CHECK to include `'auto'` (constraint verified live; one ALTER).
  2. `StyleTone` union (`src/lib/pipeline/user-prefs.ts:47`): add `"auto"`.
  3. Style form (`style-capture-form.tsx`): 6th tone card — "Auto (recommended) — investigative for scandals, analytical for markets, concise for breaking news."
  4. Generate route `buildStylePrefix`: `auto` branch emits an adaptive-tone instruction (choose register per item from the 5 named registers based on the item's content type; anchors unchanged).
  5. Bump `GENERATE_PROMPT_VERSION` → `generate-v0.3`.
- **Complexity:** Low (~40 lines + 1 small migration). Sonnet-grade.
- **Timing constraint (hard):** ship **pre-alpha or post-alpha, NEVER mid-alpha** — changing generation style mid-run contaminates the week-1 vs week-4 Voice-DNA relevance measurement (`GOAL.md` §3.1).
- **Unlock trigger:** founder approval to bundle with the pre-alpha fix batch (onboarding-persist 42P10 + source-health NULL), or first post-alpha batch.

### T0.7 — Rich source discovery: catalog depth + browse/filter inside onboarding (status: DISCUSSED, founder 2026-06-10)
- **Founder feedback (live-driving refine step):** AI picks are fine but a closed list — no categories, no per-topic quotas ("show me 5-10 AI + 5-10 economic + 5-10 markets"), no "see more options," no source-KIND labels (government report / fund-manager analysis / financial filing / newspaper / blog / social / API feed). Paywall badges exist but are weak. His prior Pipedream pipeline had richer diversity (10 finance RSS feeds + Finnhub/Benzinga/Alpaca/AlphaVantage APIs + X posts).
- **Verified gaps (2026-06-10):**
  1. **Catalog depth:** 9 of his 10 Pipedream RSS feeds are NOT in `source_catalog` (only Fed present). **Zero `type='api'` catalog rows exist** despite fully-built fetchers in `src/lib/pipeline/ingest/` — the API engine is wired but unreachable (buried-built class). No social/X rows either.
  2. **Discovery UX:** the catalog browser (search + paywall filters) EXISTS on `/sources` but is not surfaced in the onboarding refine step; no category grouping/quotas/see-more anywhere; no source-kind taxonomy labels on cards.
- **Split into two work items:**
  - **(a) Catalog seeding — cheap, no UI, can run anytime:** `source-catalog-curator` agent seeds his 10 Pipedream feeds + `api`-type rows for Finnhub/Benzinga/Alpaca/AlphaVantage (+ X/social when X ingest ships) with full metadata (category, subcategory, paywall, source_kind). Output: SQL inserts, validated URLs.
  - **(b) Discovery UX redesign — designed feature, discovery protocol required:** refine step gains category sections with per-topic counts, "see more in this category" (pulls from catalog RAG beyond the AI's first pick), source-kind labels, and embeds the existing catalog browser as the power-user path. Touches onboarding UI + agent response shape.
- **Timing:** (a) anytime (data-only). (b) post-deploy, pre- or post-alpha per founder; NOT mid-alpha (changes onboarding the §3.2 hostile-user test measures).

---

## T1 — After alpha proof (Voice-DNA-ranking delta ≥ +10 pp)

### T1.1 — Voice DNA burst-unlock + transparency surface
- **Vision:** At N=10 edits/corrections per user, surface a "What ForgeMinds learned about you" page. Show the user the inferred preferences in plain language, let them correct it.
- **Why moat:** Transparency builds trust → trust drives more edits → more edits sharpen Voice DNA. Psychological compounding.
- **Prerequisites:** Voice DNA edit-history capture (Phase 5 schema). Enough alpha users have crossed N=10.
- **Unlock trigger:** First alpha user crosses N=10 edits.
- **Audit reference:** Audit Section 8 item #2.
- **Complexity:** Medium (mostly UI + a "Voice DNA snapshot" view of stored vectors).

### T1.2 — Multi-signal Voice DNA (not just text edits)
- **Vision:** Voice DNA learns from what they READ (implicit preference), TIME SPENT, HIGHLIGHTED passages, FOLLOW-UP SEARCHES — not just explicit edits.
- **Why moat:** Edit history is 1 signal. Reading behavior is richer and free (no user effort required).
- **Prerequisites:** Text edits-based Voice DNA must be proven working first (T1.1). Behavioral_events table must be populated with enough signal-types.
- **Unlock trigger:** T1.1 ships AND Voice-DNA from edits alone is validated.
- **Audit reference:** Audit Section 8 item #5.
- **Complexity:** High (multi-signal weighting, requires real data to tune).

### T1.3 — Per-action-type Voice DNA
- **Vision:** Separate Voice DNA shards for different action vectors (invest vs. build vs. content vs. network). "I know your *investment* intent better than you do" is a stronger moat claim than generic ranking.
- **Why moat:** Per-vector depth > generic shallow. Specialization is defensible.
- **Prerequisites:** ≥ 1 alpha user has actions across ≥ 3 action vectors with logged outcomes.
- **Unlock trigger:** Multi-vector outcome data exists.
- **Audit reference:** Audit Section 8 item #6.
- **Complexity:** High (schema split + vector embeddings per vector type + outcome attribution).

### T1.4 — Cost-aware AI router (real, not aspirational)
- **Vision:** `model-router.json` consulted at runtime, not just documentation. Per-task budget caps fire when exceeded. Fallback chain engaged automatically on primary degradation.
- **Why moat:** AI-future-proofing per `GOAL.md` §3.3. Model swap-ability becomes structural, not designed.
- **Prerequisites:** Forced fallback test in production at least once.
- **Unlock trigger:** Concurrent with alpha — needs to be true before any paid users.
- **Audit reference:** Audit Section 6.
- **Complexity:** Medium (mostly hardening + observability).

### T1.5 — Provider A/B testing per user
- **Vision:** Router automatically A/B tests provider/model per user, measures outcome quality (saved/dismissed rate, edit rate, time-spent), routes future calls to the winner.
- **Why moat:** Adapts to new model releases automatically. When the 2027 frontier model ships, ForgeMinds discovers within 1 week that it's better for cohort X, switches them, doesn't even ask Victor.
- **Prerequisites:** T1.4. Need outcome quality scoring per AI generation.
- **Unlock trigger:** Router fallback proven working.
- **Audit reference:** Audit Section 8 item #4.
- **Complexity:** High (real ML loop, not just routing).

### T1.6 — Source quality feedback loop
- **Vision:** Source catalog quality scores update automatically from aggregate save/dismiss/edit data. Sources that nobody saves degrade; sources that everyone saves rise. Catalog becomes living.
- **Why moat:** Curator-only quality is a 2010 design. Data-driven quality compounds with use.
- **Prerequisites:** ≥ 100 user-aggregated save/dismiss events per source (k=5 floor per `aggregate-design.md`).
- **Unlock trigger:** Community Brain hits its first k=5 cohort.
- **Audit reference:** Audit Section 8 item #7.
- **Complexity:** Medium (aggregator query + UI badge).

### T1.7 — Listen to your briefs: private podcast feed + produced audio/video (status: DISCUSSED, founder 2026-06-13)
- **Founder framing (verbatim, 2026-06-13):** "some might prefer briefs to be read to them on a walk or a car… each morning or evening or when scheduled to also have an option to listen to briefs or summaries or articles… an option in what voice, tone, style (radio or news broadcaster or blogger or podcaster, etc) and at what speed and any music or effects overlay, or even video if needed."
- **Vision:** A delivery CHANNEL, not just a feature: ForgeMinds generates an audio version of a brief/summary/article on the user's schedule (morning/evening/cadence) and exposes a **per-user authenticated private podcast RSS feed**. The user adds the feed once to Apple Podcasts / Spotify / Overcast; scheduled episodes then appear automatically and they listen hands-free on a walk or drive. Plus on-demand "listen" + download in-app.
- **Configurable (Rule 55, per-user):** voice, **register/style** (news-broadcaster / radio-host / podcaster / blogger / calm-explainer), speed, intro/outro music + effects overlay (on/off + pack), length (full brief vs digest). Ties directly into Voice DNA (`style_*`) — audio is Voice DNA made audible. Schema already anticipates it: `content_type` enum has `podcast_script` + `video_prompt`.
- **Why moat:** Daily-habit retention driver (people don't open an app on a walk, but a podcast episode plays itself) + extends Voice DNA from text to voice (harder to clone). Distribution channel that compounds with the personalization moat rather than being mere surface (cf. anti-pattern #3 — this is gated to ride ON the moat, not substitute for it).
- **Complexity sub-tiers (ship escalating, gate each on cost proof):**
  1. **Read-aloud (T1-able):** TTS of the brief via a provider (OpenAI/Google/ElevenLabs stock voices — NO voice cloning) → store audio in R2/Supabase Storage → in-app player + the private RSS feed. Voice + speed + style-via-prompt-shaped-script. Medium.
  2. **Produced podcast (T2/T3):** `podcast_script` content type → intro/outro music + effects + optional multi-voice → a real "show." High.
  3. **Video (T3+, speculative):** `video_prompt` content type → generated video. Very high cost/complexity; clearly latest.
- **Cost + safety (hard constraint):** TTS and especially video are real per-use external costs → governed by VIBE Rule 21 (hard token/cost budgets) + the cost-aware router (T1.4) + per-tier metering; refuse-to-generate above the user/tier budget. Provider STOCK voices only in V1 (custom-voice cloning has consent/legal exposure — defer). Audio is an AI-output artifact → carries `prompt_version` + source traceability like any other.
- **Prerequisites:** Core brief delivery loop live (T0.2); the scheduling dispatcher already exists (`user_preferences` schedule + pg_cron) so "each morning/evening" is just a new delivery channel on the existing schedule; (for voice-DNA-styled audio) Voice DNA. Storage bucket + a TTS provider wired through `model-router.json`.
- **Unlock trigger:** After Phase 1 (the configurable+actionable core) ships and the brief loop is proven; read-aloud MVP can be an early delivery-channel add, the produced/video tiers gate on cost proof + paid tiers.
- **Complexity:** Read-aloud Medium; produced High; video Very high. ← promote candidate (read-aloud tier) once Phase 1 lands.
- **Addendum (2026-07-01, founder):** xAI shipped **Grok Voice Agent Builder** (x.ai/voice — no-code voice agents, $0.05/min audio + $0.01/min telephony, MCP + tools + guardrails, 25+ languages). Two relevance vectors: (1) a candidate **TTS/voice tech** for the read-aloud / produced tiers above — evaluate at unlock against Gemini multi-speaker TTS (the Google AI Talk Radio path already noted) + ElevenLabs, on cost/quality; (2) the likely tech for an **interactive** "call ForgeMinds, it reads my brief and I ask follow-ups / it acts via MCP" agent — but that is NOT this item; it belongs to **T3.3 (agent ecosystem / Phase 9)**, gated on Trust-Ladder Loop 6+. Do not conflate the audio *delivery format* (T1.7) with the voice *agent* (T3.3). Both stay post-dogfood (lesson #110).

### T1.8 — "Morning Edition": print/PDF delivery channel + (T3) multi-surface life-digest (status: DISCUSSED, founder 2026-07-01)
- **Founder framing (verbatim, 2026-07-01):** cited the Codex example — "creates a newspaper for me every morning: unread messages, calendar, surf report, news… anything I can do to stay off my phone until later in the day is a priority." Wants the brief scheduled + exported + optionally auto-printed to a local printer.
- **Vision (two distinct pieces, gated separately):**
  - **(a) Print/PDF delivery channel (T1 — sibling of T1.7 audio):** on the user's existing schedule, render the brief as a **print-ready PDF** ("Morning Edition" layout) + in-app export/download. Rides the SAME `user_preferences` schedule + `deliver` step + Rule-55 delivery-channel enum that email/audio use — a new channel, not a new system.
  - **(b) Multi-surface life-digest (T3 — integration-gated):** widen beyond news to **calendar + unread messages + weather/local** so it's a true "start your day" page. Pulls in NEW OAuth integrations (email/calendar) and **PII** (message/calendar content) → own architect-probe + privacy design (`privacy.md`: no names/PII to the AI) + own cost. Belongs with T3.5 (integrations = surface, empirical-demand-gated).
- **Hostile-architect note (the trap):** Codex's newspaper prints because Codex runs **locally on the founder's machine**. ForgeMinds is a **cloud, multi-tenant** app — a server cannot/should not reach into each user's local printer. So the SaaS ships **print-ready PDF + email-a-PDF**; true "auto-print to my printer" is a **local-companion** concern (a tiny local agent that polls the brief API → OS print) — fine for the founder's own dogfood, NOT built into the product. Do not build cloud→printer.
- **Why moat:** none directly — this is a **delivery channel** (surface), like T1.7. It rides ON the personalization moat (anti-patterns #2/#3: add only because it deepens the daily-habit loop, not for parity). The "stay off my phone" morning ritual is a retention driver.
- **Prerequisites:** (a) core brief loop proven (post-S7 dogfood) + the existing schedule/deliver spine + a PDF renderer + a storage bucket. (b) OAuth integrations + PII/privacy design + cost model.
- **Unlock trigger:** (a) after S7 dogfood — the brief must beat Pipedream first (delivering a mediocre brief as a PDF just makes it a mediocre PDF). (b) T3 / empirical demand.
- **Complexity:** (a) Low–Medium (PDF render + one delivery-channel enum value). (b) High (multi-integration + privacy).
- **Cross-ref:** T1.7 (audio delivery channel — same pattern, different format), T3.5 (integrations), Competitive-intel 2026-06-25 (Google Finance already ships the scheduled-briefing thesis; the wedge is breadth + action-output + audio/print, not out-financing Google).

---

## T2 — After flywheel observable (Community Brain first k-hit + action outcome logged)

### T2.1 — Community Brain transparency toggle
- **Vision:** Power users can toggle "show me which signals are from my personal history vs. community brain" on any ranked item. Reduces opt-out friction. Builds trust in Community Brain.
- **Why moat:** Transparency drives community brain opt-in retention. Opt-in retention drives k-threshold crossings. K-threshold crossings drive moat.
- **Prerequisites:** Community Brain actually has surfaced ≥ 1 signal to a user.
- **Unlock trigger:** §3.4 from `GOAL.md` becomes true.
- **Audit reference:** Audit Section 8 item #8.
- **Complexity:** Medium (UI + provenance metadata on every ranked item).

### T2.2 — Action template effectiveness scoring (live, not static)
- **Vision:** Every action template tracks: how often surfaced, how often accepted, how often completed, median outcome rating. Templates with poor effectiveness float DOWN. Best-performing templates surface MORE.
- **Why moat:** Static action templates from spec = vendor opinion. Data-driven templates = community-derived wisdom.
- **Prerequisites:** ≥ 10 templates have been surfaced ≥ 5 times each across multi-user sample.
- **Unlock trigger:** Sufficient action outcome data exists.
- **Audit reference:** Audit Section 8 item #4 (revisited).
- **Complexity:** Medium (template_effectiveness schema + aggregator + ranking integration).

### T2.3 — Outcome attribution model
- **Vision:** When user logs outcome, ForgeMinds asks: "Was it the article + action, or would it have happened anyway?" Counterfactual reasoning surface. Distinguishes correlation from causation.
- **Why moat:** Pure outcome data has noise. Attributed outcome data is signal. The difference between "we saw +X% saves on Mondays" and "we observed +X% saves on Mondays caused by template Y for cohort Z."
- **Prerequisites:** Enough completed actions to do baseline rate vs. treatment rate analysis.
- **Unlock trigger:** ≥ 50 completed actions across alpha + beta users.
- **Audit reference:** Audit Section 8 item #9.
- **Complexity:** Very high (causal inference is hard; even rough heuristics here are valuable).

### T2.4 — Behavioral-clustering source suggester
- **Vision:** Instead of catalog-only, propose sources to users based on what cohort-similar users save+act-on most. "Readers like you read X — want it added?"
- **Why moat:** Catalog is static. Behavioral clustering is dynamic + harder for competitor to replicate without your behavioral data.
- **Prerequisites:** Community Brain cohorts exist + each cohort has behavioral data sufficient to cluster on.
- **Unlock trigger:** T2.1 ships AND ≥ 3 cohorts have crossed k=5.
- **Audit reference:** Audit Section 10 follow-on.
- **Complexity:** High (clustering algorithm + recommendation engine + privacy preservation).

### T2.5 — Action template auto-generation from observed actions
- **Vision:** Per `data-flywheel.md` Phase F: when ≥ 5 users take the same untemplated action with positive outcomes, ForgeMinds proposes it as a NEW template for human review. Templates compound with use.
- **Why moat:** Spec-defined templates are V1. Community-derived templates are V3+ and structurally impossible to clone without the community.
- **Prerequisites:** Outcome attribution (T2.3) exists. Action ontology is mature.
- **Unlock trigger:** ≥ 100 logged completed actions across alpha + beta.
- **Audit reference:** Audit Section 8 (cross-promoted).
- **Complexity:** Very high.

---

## T3 — After paid users + retention (the "is this real" tier)

### T3.1 — Per-user model preference learning
- **Vision:** Beyond static `user_preferred` in BRIEF.md. ForgeMinds learns per-user which provider produces better outcomes for THIS user's content. "Claude works better for your invest content; Gemini works better for your career content."
- **Why moat:** Vendor diversity adaptive per-user is the strongest AI-future-proofing claim a product can make.
- **Prerequisites:** T1.5 (A/B testing per user). Multi-week per-user outcome data.
- **Unlock trigger:** Architect-tier users with > 8-week retention exist.
- **Complexity:** Very high.

### T3.2 — Cross-brain insight propagation
- **Vision:** A pattern learned in user A's Personal Brain (with consent) becomes an aggregate signal in their Shared Brain (team) and Community Brain (cohort). Insight propagates outward at controlled trust gradients.
- **Why moat:** Multi-tier Brain is in the spec but never built end-to-end. T3 is where it actually fires.
- **Prerequisites:** Shared Brain has ≥ 1 active team. Community Brain has ≥ 3 active cohorts.
- **Unlock trigger:** Multi-user team formed in alpha + beta.
- **Complexity:** Very high (privacy preservation across tiers is hard).

### T3.3 — Agent ecosystem (Phase 9 in spec)
- **Vision:** AI agents for research, drafting, action execution. NOT in V1. NOT before T3.
- **Why moat:** Premature agents = expensive failures. Agents on top of a proven flywheel = the real OS.
- **Prerequisites:** Trust Ladder unlocked to Loop 6+ for at least 3 users. Voice DNA proven. Action templates proven.
- **Unlock trigger:** §6 of `GOAL.md` (post-V1) gate fully crossed.
- **Complexity:** Extreme.

### T3.4 — Mobile / PWA (Phase 10 in spec)
- **Vision:** iOS + Android. Native-feel briefs. Voice-DNA-aware notifications. NOT before T3.
- **Why moat:** Mobile is a distribution channel, not a moat. Build only after web product retention proves the moat exists.
- **Unlock trigger:** Web retention week-12+ ≥ 40% across paying users.
- **Complexity:** High (especially native; PWA path is medium).

### T3.5 — Marketplace integrations
- **Vision:** Wire Stripe (subscription tiers ✅ in spec), Resend (email delivery ✅), Plaid (financial data — Phase 3 invest actions), GitHub (build actions), LinkedIn (network actions). Each via Vercel Marketplace where available.
- **Why moat:** Integrations are surface area, not moat. Build only what alpha users actually need.
- **Prerequisites:** Alpha proves which action verticals are most-used. Build integrations for those first.
- **Unlock trigger:** Empirical demand.
- **Complexity:** Per-integration medium.

### T3.6 — Paywalled content access layer
- **Vision:** Per the 2026-05-16 discussion about WSJ / Bloomberg / NYT. Three modes:
  1. Bring-your-own-subscription RSS (subscriber RSS URLs in user's source list)
  2. Perplexity Pro API as licensed proxy (already wired; meter per-query for paid tiers)
  3. Direct publisher API (Bloomberg / Dow Jones — only at enterprise tier)
- **Why moat:** Access to paywalled content via licensed channels = content depth competitors can't replicate.
- **Prerequisites:** T0 done. Stripe wired. Cost-pass-through model decided.
- **Unlock trigger:** Architect-tier exists with paying users.
- **Complexity:** Medium per mode.

### T3.7 — Article summarization with substring-validated extraction
- **Vision:** Long articles get 5-8 key-point extractions. Every point traces to a source quote in the article. No hallucination.
- **Why moat:** Honest summarization is rare. Most summarizers hallucinate. Build the substring-validated version per `ai-first-principles.md` §5 + `data-flywheel.md` §8.2.
- **Prerequisites:** Jina Reader integration (or equivalent full-text fetcher).
- **Unlock trigger:** First paying user requests it.
- **Complexity:** Medium.

### T3.8 — Cross-source fact-checking
- **Vision:** When a key claim appears in a brief (a number, a price, a named fact), ForgeMinds checks 2 other sources in the catalog automatically. Flags discrepancies. Surfaces consensus and disagreement.
- **Why moat:** Single-source claims are noise. Cross-referenced claims are knowledge. Honest cross-checking is hard to fake.
- **Prerequisites:** Entity resolution working at scale. T3.7 (article extraction) working.
- **Unlock trigger:** T3.7 ships AND entity resolution catalog populated.
- **Complexity:** High.

---

## T4 — Speculative (revisit annually)

### T4.1 — Voice DNA as a portable asset
- **Vision:** User can export their Voice DNA (with full transparency about what's stored). Future: import it to other AI tools, take it with them.
- **Why interesting:** "Your AI persona is yours" is a strong differentiator from lock-in models. May be required by future regulation.
- **Caveat:** Could erode moat if competitors accept imports. Decide later.

### T4.2 — Federated Community Brain
- **Vision:** Cross-instance Community Brain — if ForgeMinds is ever self-hostable, federated aggregation across instances. Bigger cohorts, more signal.
- **Why interesting:** Privacy + scale at the same time. Hard but distinctive.
- **Caveat:** Wildly premature. Don't think about this before T3.

### T4.3 — On-device Voice DNA inference (privacy-first variant)
- **Vision:** Voice DNA vector + ranking can run on-device for users who want zero-cloud personalization. Cloud only for Community Brain aggregates.
- **Why interesting:** Privacy-first tier could be a $99/year flat product (vs. SaaS $14.99-34.99/mo).
- **Caveat:** Doubles product surface area. Probably its own product (ForgeMinds Local) like the Local FinKeel sibling.

### T4.4 — Action engine marketplace
- **Vision:** Third parties publish action templates. Users install. ForgeMinds takes a cut on outcomes.
- **Why interesting:** Platform economics. Massive distribution.
- **Caveat:** Marketplace = trust risk + moderation cost. Years away.

### T4.5 — Open-source the locked-state honesty pattern
- **Vision:** Publish the substring-validator + locked-state-copy-first patterns as an open library. Become the reference implementation for honest AI products.
- **Why interesting:** Category-defining for the "honest AI" niche. Marketing + recruiting moat.
- **Caveat:** Bandwidth. Don't until ForgeMinds is post-PMF.

### T4.6 — Per-cohort prompt optimization
- **Vision:** Different cohorts respond better to different prompt structures. ForgeMinds A/B tests prompts per cohort, learns which prompt template maximizes outcomes for which cohort.
- **Why interesting:** Prompt-level moat. Cohort-tuned prompts compound with prompt-version logging.
- **Caveat:** Requires very large cohort populations to be statistically valid.

### T4.7 — Adversarial robustness suite
- **Vision:** Prompt-injection defense, data-poisoning detection, output-fingerprinting. ForgeMinds is itself resistant to attempts to corrupt its training signal.
- **Why interesting:** B2B / regulated industries will require this eventually.
- **Caveat:** Premature until ForgeMinds is post-PMF and has B2B customers.

---

## Competitive intel — 2026-06-25 (Google Finance + Google AI Talk Radio)

> Logged so the read survives the handoff. **Does NOT change the critical path** (S3.2 → host fix → S4/S5 → dogfood). Anti-pattern #2 applies: add a competitor feature ONLY if it closes a loop.

**Google Finance upgrade (Jun 25 2026)** — three features, mapped to ForgeMinds:
| Google Finance | ForgeMinds | Verdict |
|---|---|---|
| Personalized market briefings on a schedule, tied to watchlist/portfolio, push notification | **This is FM's core** (pg_cron dispatcher + `user_preferences` schedule + `tracked_tickers` + per-user brief). | **Already have** (delivery is email/dashboard, not push — minor gap). |
| "Key moments — why a stock moved" | FM's enrich-step NL market read + per-story analysis. | **Partial** — polish later. |
| AI portfolio tracking (screenshots/CSV/PDF/describe → holdings → allocation Q&A) | Not present; FM tracks an *interest/reading graph*, not *holdings analytics*. | **Different surface** (closer to FinKeel). Defer; possible T3. |
| Real-time feed / Android app | FM is a digest, web+email; mobile = T3.4. | **Deliberate non-goal for V1.** |

**Strategic read:** (1) *Validation* — Google just shipped FM's exact thesis (scheduled, personalized, watchlist-tied briefings) at scale. (2) *Threat* — Google Finance is now a free, distributed competitor in the **finance vertical**. **Do NOT try to out-finance Google** (real-time data, mobile, distribution). The wedge is what Google Finance can't/won't do: **(a) breadth** — any topic, not finance-only (Layer 1); **(b) action-output** — FM drafts the post/video/podcast, Google hands you a briefing to read; **(c) the learning loop / Voice DNA**. Lean into breadth + action-output + audio.

**Google AI Talk Radio (AI Studio, managed agents):** deep research → multi-host voice script → audio in ONE API call. This is the **reference architecture / likely API path for T1.7** (audio "Listen" feed) + the S4 video-prompt output — a differentiator Google Finance does NOT have. Implementation when T1.7 unlocks: don't rebuild the brief — pipe the existing `briefs` row text into a Gemini multi-speaker TTS step → store audio → per-user private podcast RSS. **Stays T1/T2 (post-dogfood); do not pull forward** (lesson #110 — prove one instance before chasing feature breadth).

---

## Sequencing logic — what unlocks what

```
                                T0 (concurrent w/ Phase 2 alpha prep)
                                 │
                                 ▼
                  alpha proof: Voice-DNA delta ≥ +10 pp
                                 │
                ┌────────────────┴──────────────────┐
                ▼                                   ▼
              T1.1 ────► T1.2 ────► T1.3        T1.4 ────► T1.5
       (transparency)  (multi-     (per-action  (router      (A/B per
                       signal)     vector)      hardening)    user)
                                                                │
                                                                ▼
                                          T1.6 (source quality feedback)
                                                                │
                                                                ▼
                       Community Brain k-hit + action outcome logged
                                                                │
                                                                ▼
                       T2.1 ────► T2.2 ────► T2.3 ────► T2.4 ────► T2.5
                                                                │
                                                                ▼
                                Paid users × > 8-week retention
                                                                │
                                                                ▼
                                T3.1 - T3.8 (sequenced per demand)
                                                                │
                                                                ▼
                                      T4.x (speculative; revisit annually)
```

---

## Anti-patterns to avoid

Things that look like ideas but ARE NOT going into this backlog:

1. **"Make the UI prettier."** Polish is a Phase 8+ concern. Don't backlog cosmetic improvements; they get done as part of feature work.
2. **"Add feature X because competitor has it."** Competitor parity is not a moat. Add a feature only if it closes a feedback loop.
3. **"Build a Notion integration."** Integrations are surface, not moat. They go in T3.5 — empirical demand only.
4. **"Open AI plugin store / GPT store."** Distribution channel ≠ moat. Defer.
5. **"Use the new shiny model X."** Model selection is handled by `model-router.json` automatically once T1.4 and T1.5 ship. Stop trying to manually pick models per task.

---

## How to add to this backlog

1. Write the item under the appropriate tier (T0-T4) using the full template (Vision / Why moat / Prerequisites / Unlock trigger / Complexity).
2. Date the addition.
3. If it's a candidate to PROMOTE to `CURRENT_SPRINT.md`, note "← promote candidate" in the item.
4. Items never get deleted, only marked `[shipped]`, `[obsoleted]`, or `[rejected with reason]`.
5. Every quarter, audit T4 — anything still speculative after 1 year either promotes to T3 or gets `[rejected: superseded by Y]`.

---

*Locked 2026-05-16. Re-review at every phase close (alongside `GOAL.md`). Promote candidates only via `CURRENT_SPRINT.md` and explicit founder approval — no silent promotions.*
