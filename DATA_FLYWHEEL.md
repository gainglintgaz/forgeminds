# ForgeMinds — Data Flywheel Worksheet

> **Purpose:** project-specific instantiation of `.claude/rules/data-flywheel.md`. Defines exactly what data we collect, how we store it, what AI is allowed to do with it, and when each layer unlocks.
> **Pairs with:** `AI_FIRST_AUDIT.md` (the principles side).
> **Last updated:** 2026-05-05.

---

## 12.1 Domain mapping

| Universal placeholder | ForgeMinds value |
|---|---|
| `[entity]` (primary) | **`article`** — the row in `raw_articles` and `scored_articles` |
| `[entity]` (secondary) | `source` (a row in `sources`), `action_plan` (Phase 3), `saved_item` (Phase 4 Brain), `brief` (a delivered digest) |
| `[cycle]` | **brief delivery cycle** — one tick of the per-user dispatcher, rate-limited by `user_preferences.cadence_minutes`. A "cycle complete" event = brief delivered + user has had 24-48h to register save/dismiss outcomes. |
| `[domain_metric]` | `composite_score` (0-1, AI-derived), `time_spent_reading_seconds`, `was_saved` (boolean), `triggered_action` (boolean), `realized_outcome_rating` (1-5, captured at action plan check-in) |

---

## 12.2 Contribution types

Mapping the 7 universal types to ForgeMinds:

| Type | ForgeMinds shape | Phase | Schema status | Locked-state copy |
|---|---|---|---|---|
| **Outcomes** | `article_outcomes` per (user, article) — was the article read, saved, or actioned, and was the action worth it | Phase 2 (per-user scoring foundation) | ⏳ NOT BUILT — needs new table | "🔒 Personalized scoring / Need 1 brief with save/dismiss outcomes captured / Done [N]/1 / Read your first brief, mark each article" |
| **Ratings** | (a) per-article one-tap reaction in brief view; (b) per-action-plan check-in rating (1-5) at outcome time | Phase 2 + Phase 6 | ⏳ NOT BUILT — needs `article_outcomes.rating` column | (same as Outcomes) |
| **Reviews** | (a) `saved_items.notes` private free-text on Brain saves; (b) public optional review of an action template's effectiveness | Phase 4 (private notes) + Phase 6 (public template reviews) | Partial — `saved_items.notes` exists in schema but unused; `template_effectiveness` table exists | "🔒 Save-with-notes pattern detection / Need 5+ saved items with notes / Done [N]/5" |
| **Media uploads** | External evidence attached to action plan completion (e.g., screenshot showing tweet was posted, receipt for purchase made) | Phase 7 (Build Kickoff Packages) + Phase 6 (action outcomes) | ⏳ NOT BUILT — needs Supabase Storage bucket + table | "🔒 Action evidence / Optional photo/screenshot when you complete an action / available now, no minimum" |
| **Likes** | One-tap save = like in this domain. Already mapped to `interaction_action: 'save'` in existing `behavioral_events` enum. | Phase 1 close | ✅ schema exists | n/a (immediate) |
| **Corrections** | "This article is misclassified" / "this entity is wrong" / "this source should be marked dead/low-quality" | Phase 6 (Trust Escalation + Outcome Tracking) | ⏳ NOT BUILT — needs `entity_corrections` table | "🔒 Help us fix data / Optional anytime — flag misclassified articles, wrong entity tags, dead feeds" |
| **Time / context** | Auto-captured: when read, on what device, weather/time-of-day proxies, mood (optional), what app the user came from (referrer) | Phase 1+ (continuous) | ✅ `behavioral_events.metadata jsonb` already in schema; just needs UI plumbing | n/a (auto-captured) |

### What we are NOT collecting (anti-overreach list)

- No keystroke timing or scroll-depth analytics (could fingerprint reading patterns; out of scope until explicit user opt-in)
- No location data beyond timezone (already in `user_preferences.timezone`)
- No social-graph imports or contact-list sync
- No third-party tracker (Google Analytics, Mixpanel, etc.) — internal `behavioral_events` only

---

## 12.3 k=N threshold

