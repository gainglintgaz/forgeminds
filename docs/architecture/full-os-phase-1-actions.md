# Full-OS Roadmap — Phase 1: configurable, source-traceable feed actions

> Status: **APPROVED — founder said "build approved" 2026-06-13** (desktop session). Scope = Rev 1 (3 actions) + Rev 2 (4th action "Act/Hand-to-AI" + editable Settings). Sign-off audit: verbatim "build approved", full scope per §7 + §R2.5.
> Owner: Victor · Implementer: PS Claude · Verifier: desktop session (DB/MCP)
> Supersedes the earlier one-size-fits-all draft. Quality bar = Victor's Pipedream "Content Approval" flow.
> PS handoff: `docs/ops/PS_PROMPT_phase1-actions.md`
> Design grounded by a 4-agent pass that read the live migrations (verdict: NEEDS_TRIM — trims applied below).

## 0. The founder mandate that reshaped this

> *"It should not have one-size-fits-all for ANYTHING. I'm no longer building just for myself (I'm first user/tester)."* + must be **source-traceable for verification**.

Per **VIBE Rule 55** (every UX value per-user-configurable from day 1, defaults in the DB not JS),
**Rule 56** (conversational-first; forms are the sanctioned fallback), and **two-way-traceability**.
The earlier spec violated all three; this one bakes them in.

## 1. Verified ground truth (subagents read the live schema — trust this)

- `user_preferences` **already has** `social_platforms[]`, `social_tone`, + dormant Voice-DNA cols
  (`style_anchors`, `style_tone`, `style_density`, `style_captured_at`). **The config home largely exists.**
- `content_drafts.content_type` enum is **per-platform**: `social_x`, `social_facebook`, `social_linkedin`,
  `social_threads`, `blog_draft`, `video_prompt`, `email_snippet`. **No `social_reddit`** → Reddit maps to
  `social_threads` + `platform='reddit'` (text). `content_drafts.draft_status` HAS `failed` + `pending_approval`.
- `content_drafts` has **no jsonb column** → need ONE additive jsonb.
- `action_template_runs.template_id` is **NOT NULL** → the one load-bearing migration: `DROP NOT NULL`.
  `run_outcome` enum = {suggested, dismissed, accepted, completed, value_realized} — **no `failed`**.
- Indexes: `action_template_runs(article_id)` + `article_outcomes(article_id)` **already exist**; only
  `content_drafts(article_id)` + `saved_items(article_id)` are missing.
- `raw_articles`: outlet col is **`source_name`** (NOT `source`); **`url` is NULLABLE** (handle it);
  has `full_text` (richer than `summary` for grounding).
