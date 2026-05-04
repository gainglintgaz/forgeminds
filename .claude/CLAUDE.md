# ForgeMinds — Personal Intelligence OS

## 🔴 AI-ASSISTED DISCOVERY PRINCIPLE (added 2026-05-04 — Phase 1.5 pivot)

**ForgeMinds is an AI-first multi-tenant SaaS, not a personal pipeline.** Every user has wildly varied interests, expertise, budgets, and time. Most users do NOT know which RSS feeds, APIs, or databases would help them. The product's job is to help them figure that out — not require them to know in advance.

### Three rules that follow from this

1. **Conversational discovery is the default UI for any "which X do I pick?" decision.** Source selection, action template choice, voice tone tuning, threshold setting, integration setup — all use a Claude-Sonnet-backed conversational agent that asks plain-language questions and proposes options with reasoning. Manual config forms ship as power-user fallback only. (See VIBE Rule 56, factory CLAUDE.md §4 #18.)

2. **No hardcoded URLs, API keys, or user-specific config in seed scripts.** `supabase/seeds/*` contains ONLY project-level operational config (vault secrets, GUCs, reference catalogs). User data lives behind app UI. The pre-2026-05-04 `phase-1-bootstrap.sql` violated this by inserting Victor's 10 RSS feeds as hardcoded INSERTs; replaced by `phase-1-project-bootstrap.sql` which contains zero user data.

3. **Per-user routes call APIs ONLY for source types the user has.** Pre-2026-05-04 `/api/cron/ingest` called `fetchFinnhub/Benzinga/Alpaca/AlphaVantage` for every user, every tick, regardless of preferences — burning shared API quota for users who never asked for financial news. Refactored 2026-05-04 to read user's `sources` rows, group by `type`, only invoke fetchers per-type-present. **Constant API call count per user is a bug.** (See lessons.md #98.)

### What this requires

- **Source catalog table** (Phase 1.5) — curated database of ~300-500 sources with category/subcategory/paywall/quality metadata
- **Source-catalog-curator subagent** at `.claude/agents/source-catalog-curator.md` — researches and proposes new catalog entries with verified URLs
- **Source-validator subagent** at `.claude/agents/source-validator.md` — validates user-submitted URLs at runtime to prevent hallucinated sources
- **Conversational onboarding agent** (Phase 1.5) at `/onboarding/*` — Claude Sonnet + RAG over catalog + streaming UI
- **Sources page redesign** (Phase 1.5) — catalog browser + AI suggestions panel + chat advisor sidebar + power-user "Add custom" fallback

### Reference

- Roadmap pivot: `C:\Users\vtbsj\.claude\plans\sparkling-waddling-pinwheel.md` "🔴 PIVOT (2026-05-04)" section
- Factory rules: VIBE Rule 56, factory CLAUDE.md §4 #17 + #18
- Lessons: lessons.md #97 (paste-10-URLs reflex), #98 (constant API calls)

---

## 🔴 PHASE COMPLETION ENFORCEMENT (added 2026-04-29 after Phase 0 audit failure)

**This project failed Phase 0 three times by declaring "done" without verification.** The schema migrated successfully but auto-scaffolded code referenced wrong column names. Build compiled; runtime would have crashed on every API call.

### Definition of "Done" for ANY phase, feature, or sprint

NOT done when: TypeScript compiles, migrations apply, files exist.
DONE when ALL of the following pass:

```bash
npm run verify:phase-X
```

This single command runs (in order, each gates the next):

1. `npx tsc --noEmit` — catches what Vite/Turbopack skip
2. `npm run lint` — zero ESLint errors
3. `npm run verify:db` — all expected migrations applied, signature tables exist
4. `npm run verify:columns` — every `.from("table").select("col")` validated against live schema (no drift)
5. `npm run verify:rls` — RLS enabled on every public table, policies exist
6. `npm run verify:honest-strings` — no fake/placeholder/mock data in `src/`
7. `npm run verify:env-vars` — required Phase env vars are set AND used by functional code paths
8. `npx playwright test` — e2e auth + dashboard + sources flows pass

If ALL pass, the script outputs an `AUDIT GATE [phase]` block. **That block must be pasted into the commit message body** for any commit using "done|complete|finished|ship|deploy" wording.

### Pre-commit hook (`.husky/pre-commit`) blocks

- Commits whose message contains `done|complete|finished|ship|deploy` without an `AUDIT GATE` block in the body
- Commits where `npx tsc --noEmit` produces errors
- Commits where any staged `src/app/api/` or `src/lib/pipeline/` file fails `verify:columns`
- Commits containing known secret patterns (`sk-proj-`, `sbp_`, JWT-looking strings outside .env.example)

### Per-phase checklists (`.claude/checklists/phase-X-complete.md`)

Each phase has a checklist file. Pre-commit verifies 100% checked-off state before allowing a "done" commit. Sample items:

- [ ] All migrations applied (`npm run verify:db` green)
- [ ] All routes use valid schema columns (`verify:columns` green)
- [ ] RLS verified on every table (`verify:rls` green)
- [ ] Auth flow works end-to-end (Playwright `auth.spec.ts` green)
- [ ] No fake/mock data in user-facing strings (`verify:honest-strings` green)
- [ ] AUDIT GATE block pasted in commit message

### What this prevents

- Declaring "Phase 0 done" when 6 routes are broken at runtime
- Trusting a "build passes" green checkmark as proof of feature correctness
- Stringly-typed query drift (Supabase `.from("foo")` calls) escaping TypeScript
- Auto-scaffolded code referencing schema columns that don't exist
- Schema reset wiping role grants without anyone noticing until the JS SDK 403s

### Reference

- Factory rules: `C:\Users\vtbsj\victor-ai-factory\.claude\rules\vibe-standard.md` Rule 35 (strengthened)
- Factory execution: `C:\Users\vtbsj\victor-ai-factory\.claude\rules\execution.md` Phase 5.5 Audit Gate
- Factory lessons: `C:\Users\vtbsj\victor-ai-factory\.claude\rules\lessons.md` #93-96
- Project decision log: `DECISIONS.md` 2026-04-29 entry
- Schema canonical names: `ARCHITECTURE_NOTES.md` Schema Reference Table

---

## What This Is
A SaaS intelligence platform that collects news from RSS + APIs, scores it with multi-model AI, curates diverse stories, enriches with market data, and helps users ACT on information — create content, plan investments, write blog posts, track goals, and build knowledge over time.

Not a news reader. Not a dashboard. A personal intelligence OS that learns your voice, connects dots across months of research, and gets smarter (and cheaper) the more you use it.

## Stack
- **Frontend:** Next.js 16 App Router + Tailwind CSS v4 + shadcn/ui (new-york style)
- **Backend:** Vercel Functions (Fluid Compute, 1024MB, 300s timeout)
- **Database:** Supabase PostgreSQL + pgvector + pg_trgm + pg_cron + Realtime
- **Auth:** Supabase Auth (email + Google OAuth)
- **Billing:** Stripe (Explorer free / Builder $14.99 / Architect $34.99)
- **AI Router:** Gemini Flash (bulk scoring), Grok (social/video), Claude Haiku (briefs), OpenAI (embeddings), Perplexity (research)
- **Email:** Resend with React Email templates
- **Scheduling:** pg_cron + pg_net (triggers Vercel API routes)

## Design System
- **Dark mode default** — knowledge workers live here
- **Primary:** Deep indigo (oklch 0.65 0.2 270 dark / 0.398 0.195 277 light) — knowledge, depth
- **Insight/Spark:** Warm amber (oklch ~0.80 0.16 80) — action moments, "aha"
- **Growth:** Emerald (oklch ~0.75 0.18 155) — positive outcomes, verified
- **Decay:** Rose/coral (oklch ~0.70 0.17 25) — alerts, needs attention
- **Brain:** Same as primary — the knowledge layer
- **Font:** Geist Sans (UI), Geist Mono (data/metrics)
- **Spacing:** 8/16/24/32/40/48/64px increments. Cards: p-6.
- **Radius:** 0.625rem default. Not bubbly.

## 10 Modules
1. **News Pipeline** — fetch, deduplicate, score, curate, enrich
2. **Content Engine + Draftpad** — blog, social, podcast, video drafts + rich text editor
3. **Knowledge Base** — archive, pgvector semantic search, "Save to Brain"
4. **Dot Connector + Long Memory** — cosine similarity old→new, resurrection, decay alerts
5. **Collective Brain + Serendipity** — anonymized signals, action library, 80/15/5 discovery
6. **AI Router** — multi-model, cost tracking, cache, fallback chains
7. **User Profile Engine** — profession, goals, interests, risk tolerance
8. **Voice DNA** — style extraction, edit learning, voice-matched generation
9. **Entity Resolution** — canonical mapping ("Tesla"/"TSLA" → one UUID)
10. **Action Engine** — action plans, trust escalation, execution, outcome tracking

## Shared Services
- **Notifications** — all modules write to notifications table. Bell icon + email/push.
- **Analytics** — monthly outcome stats (actions taken, content published, value delivered)

## Database Schema: ~57 tables across 5 migrations
All tables have: user_id (RLS), created_at, updated_at, content_hash (dedup), prompt_version (AI audit). Money as BIGINT cents.

## Brain Architecture (Three Layers)
1. **Personal Brain** — `saved_items` where `user_id = me, brain_id = null`. Always private.
2. **Shared Brain** — `saved_items.brain_id → shared_brains`. Couples/families/teams. Members declared in `brain_memberships` with role (owner/editor/viewer).
3. **Community Brain** — Anonymized aggregate via `community_embeddings`, `community_trends`, `community_brain_queries`, `community_behavioral_aggregates`. **Default-ON contribution** (covered by ToS + Privacy Policy). Contributions identified by `contribution_id` (pseudonymous, never reverse-mappable to user_id outside `community_data_settings` table).

**Default-on collection (the moat):**
- All anonymized contribution scopes ENABLED by default for every new user
- Disclosed in onboarding + ToS + Privacy Policy
- Behavioral signals (clicks, dwells, saves, dismisses, searches, edits) captured via `track_event()` function
- Voice DNA edits flow into community as anonymized writing patterns
- Outcomes flow into `outcome_aggregates` and `community_behavioral_aggregates`

**Legal compliance (required minimum):**
- `community_data_settings.is_globally_excluded` toggle in Settings → Privacy (legally required opt-out — buried, not promoted)
- User can remove individual scopes from `enabled_scopes` array
- Account deletion cascades and removes all `community_*` rows tied to their `contribution_id`
- ToS version + Privacy Policy version stored in `community_data_settings` per user

**Hard rules — NEVER violate:**
- Raw keystroke logging is FORBIDDEN (legally fraught, marginal value)
- All Community Brain content uses `contribution_id`, never `user_id`
- User raw content fed to Community Brain is summarized/redacted/embedded — never stored verbatim
- All collection covered by ToS that user accepts at signup
- `is_globally_excluded` users still see Community Brain output but don't contribute to it

## Pipeline Architecture
Functions chain via `raw_articles.pipeline_status` state machine (fetched → scored → curated → enriched → generated → delivered). Each cron function reads its input status, processes, advances.

## ═══════════════════════════════════════════════════════════════════
## NO-HALLUCINATION 4-LAYER ARCHITECTURE
## ═══════════════════════════════════════════════════════════════════
## EVERY suggestion, fact, or recommendation flows through 4 distinct layers.
## AI never invents facts. AI's only job is paraphrasing verified data.

### Layer 1 — REAL DATA SOURCES (no AI)
External APIs return ground truth. Examples:
- Wikidata SPARQL: entities, properties, sectors, aliases
- Finnhub / Alpaca / CoinGecko: prices, fundamentals, options chains
- SEC EDGAR: filings, insider trades, 13F holdings
- WHOIS / Cloudflare Registrar: live domain availability
- USPTO TSDR: live trademark filings
- LinkedIn API (when user connects): 2nd-degree network
- GitHub / npm / Substack APIs: handle availability
Cached in `data_source_cache` table to avoid duplicate API calls.

### Layer 2 — ACTION TEMPLATES (human-authored)
Stored in `action_templates` table. Each template:
- Maps event triggers (product_launch, earnings_beat, etc) to action vectors (build, content, land_grab, etc)
- Declares required Layer 1 data sources
- Declares output template + fact-check rules
- Has hallucination_risk score (must be 0 for ship)
~80 templates cover 95% of news event types.

### Layer 3 — PROFILE MATCHING (deterministic scoring)
For each candidate template:
- Match user profile (profession, goals, risk tolerance) → fit score
- Match Voice DNA → output formatting rules
- Match past behavior (interactions, scoring_feedback) → ranking weight
- Match time horizon → which sections render
Output is a sorted list of templates with match_score per article.

### Layer 4 — AI SYNTHESIS (paraphrasing only)
Claude/Gemini reads facts from Layers 1-3 and composes user-facing output.
HARD RULES:
- AI NEVER invents prices, names, dates, jobs, domains, people, events
- AI's allowed actions: rephrase, summarize, format, translate tone
- Every numerical claim has a source citation in metadata
- Post-generation fact_check_rules verify every claim against Layer 1
- If a claim cannot be verified → stripped before display
- Stored in `action_template_runs.fact_check_warnings` for audit

### Hallucination Guards (mandatory)
- Every "available domain" → verified by live WHOIS API
- Every "person at company" → verified by LinkedIn API (when connected)
- Every options strike → verified to exist in actual options chain
- Every insider trade → matches a real Form 4 filing
- Every Wikidata entity → has a Q-number
- Failed verification → `fact_check_passed = false`, output not shown

## Key Rules
- NEVER put API keys in NEXT_PUBLIC_ variables (server-only via env vars)
- CRON_SECRET header required on all /api/cron/* endpoints
- RLS on every table: `USING (user_id = auth.uid())`
- AI calls gated by rate limiting (Explorer 10/day, Builder 200/day, Architect 1000/day)
- Every AI output includes prompt_version for traceability
- content_hash UNIQUE on every import table for dedup
- Supabase service_role_key for server-to-server (bypasses RLS)
- **NO HARDCODED SEED DATA** — entities discovered lazily via Wikidata, never hardcoded SQL inserts
- **NO BAND-AIDS** — fix root architecture, don't add per-case patches
- **EVERY AI OUTPUT** runs fact-check pass; unverified claims stripped before display

## File Structure
```
src/
  app/
    (dashboard)/     # Authenticated pages (feed, archive, content, sources, settings, analytics)
    (marketing)/     # Public pages (landing, pricing)
    api/cron/        # Pipeline endpoints (ingest, score, curate, enrich, generate, deliver, connect)
    api/             # User-facing API routes (briefs, content, search, settings)
    auth/            # Login, callback
  lib/
    supabase/        # Client, server, middleware, types
    ai/              # Router, providers (gemini, grok, claude, openai, perplexity), prompts, heuristics
    pipeline/        # Step logic (ingest, enrich, generate, deliver)
    entities/        # Entity resolution
    voice/           # Voice DNA analyzer
    knowledge/       # Dot Connector
  components/
    ui/              # shadcn primitives
    layout/          # Sidebar, topbar, mobile nav
    feed/            # Brief card, article card, ticker badge
    content/         # Draft editor, approval panel
    archive/         # Search bar, result card
```

## Spec & Plan
- Spec: `docs/superpowers/specs/2026-04-13-forgeminds-design.md`
- Plan: `.claude/plans/` in factory root