- **Default k = 5** for any cross-user aggregate visible in UI (Community Brain Phase 8).
- **k = 1 personal:** a user's OWN single completed cycle is valid input to their own next-cycle scoring (per `data-flywheel.md` §6 "Personal flywheel first"). Not a cross-user claim, just a personal-loop reuse.
- **k = 10 for sensitive cohorts:** when the cohort key combines (profession + paywall_tier + geography), raise to k=10. Examples: "oncology professionals in CA who pay for Bloomberg" — k=10 prevents re-identification at small scale.
- **k = ∞ (suppress entirely)** for any cohort whose only common attribute is a sensitive trait (medical condition, political affiliation, financial distress signal). Never aggregate by these axes alone.

---

## 12.4 Cold-start sources

What ForgeMinds shows BEFORE any flywheel data exists for a given user/entity:

### For brand-new user, first brief
**External / heuristic sources:**
- Source `quality_score` from catalog curator (curator-graded 0-1)
- Recency × novelty × source-quality heuristic ranking
- Source diversity caps (`user_preferences.max_per_category`)

**UI copy on the first brief:**
> *"This is your first brief. We ranked it by recency, source quality, and your stated interests — but we'll personalize from your save/dismiss feedback starting with your second brief."*

### For an article with no internal save/dismiss data
**External:**
- Source's overall `quality_score` from catalog
- Domain heuristics (e.g. medical journal = high-trust)

**UI copy:**
> *"From [source]: [verbatim snippet]. No ForgeMinds user has saved or dismissed this article yet — your read is the first signal."*

### For an article with 1 to k-1 internal contributions
> *"From [source]: [verbatim snippet]. [N] ForgeMinds users have engaged with this so far — we'll surface aggregate stats once 5+ have."*

### For an article with k+ contributions
> *"X of Y ForgeMinds users in your interest cluster found this worth saving (last 30 days)."* + cited verbatim quote from a public review (substring-validated).