- RPCs verified: `upsert_article_outcome(p_article_id,p_brief_id,p_outcome,…)`,
  `track_event(p_event_type,p_article_id,p_template_run_id,p_draft_id,p_saved_item_id,p_brief_id,…)`
  (call with **named args** — lesson #93). `saved_items.item_type` is NOT NULL no default → Save supplies `'article'`.
  RLS enabled on all 7 tables.

## 2. The configuration model (Rule 55) — the load-bearing contract

A single **`resolveActionConfig(action, userId, overrides)`** merges three tiers into one resolved config,
persisted on the run/draft row (the "what settings produced this" audit trait):

```
hardcoded safe defaults  ←  per-user saved defaults (user_preferences)  ←  per-click overrides (button payload)
```

- **Per-click overrides SHIP PHASE 1, full.** The action button opens a compact selector bar; one click with
  no change = "use my defaults", change a chip = override. This is what makes Phase 1 genuinely
  not-one-size-fits-all before any settings screen exists.
- **Saved per-user defaults SHIP PHASE 1 (basic):** read from `user_preferences` (+ small additive jsonb
  defaults below), with fallback. The dedicated **Settings UI is fast-follow** (Rule 55 is satisfied by the
  columns existing + the resolver reading them).
- **Conversational config (Rule 56 first-class) = Phase 2:** *"draft this for Reddit, casual, facts only"* →
  Sonnet parses → emits the **same `overrides` object** the resolver already consumes. No schema change.
  Phase 1's dropdowns/chips are the sanctioned power-user fallback — **each action route carries a comment
  block justifying it** (`// Rule 56: conversational path tracked Phase 2; structured controls are the permitted fallback`).

## 3. The three actions

All routes: server-side **cookie auth** (`createClient()` → `auth.getUser()`, RLS-scoped; never service role),
all call `track_event` (named args), AI via `src/lib/ai/router.ts` only.

### 3a. Save to Brain — `POST /api/actions/save` (no AI; build FIRST)
- `saved_items` insert `{user_id, item_type:'article', article_id, title, is_brain_item:true, tags:<override or default>}`
  + `upsert_article_outcome(p_outcome:'saved')` + `track_event('article_save', …)`.
- Dedup: partial unique index `saved_items (user_id, article_id) where is_brain_item` → 23505 ⇒ `{alreadySaved:true}`.
- Config (not fixed): which Brain, tags, optional note.

### 3b. Analyze — `POST /api/actions/analyze` (AI, **read-only / non-HITL by design**)
- **Config — the star feature** (different people analyze different things about the same story):
  - `lens` ∈ {`key_facts`, `market_implications`, `political_angle`, `what_should_i_do`, `risks`,
    `explain_simply`, `custom`+free-text} — default `key_facts`.
  - `depth` ∈ {brief, standard, deep} (default standard); `stance` ∈ {facts_only, facts_plus_opinion} (default facts_only).
  - Lens definitions live as **DATA** (a seeded `analysis_lenses` lookup row per lens — slug, display_name,
    prompt skeleton, `hallucination_risk`, grounding rule), **NOT JS constants and NOT `action_templates` rows in
    Phase 1** (those need an embedding + are the Phase-2 auto-suggest engine).
- Router given ONLY the article text (`full_text`/`summary`+`title`+`url`); versioned prompt (`analyze-v1`).
- Persist `action_template_runs` `{user_id, article_id, brief_id, template_id:NULL, output_text,
  resolved_data:{lens,depth,stance,custom_lens, sources:[…]}, generation_model, prompt_version,
  fact_check_passed, fact_check_warnings, outcome:'suggested', match_score:1.0, match_reason:'user-selected lens'}`.
- `track_event('article_analyze', …)`. Renders inline in the disclaimer wrapper. No approve step (it's read-only).

### 3c. Draft Post — `POST /api/actions/draft` (AI, **HITL approve gate**)
- **Config:** `platform` ∈ {x, reddit, facebook, linkedin, generic} (→ `content_type` map; Reddit→`social_threads`+`platform='reddit'`);
  `tone` (reuse `social_tone`); `length` ∈ {short, standard, long} → per-platform char cap; `stance` ∈
  {facts_only, facts_plus_analysis, facts_plus_opinion} (default facts_only); `hashtags` bool (default by platform).
  **Per-platform caps/hashtag defaults live as DATA** (a seeded `platform_profiles` lookup OR the `draft_defaults`
  jsonb), so "Facebook longer / X shorter / Reddit no hashtags" is a data change, never code.
- **Voice-DNA boundary GUARD:** the Draft prompt reads `social_tone` ONLY; `style_*` columns stay untouched;
  **no UI copy says "in your voice."** Voice DNA is an explicit Phase-1 non-goal.
- Persist `content_drafts` `{user_id, article_id, brief_id, content_type, platform, body, hashtags,
  status:'pending_approval', generation_model, prompt_version, provenance:{params:{…}, sources:[…]}}`.
- `track_event('draft_created', …)`. Wrapper + **Copy** + **Approve** (Approve → `status` approved + `approved_at`; the HITL gate).

## 4. Traceability + verification (Rule: two-way-traceability) — Phase-1 GUARD, not deferred

**One-line answer to the founder's question: yes.** Every Analyze/Draft output carries a clickable link back to
the exact source article, the model + prompt_version, and a server check that the AI didn't invent a number/quote.
Phase-1 actions are single-article, so provenance is simple (one output ↔ one `raw_articles` row ↔ its url).

**Forward (SHIPS — blocks merge if absent):**
- One shared **`AiOutputDisclaimer`** component (ai-native SS4 — every AI render path goes through it) showing:
  `AI-generated · {model} · {prompt_version} · Based on: "{title}" — {source_name}, {published_at} ↗ · {grounding badge}`.
  Handle **null `url`** → title-only attribution (never a dead link).
- `sources[]` persisted as an array from day 1: `{type:'article', id, label, url, published_at, outlet:source_name}`
  — in `action_template_runs.resolved_data.sources` and `content_drafts.provenance.sources`. `article_id` FK stays the queryable spine.
- **Single-source prompt confinement** in `router.ts` (model sees only the one article; system prompt: "use only the provided article; if a fact isn't in it, don't state it").
- **Deterministic number/quote substring check** (cheap, no 2nd LLM call): every `$`-amount, %, and quoted span
  in the output must appear (normalized) in the article text; misses → `fact_check_warnings[]` + `fact_check_passed=false`.
- **Fail-closed render:** if `fact_check_passed=false` → "Review — N unverified claims" state, NOT a green Verified badge.
  Analyze fail tuple (pinned, since `run_outcome` has no `failed`): `outcome='suggested'` + `fact_check_passed=false` + warnings.
  Draft uses `draft_status='failed'` on a router error.

**Reverse ("where used") = honestly stubbed in Phase 1, completed in Phase 1b:** the `article_id` FK on
runs/drafts/saves makes the query POSSIBLE now; the "where this article was used" panel (4-table union) is the
additive completion. We tell the founder plainly: **forward traceability complete in Phase 1; reverse is the fast-follow.**

## 5. Schema migrations (Phase 1, additive only — `get_advisors` after each; desktop applies)

1. `action_template_runs`: `ALTER COLUMN template_id DROP NOT NULL` (+ optional `ADD action text`) — **load-bearing**, every Analyze insert needs it.
2. `content_drafts`: `ADD COLUMN provenance jsonb NOT NULL DEFAULT '{}'` — carries `{params:{…}, sources:[…]}` (collapse params + provenance into ONE bag; do NOT add two overlapping jsonb columns).
3. `CREATE INDEX` on `content_drafts(article_id)` + `saved_items(article_id)` — the **only 2** missing (the other two already exist).
4. `user_preferences`: `ADD COLUMN draft_defaults jsonb DEFAULT '{…}'`, `analyze_defaults jsonb DEFAULT '{…}'` with sensible defaults — **reuse existing `social_tone`/`social_platforms`; do NOT add a `draft_default_tone` (would duplicate `social_tone` → Rule-59 conflict).**
5. Seed an `analysis_lenses` lookup (6 lenses + a `custom` marker) — lenses as editable data, not code.
6. Save dedup: partial unique index on `saved_items (user_id, article_id) where is_brain_item`.
7. *(Fast-follow, non-blocking)* `social_reddit` enum value (run alone — enum add can't share a txn).

## 6. Acceptance criteria (desktop verifies against live DB)

- [ ] **Configurability proof:** two different lenses on the SAME article → two `action_template_runs` rows with
      different `resolved_data.lens` — proves not-one-size-fits-all + the derivation is traceable.
- [ ] **Save** → `saved_items` (is_brain_item, article_id), `article_outcomes` (saved), `interactions` (article_save); re-click no dup.
- [ ] **Analyze** → run row with non-empty `output_text`, `resolved_data.sources[0]={type:'article',id,url,…}`,
      `prompt_version`, `generation_model`; renders in `AiOutputDisclaimer` with a **clickable source link** (the 30-sec verify test).
- [ ] **Draft** → `content_drafts` row with `body`, `provenance.params`, `provenance.sources`, `prompt_version`;
      wrapper + Copy + Approve; Approve sets status+approved_at; `interactions` draft_created.
- [ ] **Grounding fail test:** force the output to claim a number not in the article → `fact_check_passed=false`,
      warning populated, UI shows Review state (no green badge).
- [ ] No button is a `disabled` placeholder; AI text only via `AiOutputDisclaimer` (raw-div grep clean).
- [ ] Five gates: `tsc` 0, lint 0, click-through clean, DB round-trip verified, column/enum-drift grep clean. Migrations applied + advisors clean.

## 7. What ships Phase 1 vs tracked fast-follow

**Phase 1 (configurable + forward-traceable, trimmed):** the 3 wired actions; per-click selector bar (Draft:
platform/tone/length/stance/hashtags; Analyze: lens(6+custom)/depth/stance); defaults in `user_preferences`;
lenses + platform caps as data; forward traceability + grounding check + fail-closed; `AiOutputDisclaimer`.

**Fast-follow (additive, no rewrite):** dedicated Settings UI; reverse "where used" panel; conversational config
(Rule 56 first-class, Phase 2); saved preset library; multi-platform fan-out from one click (the Pipedream-style
X+FB+video spread); `social_reddit` enum; `content_drafts.sources` snapshot column; LLM-judge entailment grounding.

**Non-goals Phase 1:** Voice DNA / "in your voice"; `ticker_data`/charts (Phase 2); the vector action-matching engine
(Phase 3); seeding `action_templates` rows (Phase 2).

## 8. Build order
1. Save (no AI) → proves auth+route+track_event+dedup. 2. `resolveActionConfig` + `AiOutputDisclaimer`.
3. Analyze (lens config + grounding). 4. Draft (platform config + HITL). 5. Act/Hand-to-AI (§R2.1). 6. Editable Settings (§R2.2).
Each: build → tsc/lint → desktop verifies the DB row → next.

---

# REVISION 2 (2026-06-13) — +4th action "Act / Hand to AI" + editable Settings

Founder added two items to Phase 1, both the same root cause (the app is a read-only placeholder shell; the
actionable + configurable layer was never built). This revision supersedes §3/§5/§7/§8 where it conflicts.
**Phase 1's true scope is now: "make ForgeMinds real, configurable, and actionable."**

## R2.1 — 4th action: Act / Hand to AI (the execution bridge)

The differentiator: turn an article into an **executable brief you hand to an AI / agent / code session** — what
the landing page already promises ("here is what to do about it"). Schema home verified: **`action_plans`**
(empty) has `title`, `rationale`, **`steps jsonb`**, `matched_goal_id`, `estimated_effort/value`, `status`,
`outcome_notes`, `generation_model`, `prompt_version` — built for exactly this.

**Ships now (generate + copy + export a brief):**
- `POST /api/actions/act` (cookie auth). Config (not one-size): **flavor** ∈ {`research`, `plan`,
  `draft_brief`, `code_kickoff`} + **target** (free text or preset: "Claude Code session" / "generic LLM" /
  "research agent") + depth.
  - `plan` → `action_plans` row (title + rationale + `steps[]` + `matched_goal_id` if the user has goals).
  - `research`/`draft_brief`/`code_kickoff` → a ready-to-paste prompt: store in `action_plans`
    (rationale = the prompt text, steps = structured sections) — **add one additive col `action_plans.config jsonb
    DEFAULT '{}'`** for `{flavor, target, params, sources:[…]}` (mirrors `content_drafts.provenance`). Router
    (`act-v1`), grounded in the article, prompt_version logged.
- UI: renders in `AiOutputDisclaimer` (source link + model + prompt_version) with **Copy** + **Export (.md / .json)**.
  `track_event` (closest enum, e.g. `feature_used` with metadata `{action:'act',flavor}` — PS verifies the enum).
- `code_kickoff` flavor = a ForgeMinds→agent-factory bridge: emits a structured kickoff (source + goal +
  constraints + acceptance criteria) you paste into a Claude Code / agent session. This is the highest-leverage flavor.

**Explicit Phase-1 non-goal (deferred, gated):** ForgeMinds *directly invoking* an agent / code session and
getting results back. **No infra exists** (no agent-run / integration tables) and it's a Trust-Ladder /
autonomy-gated capability needing agent-run provenance (two-way-traceability §11). Phase 1 *writes the brief you
run*; a later phase can *run it for you, with approval*. Do NOT build or imply autonomous execution now.

## R2.2 — Editable Settings (kills the read-only / one-size-fits-all page)

The `/settings` page is read-only ("Edit forms ship in Phase 2"). Make it editable — **NO new schema**; every
field is an existing `user_preferences` column (verified):
- **Schedule:** `timezone`, `cadence_minutes`, `active_hours_start/end`, `active_days[]`, `schedule_days[]`, `schedule_times`(jsonb).
- **Windows:** `recency_window_minutes`, `score_lookback_minutes`, `min_composite_score`.
- **Density:** `max_articles_per_brief`, `max_per_category`, `max_per_entity` (+ batch/page sizes — keep advanced/collapsed).
- **Scoring weights:** `weight_relevance/impact/novelty/credibility` (the per-user ranking knobs — high value, surface them).
- **Delivery:** `delivery_email`, `delivery_push`, `auto_generate_content`. **Content:** `social_platforms[]`, `social_tone`.
- **Tracking (add/delete/modify):** `topics[]`, `excluded_topics[]`, `tracked_tickers[]` — chip add/remove editors.
- **Implementation:** `POST /api/settings` (cookie auth, RLS) that validates + writes `user_preferences` (e.g.
  hours 0–23, `min_composite_score` 0–1, weights ≥0, cadence within allowed set). Replace the read-only cards with
  editable controls + a Save. Per Rule 55 these defaults already live in the DB; this is the "form over existing
  schema" the rule promised — not a rewrite.
- **Staged (Phase 1b):** Source management (`sources` table + `source_catalog`/`source_suggestions` — the "Sources"
  nav, which ties into the Rule-56 conversational discovery agent); the **conversational** "just tell me what you
  want" settings/config layer (Phase 2). Phase 1 ships the structured editable forms (the sanctioned fallback).

## R2.3 — Revised migrations (additive; desktop applies + advisors)
Add to §5: **`action_plans` ADD COLUMN `config jsonb NOT NULL DEFAULT '{}'`** (the only new schema for the 4th
action). Editable Settings needs **none**. Everything else in §5 stands.

## R2.4 — Revised acceptance (add to §6)
- [ ] **Act:** click flavor=`code_kickoff` → `action_plans` row with the brief + `config.flavor` + `config.sources[]`
      + prompt_version; UI shows Copy + Export; exported .md opens with the source-linked brief.
- [ ] **Settings editable:** change `min_composite_score` + remove a tracked ticker + change cadence → Save → the
      `user_preferences` row reflects all three (desktop SELECT confirms); reload shows the new values; invalid input rejected.

## R2.5 — Honest scope note for the founder
Phase 1 is now a **substantial "make it real" phase** (4 configurable+traceable actions + editable settings +
un-deadened UI), not a quick patch. PS builds it in verified sub-steps (build order §8). Bounded by the staged
list (source management, conversational config, reverse-traceability, presets, Voice DNA, market data → later).
