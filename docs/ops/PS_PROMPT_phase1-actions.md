# PS Claude kickoff — ForgeMinds Phase 1: "make it real, configurable, actionable"

> **Run in:** `C:\Users\vtbsj\victor-ai-factory\projects\forgeminds` · Recommended model: Sonnet 4.6.
> **Sign-off:** Founder said **"build approved"** on 2026-06-13 (discovery-protocol §6). You may build.
> **Read FIRST:** `docs/architecture/full-os-phase-1-actions.md` (the full spec incl. Revision 2). This prompt is its executable plan; the doc has the per-field detail.
> **Secrets:** NEVER read `.env.local` or echo any secret value. Cookie auth in user routes — never service-role.

## What you are building (one paragraph)

ForgeMinds is a read-only placeholder shell: the feed's action buttons are `disabled`, the AI outputs are generic, and Settings is read-only. Phase 1 turns it into a real product: **four feed actions** (Save / Analyze / Draft / Act-Hand-to-AI) that are **per-user-configurable** and **source-traceable**, plus an **editable Settings** page. The founder mandate is absolute: **nothing one-size-fits-all**, and **every AI output traces to its source for verification**. Most of the backend already exists in the live DB (the original scaffold built the tables, never wired them) — so this is mostly *wiring + a config layer + a few additive columns*, not greenfield.

## Non-negotiable principles (apply to every step)

1. **Configurable (Rule 55):** every knob's default lives in `user_preferences`/lookup data, NOT a JS constant; code reads pref-with-fallback. A single `resolveActionConfig` merges hardcoded-fallback ← user_preferences ← per-click overrides.
2. **Conversational-fallback (Rule 56):** Phase 1 ships structured selector controls; each action route carries a comment block: `// Rule 56: conversational config tracked Phase 2; structured controls are the permitted fallback`.
3. **Traceable:** every AI output renders in the ONE shared `AiOutputDisclaimer` wrapper showing source-article link (handle null `url`), model, prompt_version, and a grounding badge; `sources[]` persisted; `article_id` FK on every row.
4. **Grounded + fail-closed:** model is fed ONLY the one article; a deterministic number/quote substring check sets `fact_check_passed` + `fact_check_warnings`; if false, render "Review — N unverified claims", never a green badge.
5. `prompt_version` on every AI row · no dead UI (un-deaden the buttons) · no silent catch (log brief.id + user prefix, return real error) · AI only via `src/lib/ai/router.ts` · `track_event`/`upsert_article_outcome` called with **named args** · never guess an enum/column — read it.

## Step 0 — Land the pending work first (clean baseline)
Commit, so the tree is clean before the big build:
1. **Email fix** — per `docs/ops/PS_PROMPT_email-fix.md` (deployed + verified `sent:4` by the desktop session); the deliver route changes + the `delivery_log_sent_once` migration-parity file + email design doc/handoff.
2. **"Soon" UI patch** — in `src/components/feed/article-card.tsx`, the 3 disabled buttons get an honest muted **"Soon"** label/tooltip (matching the sidebar) — interim only; Step 6 replaces it with the real wired actions.
3. **These Phase-1 docs** + the `PENDING_APPROVALS.md` "Email E2" entry.

## Step 1 — Pre-build verification (lesson #93 — confirm before any INSERT)
Read/confirm via MCP + files: enum values for `content_type`, `draft_status`, `run_outcome`, `behavioral_event_type`, `article_outcome_kind`; that `content_drafts` still has no jsonb col; `raw_articles` columns — **outlet is `source_name`** (not `source`), **`url` is NULLABLE**, has `full_text`; the `upsert_article_outcome` + `track_event` arg signatures. Read `src/lib/ai/router.ts` and `src/app/api/cron/generate/route.ts` (copy the router-call pattern — reuse, VIBE 16). Find where `ArticleCard` is rendered (the `/dashboard` feed) + its SSR auth pattern (`createClient()` → `auth.getUser()`).