### Seed contributors (alpha)
- **Victor (alpha tester #1)** — already configured
- **5 invited beta testers** across diverse domains: medicine professional, finance reader, tech researcher, history teacher, parent — to seed k=5+ heterogeneous outcomes during alpha
- **Why not paid contributors:** per `data-flywheel.md` §13 — payment corrupts data quality

---

## 12.5 Sequenced build phases

Mapping the universal flywheel phases (A-G) to ForgeMinds' roadmap phases (0-10):

| Flywheel Phase | What | ForgeMinds roadmap phase | Trigger | Status |
|---|---|---|---|---|
| **A** Outcomes only | `article_outcomes` table + UI to mark save/dismiss/no-action per article | Phase 2 (per-user scoring) | First brief delivered with outcome-capture UI | ⏳ Pending Phase 1 close + Phase 2 start |
| **B** Reviews + LLM summarization (substring-validated) | `saved_items.notes` private notes + LLM-generated brief summaries with verbatim source quotes | Phase 4 (Brain) + ongoing brief synthesis | 50+ saved items per user OR 100+ across users; brief generation already scaffolded | Partially built (brief generation route exists); review summarization pending Phase 4 |
| **C** Likes (one-tap) | save action in brief view | Phase 1 close | First brief view ships | ✅ Schema ready, UI pending Phase 1 close |
| **D** Media uploads | Action plan evidence (screenshots, receipts, links to off-platform proof) | Phase 7 (Build Kickoff Packages) | First action plan with media field needed | ⏳ Pending Phase 7 |
| **E** Corrections | flag misclassified entities / dead sources | Phase 6 (Trust Escalation) | Misclassification reporter UI ships | ⏳ Pending Phase 6 |
| **F** Cross-cycle pattern AI (personal only) | "you tend to save oncology content on Mondays" — personal patterns, substring-validated against own data | Phase 4-5 (Brain + Voice DNA) | 3+ completed cycles per user | ⏳ Pending |
| **G** Cross-user collective AI ("users like you") | Community Brain insights, gated on k=5+ users with 3+ cycles in profile cluster | Phase 8 (Community Brain) | k=5+ similar users with 3+ cycles each | ⏳ Pending Phase 8 |

**Important:** Phase A (outcomes capture) MUST ship before any Phase 2 personalization claim. Without outcomes, "personalized scoring" is theater.

---

## 12.6 Honest copy templates (locked-state per AI feature)

Per `ai-first-principles.md` §6, locked-state copy is written BEFORE the unlock logic. If the copy can't be written honestly, the feature is premature.

```
🔒 Personalized scoring
We need 1 brief with save/dismiss outcomes to start learning.
Done: 0 / 1.
Read your first brief, then mark each article → next brief is personalized.
```

```
🔒 Pattern detection — "you tend to..."
We need 3 brief cycles with at least 3 outcomes each.
Done: [completed_cycles] / 3.
Mark articles in your next [3 - completed_cycles] briefs.
```

```
🔒 Voice DNA drafts
We learn your voice from edits to AI-generated drafts.
Done: [edit_count] / 5 minimum.
Edit any draft (or accept it as-is) — every edit teaches the model.
```

```
🔒 Brain dot-connector
Surfaces "this connects to something you saved 3 months ago."
Need: 50+ saved items spanning 60+ days.
Done: [saved_count] saved / [oldest_age_days] days oldest.
Save articles + notes from briefs over time.
```

```
🔒 Action template auto-suggest
We need 3 completed action plans with check-in rating.
Done: [completed_with_rating] / 3.
Take an action from a brief recommendation — rate the outcome 30 days later.
```

```
🔒 Community Brain — what others like you do
Aggregates surface only when 5+ similar users have 3+ cycles each (privacy floor).
Currently: [N] similar users in your cluster; [M] with completed cycles.
Coming when more people like you have used ForgeMinds.
```

```
🔒 Trust Escalation — auto-approve patterns
After 15+ approvals of the same action template, we ask whether to auto-approve future matches.
Done: [max_template_approval_count] / 15 (best template so far).
Take + approve more actions of the same type to qualify.
```

```
🔒 Watchers (Phase 9.A)
Background jobs that fire when a condition matches.
Need: 10+ outcomes captured to know what conditions matter to you.
Done: [outcome_count] / 10.
Mark outcomes on briefs + actions to teach the watcher engine.
```

---

## §H. Schema migration plan (per the contribution types above)

To realize this flywheel, ForgeMinds needs the following schema additions beyond what's already shipped. Listed in dependency order:

| New table / column | Phase | Why |
|---|---|---|
| `article_outcomes` (user_id, article_id, brief_id, was_read, was_saved, was_dismissed, action_taken, rating, notes, context jsonb, timestamps) | **Phase 2** | Heart of personal flywheel. Must ship FIRST before any personalization claim. |
| `cycles` (user_id, cycle_type='brief'/'action'/'cycle', status, context, outcome_summary, started_at, completed_at) | Phase 2 | Universal cycle pattern from `data-flywheel.md` §3 |
| `entity_corrections` (user_id, entity_id/article_id/source_id, field, old, new, status='pending'/'verified'/'rejected') | Phase 6 | Corrections flow |
| `action_evidence_uploads` (action_plan_id, storage_path, caption, is_public) | Phase 7 | Media uploads for action proof |
| `template_outcome_reviews` (template_id, user_id, rating, body, is_public, helpful_count) | Phase 6 | Public review of action templates |
| `[entity]_aggregates` materialized views (k=N suppressed) | Phase 8 (Community Brain) | Public-facing stats |

Each new table follows the RLS pattern from `data-flywheel.md` §3:
- Outcomes / corrections / cycles → owner-only (`auth.uid() = user_id`)
- Reviews → owner full access + public read where `is_public AND NOT flagged`

---

## §I. AI/LLM rules applied to ForgeMinds

Per `data-flywheel.md` §8, the AI's job: synthesize real data into useful claims, never fabricate.

### What ForgeMinds AI calls do

| Operation | Layer (per `data-flywheel.md` §8) | Validator |
|---|---|---|
| Brief synthesis (`/api/cron/generate`) | 8.1 Aggregation + 8.2 Review summarization | Substring-validate every quoted snippet against `raw_articles.summary` or `raw_articles.title`. Reject + retry if quote not verbatim. |
| Onboarding intent extraction | 8.1 Aggregation (structured output) | JSON schema validation; reject malformed; coerce-or-default per enum. |
| Onboarding source proposals | 8.1 + 8.2 | Drop any catalog_id not in the candidate set (already implemented in `src/lib/onboarding/agent.ts:isValidPick`). |
| Voice DNA draft generation (Phase 5) | 8.2 + personal | Cite which past edits the style was learned from. Show 0-1 confidence score. |
| Brain dot-connector (Phase 4) | 8.1 (semantic similarity is a real number, not LLM-generated) | None needed — pgvector cosine is real. Surface confidence as similarity score. |
| Pattern detection (Phase 4-5) | 8.3 Personal pattern detection (own data only) | Substring-validate every claim against user's own saves/edits. Never "users like you" until k=5+ + Phase 8. |
| Community Brain aggregates (Phase 8) | 8.1 only (no LLM needed for stats) | Direct SQL aggregates with k=N gating. No AI fabrication possible. |
| Action plan synthesis (Phase 3) | 8.2 with 4-layer no-hallucination | Layer 1 real data (Wikidata/Finnhub/EDGAR) + Layer 2 deterministic templates + Layer 3 profile match + Layer 4 AI synthesis with `fact_check_rules` per template. |

### What ForgeMinds AI is NOT allowed to do

- ❌ Make up review counts in briefs (always cite real number from `behavioral_events`)
- ❌ Generate fake reviews to fill cold-start gaps
- ❌ Output investment/legal/medical advice as fact (Phase 3 templates are explicit about hallucination_risk + fact_check_rules)
- ❌ Cross-pollinate user A's private outcomes into user B's recommendations except via Community Brain aggregates above k=5+
- ❌ Render any "personalized" claim before Loop 1 (per Trust Ladder §C)
- ❌ Surface "AI says..." without showing source (every claim needs a citation/source attribution path)

---

## §J. The Contributor Pact (ForgeMinds-specific, ready for privacy page + onboarding)

> **ForgeMinds only gets smarter with your evidence.** We rely on you to tell us what worked, what didn't, and what we got wrong. In return:
>
> 1. **Your private data stays private.** Articles you save, actions you take, briefs you dismiss, ratings you give — only you see them. We aggregate them into anonymous stats above a 5-user minimum (some sensitive cohorts: 10).
> 2. **Your public contributions stay yours.** When you review an action template publicly, you pick anonymous, named (`@yourhandle`), or private. You can delete any of them anytime.
> 3. **We never fabricate.** Every claim cites real data — your own saves, your own outcomes, or aggregates above the threshold. If we don't have enough yet, we say so plainly with a "🔒 Need [X] more [Y] to unlock" message.
> 4. **Your impact is visible.** Settings shows how many other users your contributions helped (real numbers, not gamification points).
> 5. **The AI works for you, not on you.** We never use your private outcomes to influence other users' recommendations except via aggregate stats above the threshold. Voice DNA is yours and yours only — never used to mimic you for someone else.
> 6. **You earn the agent.** AI suggestions stay hedged ("based on 1 brief") until you've completed enough cycles for honest patterns. Default-on agent mode is locked behind 6+ cycles. We never auto-execute on your behalf without explicit opt-in.
>
> *That's the pact. If we ever break it, hold us accountable.*

---

## §K. Cost realism (ForgeMinds-specific)

Per `data-flywheel.md` §10:

| Item | Free tier | Paid (Builder $14.99) | Paid (Architect $34.99) |
|---|---|---|---|
| Postgres rows | Supabase Free 500MB | Supabase Pro $25/mo at launch | included |
| Media storage (action evidence Phase 7+) | Supabase 1GB free | Cloudflare R2 10GB free | R2 + $0.015/GB after |
| Moderation API (Cloud Vision SafeSearch on uploads) | 1000/mo free | $1.50/1000 | included |
| LLM cost per active user/mo (per Q4 audit above) | ~$0.50 | ~$1.20 (Builder use) | ~$6 (Architect heavy use) |
| Aggregate refresh (nightly pg_cron) | trivial | trivial | trivial |

**Realistic spend at first 1k users (mixed tier):** ~$200-400/mo platform + ~$1500/mo AI = $1700-1900/mo cost vs ~$8000-15000 MRR (assuming 10% Architect / 30% Builder / 60% Free). **80-90% gross margin.**

---

## §L. Sign-off + cadence

- **First filled:** 2026-05-05 (skeleton, Phase 1 close pending)
- **Re-fill cadence:** at every phase close (Phase 1 close, Phase 1.5 close, Phase 2 close, etc.)
- **Owner:** Victor + auto-loaded into every Claude session via `.claude/rules/`

If a future session is unsure whether a feature/data-flow follows this worksheet — re-read this file. If the feature can't satisfy the locked-state copy honestly, it's premature. Ship the locked state; come back when the data exists.
