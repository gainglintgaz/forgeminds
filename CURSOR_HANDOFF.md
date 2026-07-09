# ForgeMinds — Cross-Tool Kickoff & Knowledge Transfer (Cursor / Codex / Antigravity)

> **Written 2026-06-15 by Claude Code (Desktop).** The founder is approaching his Claude weekly limit (resets **2026-06-24**) and wants **Cursor** (or Codex / Gemini-Antigravity) to pick up and drive ForgeMinds to a testable **V1.1**.
> **This file is self-contained for a SINGLE-AGENT tool.** It does not assume the Claude two-session model or the VibePromptRig factory rules. Read this top to bottom; the deeper engineering detail is in `NEXT_SESSION.md` (same folder).
> **Read order:** this file → `NEXT_SESSION.md` → `docs/architecture/forgeminds-v1-finance-core.md` → `errors-fixed.json` (ERR-019…028).

---

## 0. How to use this doc (you are the single agent now)

In the Claude workflow there were two agents (a planner + a one-writer executor). **In Cursor/Codex/Antigravity you are BOTH** — you plan, edit code, run the terminal, run SQL, and deploy. So:
- You hold the only write-lock. Edit `src/`, run migrations, build, and deploy directly.
- Verify every claim against the **live database**, not against this doc (docs go stale; the DB is truth — lesson #108).
- Work in **thin, verifiable slices**. After each slice: `npx tsc --noEmit` + `npm run lint` + run the live-DB verification query + a browser click-through. Don't declare "done" on a green build alone (that mistake already cost this project days).

---

## 1. Philosophy · Vision · Mission · Goals

**Philosophy.** AI does *real work in the core loop that compounds with use* — not theater bolted onto a manual app. Every number/claim is traceable to a real source; nothing is faked or hardcoded. If there isn't enough signal yet, the app says so honestly rather than inventing.

**Vision.** A **personal intelligence OS** that reads the world for you across *any* topic you care about, understands it deeply, does the downstream work (drafts, charts, summaries, actions), and gets sharper about *you* every day.

**Mission (V1).** Beat the founder's hand-built **Pipedream finance workflow** — a daily finance/markets/econ/crypto brief with per-story analysis + tickers + market data + social drafts + video prompts — but multi-tenant, persistent, and learning. Pipedream is the concrete "beat this" benchmark.

**The moat** is *personalization depth + the learning loop* (per-user outcomes → Voice DNA → tomorrow's better pick), NOT "we use AI." Day-one **value** (relevance + does-the-work) is copyable; the compounding per-user data is the moat. Don't conflate them.

**Goals / the 3 hard V1 gates:**
1. **Telemetry** — the AI provably fires (`pipeline_runs.ai_calls_made > 0`, real tokens/day).
2. **Strict resolution** — AI maps categories/tickers/entities to **existing DB UUIDs**, never invents (a miss is flagged, not blind-inserted).
3. **Dogfood** — the founder turns Pipedream **OFF for 5–7 trading days**, lives on ForgeMinds, and rates it **≥ +0.5 higher** than Pipedream. That's the real V1 verdict.

---

## 2. What the final product looks like

**Two-layer depth model (the core design):**
- **Layer 1 — Understanding** (universal, the model's job, day one): relevance scoring, categorization, synthesis, NL interpretation. Works for *any* vertical (finance, medical, science, sports, real estate…) for free.
- **Layer 2 — Instrumentation** (bespoke, **finance-first**): live tickers, prices, charts, market data. Built first for finance because that's the benchmark.

**V1 (finance-core) — what a user gets:** sign up → pick interests/tickers (or let an AI agent help) → a daily personalized **brief**: ~10–15 curated finance/econ/markets stories, each with per-story analysis, the tickers it's about, real market data + a natural-language market read, plus generated **social drafts** and **video prompts** and **charts** — delivered to the dashboard and by email. The user saves/dismisses/rates items; that feedback sharpens tomorrow.

**V1.1 (the testable, shareable increment this handoff targets):** V1 finance-core **complete and stable on a working host**, with **no dead UI** (Save/Dismiss/Act actually work and have a destination), a **shareable preview URL** strangers can sign up to and test, and a basic **feedback path**. Broadening Layer-2 instrumentation to non-finance verticals, the audio/"Listen" podcast feature, and billing are **post-V1.1** (parked, see `IDEAS_BACKLOG.md`).

---

## 3. Honest status — built / working / broken

| Area | State | Notes |
|---|---|---|
| Ingest (per-user, source-type-gated) | ✅ working | `src/app/api/cron/ingest/route.ts` |
| Score (Gemini, personalized, strict categories, tickers) | ❌ **BROKEN on the live host** | **ERR-028** — fails every unattended tick on a malformed UUID. See §4. |
| Curate (top-N, cross-brief dedup, consistency invariant) | ✅ working | |
| Enrich (tickers + market data + NL market read) | ✅ working | watchlist always enriched; story-level tickers sparse (source mix) |
| Generate (Claude brief, weaves market data, prompt_version) | ✅ working | |
| Deliver (email via Resend) | ✅ runs | test-mode sender; domain move = "E2" (memory `forgeminds-email-delivery`) |
| Telemetry / fail-loud / stale-run sweep | ✅ working + verified | pg_cron `forgeminds_sweep_stale_runs */5` |
| Brief UI (`/briefs/[id]`, `/dashboard`) | ⚠️ partial | renders, but the outcome buttons below are dead |
| Save / Dismiss / "Took action" buttons | ❌ dead UI | **ERR-022** — write rows but no destination/effect. Fix = slice **S5**. |
| Host (Cloudflare Workers) | ❌ broken for heavy AI routes | **ERR-026** — move to Railway (or Vercel). Founder action / see §7. |
| Backups | ❌ none | dev DB is the only env, no off-platform backup. **P7 — now due.** |
| Onboarding / source-pick agent | ⚠️ thin | exists; conversational source-discovery is parked (T0.7) |

**Bottom line:** the pipeline produces real, personalized finance briefs when score runs cleanly — but on the live host `score` is in a failure loop, so fresh briefs aren't flowing. Fix that first (§4), then the dead buttons (S5), then a working shareable deploy (§7).

---

## 4. 🚨 THE ONE BLOCKER + your immediate first task (slice S3.2)

**ERR-028 (proven, this is the blocker):** the Gemini scorer non-deterministically echoes a **corrupted copy of a real article id** (drops one hex char: real `2843554a-…` → emitted `284354a-…`). The all-or-nothing batch upsert in `score` rejects the whole batch on that one bad UUID → run fails → 0 articles advance → same batch re-fetched next tick → **infinite failure loop**. **139 articles are stuck in `pipeline_status='fetched'`.**

**Your first slice — S3.2 (scorer id-hardening + batch resilience):**
1. **Parse-time validation** in `src/lib/pipeline/scorer.ts` (the real fix): in the per-batch parse loop, build `const batchIds = new Set(batch.map(a => a.id))` and **drop any returned item whose `item.id` is not in `batchIds` or fails a UUID-shape regex**, before it becomes a `ScoreResult`. Count drops; return `mangledIdsDropped` in the telemetry.
2. **Keep** the route's existing `validArticleIds.has(score.articleId)` filter in `src/app/api/cron/score/route.ts` (~line 132) as a second layer.
3. **Batch resilience** in that route: before the upsert, drop any row whose `article_id` or any `entity_ids[]` value fails a UUID-shape check, so one bad value can never nuke the batch.
4. **Observability:** write `mangled_ids_dropped` into `pipeline_runs.metadata`.
5. Deploy the fix to whatever host is live (§7), then verify on the live DB.

**Verify (live DB, not just local):**
```sql
-- score should now complete with ZERO uuid-syntax failures
select status, count(*) from pipeline_runs
where step_name='score' and started_at > now()-interval '2 hours' group by status;
-- the 139 'fetched' backlog should drain toward 'scored'
select pipeline_status, count(*) from raw_articles
where created_at > now()-interval '24 hours' group by 1 order by 2 desc;
```
Constraints: additive only; keep the single batched upsert (no N+1); never swallow errors silently; telemetry stays truthful. One commit, reference ERR-028.

> The full, copy-paste-ready version of this prompt is in `NEXT_SESSION.md` §10.

---

## 5. Full roadmap to V1.1 — with ownership

Legend: **[CURSOR]** = the coding agent does it · **[FOUNDER]** = Victor only (needs creds/secrets/judgment) · **[EITHER]**.

| # | Work | Owner | Gate / why |
|---|---|---|---|
| **S3.2** | Scorer id-hardening + batch resilience (close ERR-028) | **[CURSOR]** | Unblocks scoring. **DO FIRST.** |
| Host | Move off Cloudflare to a Node host (Railway *or* Vercel) + set env vars + point `private.app_config.forgeminds_base_url` at it | **[FOUNDER]** (creds) — Cursor can prep configs/runbook | Fixes ERR-026; the real "lights stay on" fix. Runbook: `docs/ops/railway-cutover.md`. See §7 for the Vercel alternative. |
| P7 | Daily off-platform DB backup (`pg_dump` → Backblaze B2 / S3) + first restore test | **[FOUNDER]** (storage creds) — Cursor can write the script | Only env, no backups today. Do before inviting testers. |
| **S4** | WF2 outputs: charts from `ticker_data.intraday_json` (Recharts web / QuickChart email) + social drafts + video prompts | **[CURSOR]** | Closes WF1+WF2 parity (architecture §9) — the Pipedream feature match. |
| **S5** | Action engine + **saved-items destination** (fix the dead Save/Dismiss/Act buttons, ERR-022) | **[CURSOR]** | **No dead UI** before testers see it. |
| Preview | A working **shareable preview URL** + a feedback path (see §7) | **[EITHER]** | So members can test before any domain purchase. |
| Onboarding | Make first-run usable by a stranger (pick interests/tickers; AI-assisted source pick is a plus) | **[CURSOR]** | A stranger must complete signup→first brief without hand-holding. |
| **S7** | **Dogfood week:** founder runs ForgeMinds daily, Pipedream OFF 5–7 trading days, rates ≥ +0.5 | **[FOUNDER]** | The V1 verdict (gate #3). |
| V1.1 polish | Hide/disable any remaining non-functional UI; empty/error states; basic account delete + data export | **[CURSOR]** | "A stranger can use it end-to-end" = the V1.1 bar. |

**Sequence:** S3.2 → (host move + P7, founder) → S4 → S5 → preview URL + onboarding → invite testers → collect feedback → S7 dogfood. **Nothing past S3.2 matters until the score loop clears on the live host.**

**Explicitly NOT in V1.1 (parked in `IDEAS_BACKLOG.md`):** Layer-2 instrumentation for non-finance verticals, the audio/"Listen" private-podcast feature, Voice-DNA-driven ranking, Community Brain, Stripe billing, mobile/PWA. Don't pull these forward.

---

## 6. Environment, secrets & security (single-agent rules)

| Thing | Value |
|---|---|
| Project root | `C:\Users\vtbsj\victor-ai-factory\projects\forgeminds` |
| Stack | Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + pgvector + pg_cron) |
| **Dev Supabase project ref** | `ymgbjtgczgnooscigplb` — default for all work. Use `supabase` CLI or the Supabase dashboard SQL editor. |
| Prod Supabase | separate — do not touch without the founder's explicit OK |
| Test user (dev) | `3707759d-9863-4f69-a6d8-f40036fa15f1` (vctrbbnv@pm.me); seeded 7 topics / 11 tickers / 4 excluded |
| Current (broken) host | `https://forgeminds.vctrbbnv.workers.dev` (Cloudflare Worker) |
| AI router | `src/lib/ai/router.ts` — **all** AI calls go through it; every AI-output row carries `prompt_version` |

**Security (do not violate):**
- **Never** open or print a `.env*` file. Reference `CRON_SECRET` and API keys **by name only**. If you need a value set, ask the founder to set it — never echo it.
- No PII to any AI API. No secrets behind `NEXT_PUBLIC_` (browser-exposed). All AI/secret use is server-side.
- Cron routes require header `Authorization: Bearer $CRON_SECRET`.
- Money is BIGINT cents in DB; RLS on every table; DB columns `snake_case`, TS `camelCase`.
- **Keep the founder's Pipedream flow ON** until the dogfood passes — ForgeMinds is not yet a replacement.

**Env vars the app expects** (set in the host's dashboard, never commit): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `GEMINI_API_KEY`, `XAI_API_KEY`, `FINNHUB_API_KEY`, `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `ALPHA_VANTAGE_KEY`, `BENZINGA_API_KEY`, `RESEND_*`. (Full list in the root `CLAUDE.md`.)

---

## 7. Run locally · deploy · ⭐ GET A FREE TEMPORARY SHAREABLE URL (for testers)

**You do NOT need to buy a domain or "publish" anything to let people test it.** Every option below gives a free auto-generated URL.

**Run locally:**
```bash
npm install
npm run dev          # http://localhost:3000
npx tsc --noEmit && npm run lint   # the two checks before any commit
```

**Temporary shareable URLs (pick one — all free, no domain purchase):**

1. **It's already live (zero effort, today):** `https://forgeminds.vctrbbnv.workers.dev` — share it now; testers sign up via Supabase Auth. ⚠️ The heavy AI routes are broken on this Cloudflare host (ERR-026), so briefs won't *refresh* there, but existing briefs and the UI are viewable. Good for a quick look, not a real test.

2. **★ RECOMMENDED — Vercel preview (`*.vercel.app`, free, Next.js-native):** the app is Next.js, so Vercel runs it *without* the OpenNext/Workers translation that causes ERR-026. Vercel's Node functions run full Node with a 300s timeout, so the AI routes work.
   ```bash
   npm i -g vercel
   vercel            # first run links the project → preview URL
   vercel --prod     # stable https://forgeminds-<something>.vercel.app
   ```
   Set the §6 env vars in the Vercel project. Share the `*.vercel.app` URL. This is the simplest path to a **working** tester URL at $0.

3. **Railway (`*.up.railway.app`, free subdomain):** the chosen long-term host (always-on for cron). After deploy it gives a free subdomain that becomes the share link. Runbook: `docs/ops/railway-cutover.md`. (Founder action — needs Railway login.)

4. **Quick demo tunnel (ephemeral, $0):** `npm run dev` then `cloudflared tunnel --url http://localhost:3000` (or `ngrok http 3000`) → a temporary public URL for a live screen-share. Dies when you stop it.

**For a real tester round (before inviting people):**
- Land **S3.2** (so briefs actually generate) and **S5** (so the Save/Dismiss/Act buttons aren't dead — or hide them), then deploy via option 2 or 3.
- Keep Supabase Auth open for sign-ups, or add a simple invite-code gate so it's not fully public.
- Add a dead-simple **feedback path**: a Google Form linked from the dashboard, or a `feedback` table + a one-field form. Don't over-build it.
- **Tell testers** it's an early finance preview; collect: "was the brief relevant? did it beat what you use now? what's missing?"
- Only after they like it → buy a domain + go to prod. Until then, the free `*.vercel.app` / `*.up.railway.app` URL is all you need.

---

## 8. File map + errors/lessons (for cold pickup)

| Purpose | Path |
|---|---|
| **This handoff (start here)** | `CURSOR_HANDOFF.md` |
| Deep engineering handoff (Claude-flavored) | `NEXT_SESSION.md` |
| Approved V1 architecture | `docs/architecture/forgeminds-v1-finance-core.md` |
| Slice roadmap / status | `CURRENT_SPRINT.md` |
| Decisions log | `DECISIONS.md` |
| Errors (ERR-019…028) | `errors-fixed.json` |
| Lessons (#104–111) | `.claude/rules/reference/lessons.md` |
| Host cutover runbook | `docs/ops/railway-cutover.md` |
| Score route (ERR-028) | `src/app/api/cron/score/route.ts` |
| Scorer (S3.2 edits) | `src/lib/pipeline/scorer.ts` |
| Entity resolver | `src/lib/entities/resolver.ts` |
| Market data | `src/lib/pipeline/market-data.ts` |
| AI router | `src/lib/ai/router.ts` |

**Most relevant errors:** ERR-026 (Cloudflare unfit → move host), ERR-027 (Gemini "thinking" starved JSON → disable thinking), **ERR-028** (AI-mangled id → score loop — your first task).
**Most relevant lessons:** #105 (validate AI output against real DB ids), #108 (verify live DB over docs), #111 (an untracked metric is not evidence).

---

## 9. Definition of Done

**V1 done** = all three gates true: telemetry (AI fires), strict resolution (no invented ids/categories), **dogfood passes** (founder rates ForgeMinds ≥ Pipedream +0.5 over 5–7 trading days). Plus: WF1+WF2 output parity, no cross-brief duplicates, every AI row has `prompt_version` + model + tokens.

**V1.1 done** = V1 + a stranger can sign up on a free shareable URL, get a relevant daily brief, use working (non-dead) Save/Dismiss/Rate, and leave feedback — with no broken/empty/fake UI and at least one off-platform backup running.

---

## 10. The one sentence

**Fix the score failure loop (S3.2) → deploy to a free working host (Vercel `*.vercel.app` or Railway) → wire the dead buttons (S5) and WF2 outputs (S4) → invite a few testers to the free URL for feedback → then the founder runs the dogfood week. Verify everything against the live DB, never trust a green build alone, and never touch secrets or prod.**

---

## 11. Repo location, connectors & deploy logistics (read before cloning)

**Locations:**
| | Where |
|---|---|
| Local source of truth | `C:\Users\vtbsj\victor-ai-factory\projects\forgeminds` |
| GitHub remote | `https://github.com/gainglintgaz/forgeminds.git` (`origin`, branch `master`) |
| Live (Cloudflare worker) | `https://forgeminds.vctrbbnv.workers.dev` (worker name `forgeminds`) |

**🚨 GitHub is 26 commits BEHIND local (as of 2026-06-15).** All of S1/S2/S3/S3.1 + these handoff docs are unpushed — they exist only on the founder's machine. **Do NOT clone GitHub and start; you'll get a stale repo.** Either (a) work directly in the local folder above (recommended — it has the latest code AND `.env.local` with all keys), or (b) have the founder `git push origin master` first, then clone, then copy `.env.local` into the clone (it's gitignored).

**Deploy:**
- Cloudflare (current, but ERR-026-broken for AI routes): `npm run deploy` = `opennextjs-cloudflare build && opennextjs-cloudflare deploy`. Config: `wrangler.jsonc` + `open-next.config.ts`.
- **Vercel (recommended for a working preview):** `npm i -g vercel && vercel --prod` → free `*.vercel.app`, Next.js-native, sidesteps ERR-026. The `.env.example` header literally says "Set in Vercel for production."
- Railway (chosen long-term host): runbook `docs/ops/railway-cutover.md`.

**Connectors:**
- **MCP:** only the **Supabase MCP** (scoped to dev project `ymgbjtgczgnooscigplb`) is project-relevant. The repo has a `.cursor/rules/` dir but **no `.cursor/mcp.json`** — create one if you want Supabase MCP in Cursor (or just use the `supabase` CLI, already a devDependency, or the Supabase dashboard SQL editor). Do NOT copy the founder's `.mcp.json` — it holds a personal access token; use your own.
- **API keys (NOT MCP — env vars in `.env.local`, already present in the local folder):** Supabase (url/anon/service-role), `CRON_SECRET`, GEMINI, ANTHROPIC, XAI (Grok), OPENAI (embeddings), PERPLEXITY, FINNHUB, ALPACA (+secret), ALPHA_VANTAGE, BENZINGA (paid/optional), RESEND; later-phase OAuth (Reddit/X/Google/Discord) + Stripe. Full annotated list: `.env.example`.
- **⚠️ Gotcha:** the host's `CRON_SECRET` **must exactly equal** the Supabase vault secret `cron_secret`, or every `/api/cron/*` route returns 401 and the pipeline silently stalls (noted in `.env.example`).
- **Deploy logins (interactive, founder does once):** `wrangler login` (Cloudflare) and/or `vercel login` (Vercel).

**Fastest correct start for Cursor:** open the local folder → `npm install` → `npm run dev` (uses the existing `.env.local`) → read §4 and do slice S3.2 → verify on the live DB → `vercel --prod` for a shareable URL.

---

## 12. Competitive landscape (logged 2026-06-25) — context, NOT a feature change

Two things the founder flagged. **Neither changes the critical path** — do not let them derail S3.2 → host fix → S4/S5 → dogfood. Full detail: `IDEAS_BACKLOG.md` "Competitive intel — 2026-06-25" + `DECISIONS.md` 2026-06-25.

- **Google Finance shipped (Jun 2026):** scheduled personalized market briefings tied to a watchlist with push delivery — *which is ForgeMinds' exact core, already built.* It validates the direction AND makes Google a free competitor in the finance vertical. **Do not try to out-finance Google** (real-time data, mobile, distribution). ForgeMinds' wedge = **breadth** (any topic, not finance-only — Layer 1), **action-output** (FM drafts the post/video/podcast; Google hands you a briefing to read), and the **learning loop / Voice DNA**. Google also added a portfolio-from-screenshot/CSV holdings tracker — that's a *different* surface (holdings analytics, not an interest graph); defer (~T3), don't copy now.
- **Google AI Talk Radio (AI Studio managed agents)** = deep research → multi-host voice script → audio in one API call. This is the **reference architecture for the T1.7 audio "Listen" feed + the S4 video-prompt output** — a differentiator Google Finance lacks. When T1.7 unlocks (post-dogfood): don't rebuild the brief — pipe the existing `briefs` row text into a Gemini multi-speaker TTS step → store audio → per-user private podcast RSS. **Stays post-V1; do not pull forward** (lesson #110).

Takeaway for the build: stay on the critical path; the differentiators to protect are breadth + does-the-work outputs (S4) + the learning loop — not finance-terminal parity.