## Step 2 — Migrations (ALL additive; **desktop session applies via MCP + `get_advisors`** — you commit the files only)
Per design doc §5 + §R2.3:
1. `action_template_runs` — `ALTER COLUMN template_id DROP NOT NULL` **(load-bearing — every Analyze insert needs it)**.
2. `content_drafts` — `ADD COLUMN provenance jsonb NOT NULL DEFAULT '{}'` (one bag: `{params:{…}, sources:[…]}`).
3. `action_plans` — `ADD COLUMN config jsonb NOT NULL DEFAULT '{}'` (the 4th action's `{flavor,target,params,sources}`).
4. `CREATE INDEX` on `content_drafts(article_id)` + `saved_items(article_id)` **only** (the other two already exist).
5. `user_preferences` — `ADD COLUMN draft_defaults jsonb` + `analyze_defaults jsonb` (sensible defaults). **Reuse existing `social_tone`/`social_platforms`; do NOT add a duplicate tone column (Rule-59 conflict).**
6. Seed an `analysis_lenses` lookup (6 lenses + `custom`) — lenses as editable data, not code, not `action_templates` rows.
7. `saved_items` — partial unique index `(user_id, article_id) WHERE is_brain_item` (Save dedup).
*(Do NOT add a `social_reddit` enum value — Reddit maps to `social_threads` + `platform='reddit'`. All additive → no `[approved-destructive]`; each migration commit body: `Advisors: clean`.)*

## Step 3 — Shared primitives
- `src/lib/actions/resolve-config.ts` → `resolveActionConfig(action, userId, overrides)` (the 3-tier merge; persisted into the run/draft/plan row).
- `src/components/ai/ai-output-disclaimer.tsx` → the ONE wrapper for all AI text (ai-native SS4). Every AI render path goes through it (grep-gate). Renders: `AI-generated · {model} · {prompt_version} · Based on: "{title}" — {source_name}, {published_at} ↗ · {grounding badge}`; null `url` → title-only.
- `src/lib/ai/grounding.ts` (or inside router) → the deterministic number/quote substring check → `{passed, warnings[]}`.

## Step 4 — Build the 5 actions/surfaces, in order, each verified before the next

**4a. Save to Brain** (`POST /api/actions/save`, no AI) — `saved_items` insert (`item_type:'article'`, is_brain_item, tags from config) → 23505 ⇒ `{alreadySaved:true}` → `upsert_article_outcome(p_outcome:'saved')` → `track_event('article_save', …)`. Un-disable button → "Saved ✓".

**4b. Analyze** (`POST /api/actions/analyze`, AI, read-only/non-HITL) — config `lens` (6 from `analysis_lenses` + `custom`+free-text) · `depth` · `stance` (defaults from `analyze_defaults`). Router given only the article (`full_text`||`summary`+title+url), `prompt_version='analyze-v1'`. Grounding check. Persist `action_template_runs` (`template_id:NULL`, `resolved_data:{lens,depth,stance,custom_lens,sources:[…]}`, `outcome:'suggested'`, `match_score:1.0`, `match_reason:'user-selected lens'`, model, prompt_version, fact_check_*). `track_event('article_analyze', p_template_run_id:…)`. Render inline via `AiOutputDisclaimer`; fail-closed. Rule-56 comment.

**4c. Draft Post** (`POST /api/actions/draft`, AI, **HITL**) — config `platform`→`content_type` map (Reddit→`social_threads`+`platform='reddit'`) · `tone` (reuse `social_tone`) · `length`→per-platform cap (from `draft_defaults`/platform data) · `stance` · `hashtags`. **Voice-DNA boundary: read `social_tone` ONLY; leave `style_*` untouched; no "in your voice" copy.** Router `draft-v1`, grounding check, persist `content_drafts` (`status:'pending_approval'`, `provenance:{params,sources}`, model, prompt_version). `track_event('draft_created', p_draft_id:…)`. UI: `AiOutputDisclaimer` + Copy + **Approve** (→ status `approved` + `approved_at`). Rule-56 comment.

**4d. Act / Hand to AI** (`POST /api/actions/act`, AI) — design doc §R2.1. Config `flavor` ∈ {research, plan, draft_brief, code_kickoff} · `target` · depth. `plan` → `action_plans` row (title+rationale+`steps[]`+`matched_goal_id`); research/draft_brief/code_kickoff → ready-to-paste prompt in `action_plans` (rationale=prompt text, steps=sections), `config={flavor,target,params,sources:[…]}`, `prompt_version='act-v1'`, grounded. UI: `AiOutputDisclaimer` + **Copy** + **Export (.md/.json)**. `track_event` (closest enum — verify; likely `feature_used` + metadata). `code_kickoff` = a source+goal+constraints+acceptance-criteria block for a Claude Code/agent session. **Non-goal: NO autonomous agent execution** (no infra; gated later) — you generate the brief, the user runs it.

**4e. Editable Settings** (`POST /api/settings`, NO new schema) — design doc §R2.2. Replace the read-only `/settings` cards with editable controls + Save, writing existing `user_preferences` columns: schedule (`timezone`/`cadence_minutes`/`active_hours_start/end`/`active_days[]`), windows (`recency_window_minutes`/`score_lookback_minutes`/`min_composite_score`), density (`max_articles_per_brief`/`max_per_category`/`max_per_entity`), the four `weight_*`, `delivery_email`/`delivery_push`/`auto_generate_content`, `social_platforms[]`/`social_tone`, and chip add/remove for `topics[]`/`excluded_topics[]`/`tracked_tickers[]`. Validate (hours 0–23, min_composite_score 0–1, weights ≥0). Remove the "Edit forms ship in Phase 2" copy. **Source-management (`sources` table) + conversational config stay Phase 1b — do NOT build them here.**

## Step 5 — Five gates (in order, each blocks the next)
`npx tsc --noEmit` 0 · `npm run lint` 0 · click-through on the live feed (Save persists; Analyze/Draft/Act render in the wrapper with a clickable source link; Approve works; Settings save persists; 0 console errors) · (desktop session does the DB round-trip verification) · enum/column-drift grep vs the values you read in Step 1.

## Step 6 — Un-deaden + commit
Remove `disabled` from the 3 feed buttons (replaces the Step-0 "Soon" patch); add the Act button. Commit:
`feat(actions): configurable + source-traceable Save/Analyze/Draft/Act + editable Settings (Phase 1)`. Body:
`Design doc: docs/architecture/full-os-phase-1-actions.md` · `Build approved: build approved (founder, 2026-06-13)` · `Migrations applied via MCP by desktop session; Advisors: clean`. (feat( + architecture doc in same commit satisfies the discovery gate — no `[discovery-skipped]`.) Include: routes, resolver, wrapper, grounding helper, `analysis_lenses` seed, `article-card.tsx`, the `/settings` page + route, migration files, design doc, this handoff.

## Step 7 — Report back
Gates output; enum/column values used; migration files awaiting desktop application. The desktop session then applies migrations, re-checks advisors, and verifies every acceptance criterion (design doc §6 + §R2.4) against live rows — including the **two-lens proof** (same article, two lenses, two runs with different `resolved_data.lens`), the **forced-wrong-number fail-closed** test, the **Act code_kickoff** export, and the **Settings save** round-trip — then reports Phase 1 done-or-not.

## Hard rules
Cookie auth only (no service-role in user routes). AI via `router.ts` only; AI text only inside `AiOutputDisclaimer`. No silent catch. `track_event`/`upsert_article_outcome` with named args. Don't guess enum/column names — you read them in Step 1. Migrations are the desktop session's to apply; you commit the files. If anything fails twice, stop and report (3-prompt revert rule).
