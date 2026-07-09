# ForgeMinds — Honest Full Audit (2026-07-08)

> **Author:** Claude (Desktop), 5-agent read-only audit + live-DB verification.
> **Method:** 5 parallel read-only subagents (AI-native pipeline, roadmap-vs-built, Pipedream parity, UI/customization, vision/moat) each verifying against actual code + the live dev DB `ymgbjtgczgnooscigplb`, NOT the handoff docs (lesson #108). Plus the lead session read the 2 real briefs' actual content.
> **Trigger:** Founder asked, before any Vercel cutover, whether the product is actually done / working / AI-native / better than his Pipedream finance workflow. Answer: **no, on all counts.**
> **Founder decision after this audit (2026-07-08):** rethink the product at vision altitude before more building.

---

## The one-sentence verdict

Not done, not working in production, not AI-native at runtime, not better than the founder's Pipedream workflow. It is a genuinely well-architected research prototype whose core promise — a personalized finance-first brief — **has never actually been delivered, not once, not even for the founder.**

## The centerpiece evidence: the 2 real briefs

In the product's entire life it produced **exactly 2 real AI briefs** (2026-05-17, 2026-06-14); all other 21 briefs are heuristic shells. Reading the best one (06-14, generated *after* the personalization fixes):

- Leads with SpaceX IPO / xAI lawsuit / US-Iran / UK police AI scandal, then serves a finance user **Antarctica sea ice, a lupus therapy trial, the Epstein files, an FBI raid on an Ohio voting group, UK youth unemployment, CAR T-cell therapy.**
- **Zero tracked tickers. Zero market data. Zero prices.** For a user whose stated interests are markets/Fed/crypto/earnings and who explicitly *excluded* lifestyle/entertainment.
- The 05-17 brief is Thames Water + Ukraine drones — even further off-target.

This is a generic BBC/Guardian world-news digest, not a finance intelligence product. The founder's memory ("Pipedream produces better output") is confirmed by the artifacts.

## The two-layer root cause (this changes the plan)

The cutover alone will NOT fix the product. Two stacked causes:

**Layer 1 — the fixes aren't deployed.** Local `master` is **38 commits ahead of `origin/master`** (frozen on an old Gemini-era commit). Production runs *pre-fix* code — no Anthropic consolidation, no strict resolution, no fail-loud gate. Proof from the live DB: `score` runs daily reporting `completed` with `ai_calls_made=0`, which is **impossible** under the current local code (it would throw `AI_ZERO_CALL`). The deployed bundle predates commit `654113d`.

**Layer 2 — even the fixed code produces generic news.** `curateStories()` (`src/lib/pipeline/curator.ts`) **never receives the user's `topics`/`excluded_topics`** — it picks "the best article from every category present," blind to the interest graph. The `sources` table contains generic `bbci.co.uk/news/world` + `theguardian.com/world` feeds competing for slots. So a BBC/Guardian world item that clears the 0.45 composite floor (relevance is only 45% of the score) gets an automatic category-diversity seat regardless of the user's finance-only interest. **Deploying the fixes does not fix this — it's a separate, unbuilt fix.**

## Consolidated scorecard

| Dimension | Verdict | Evidence |
|---|---|---|
| AI at core (deployed) | **F** | 0 AI calls across every step for 24 days |
| AI at core (local code) | B+ | Fix code is real & thoughtful — just not running |
| Roadmap done-and-working | ~15–20% | **47 of 74 tables have 0 rows**; every "S1–S3.2 DONE" is a one-time proof that decayed within days |
| Pipedream parity | Pre-WF1 | `briefs.ticker_symbols` = 0/23 populated; charts/social/video 100% unbuilt (no chart lib installed) |
| Moat (learning loop) | Vapor | 4 outcome rows ever; 0 Voice-DNA training samples; 1 user |
| Per-user customization | **A−** | Settings genuinely edits topics/tickers/cadence/tone/density + persists (round-trip verified) |
| Stranger-usable | C− | Good onboarding exists but nothing routes a new user to it; home = raw unscored feed |
| Landing/pricing honesty | Fails | Sells 6 features with zero code (Dot Connector, Collective Brain, semantic search, Trust Escalation, API, Draftpad); 3 tiers, no billing code |
| Vision alignment | ~15–35/100 | Down from locked 51; every hard floor breached except Vision |

## What is genuinely real and good (build on these)

1. **Settings/customization spine** — real, editable, per-user, round-trip verified. The "no one-size-fits-all" demand is honored at the foundation.
2. **Market-data plumbing (S3)** — Finnhub/CoinGecko/Alpaca wired; 11/11 watchlist tickers enrich with real prices + intraday.
3. **The accumulated fix code** — strict resolution, substring anti-fabrication gate, fail-loud watchdog, per-user source-gated ingest. Real S1–S3 engineering; just not live.
4. **Onboarding wizard** — AI-assisted intake → refine → style → confirm over a 218-row source catalog; well-built (but undiscoverable — see below).

## What is vapor or unbuilt

- **WF2 entirely** — social drafts (manual endpoint, 0 rows ever), video prompts (no code at all), charts (no chart library even installed). The "does-the-work" half that would *beat* Pipedream doesn't exist.
- **The moat** — Community Brain (6+ tables, 0 rows, "the real moat" in DECISIONS but no code), Voice DNA (real Voice DNA = a tone dropdown fed to a prompt, not the multi-signal system the backlog describes), dot connections, event chains, geographic intelligence — richly "decided," zero consumers.
- **Monetization** — no Stripe, no tier enforcement; pricing tiers decorative.
- **Buried logic** — `src/lib/action-templates/registry.ts` is a hardcoded 456-line array with zero importers.

## The corrected path (what the audit implies)

1. **Before any cutover — fix the 3 core-brief blockers:** (a) pass user `topics`/`excluded_topics` into `curateStories()` + a hard relevance floor; (b) scope the source pool finance-only for a finance user (drop/deprioritize BBC/Guardian World); (c) get the 38 local commits into whatever actually deploys.
2. **Then cut over + deploy** (Vercel Hobby recommended; deploy from the local folder via `vercel --prod`, NOT GitHub integration, or push origin first — GitHub is 38 commits stale).
3. **Judge one real brief** vs Pipedream. Core relevance finally there → proceed; not → diagnose before building.
4. **Build WF2** (charts → social → video) for real Pipedream parity.
5. **Dogfood** (Pipedream off, 5–7 days) — the actual V1 verdict.
6. Only after the loop is proven: touch the moat, fix landing honesty, wire billing.

## Cross-cutting lessons this audit re-confirms

- **#104 / #111** — `status='completed'` with `ai_calls_made=0` is not evidence; the deployed pipeline has reported green while making 0 AI calls for 24 days.
- **#108** — the handoff docs were stale/partly wrong; only the live DB + the actual brief content told the truth.
- **#110** — the universal abstraction (broad OS: Community Brain, Voice DNA, 47-table schema) was built before one concrete instance (a finance brief that beats Pipedream) was ever proven. This is the core strategic error.
- **#100** — the landing page sells AI features that don't exist (the "AI as marketing copy" trap).

## Standing facts (for the next session)

- Host: still Cloudflare Worker (`private.app_config.forgeminds_base_url`), broken for AI routes (ERR-026).
- No off-platform backups exist — the dev DB is the only copy (P7 overdue).
- 1 user (founder test account). `article_outcomes`=4, `saved_items`=0, `content_drafts`=0, `action_plans`=0.
- GitHub `origin/master` is 38 commits behind local — do NOT clone-and-deploy from GitHub.
