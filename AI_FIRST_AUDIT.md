# ForgeMinds — AI-First Audit Worksheet

> **Purpose:** project-specific instantiation of `.claude/rules/ai-first-principles.md`. This file fills in every placeholder for ForgeMinds and locks the answers as the contract.
> **Cadence:** re-run the 5-question audit at every phase close (Phase 1 close, Phase 1.5 close, etc.). Update this file with the new state. History is append-only — never delete prior audits, add a new dated section.
> **Last audit:** 2026-05-05 — Phase 1 close pending, Phase 1.5 skeleton built.

---

## §A. Define the loop

A single complete cycle for a ForgeMinds user:

1. **Setup (one-time per major intent shift):** Conversational onboarding agent (`/onboarding/intake`) extracts intent → catalog RAG → user picks sources → `sources` rows written.
2. **Brief delivery:** Per-user dispatcher cron tick → ingest fetches user's source-typed feeds → score → curate → enrich → generate → deliver. Brief lands in `/dashboard` + email.
3. **Read + signal:** User views brief, marks articles save / dismiss / no-action. Optional: takes an action from Phase 3 templates → action plan persists with check-in date.
4. **Outcome capture:** Action plan check-in date arrives → user rates outcome (1-5) + realized value. Save/dismiss patterns aggregate into per-user scoring weights.
5. **Loop closes:** Next brief tick uses prior cycle's signals to re-rank + adjust density caps + suggest sources to add or drop.

**Calendar time per cycle:**
- Short loop (per-brief): user's `cadence_minutes` (default 60 min for daily readers, up to 1440 for weekly).
- Long loop (action outcome): 7-90 days depending on action type.

**Inputs / outputs:**
- Inputs: free-form interest description (intake), source picks, save/dismiss/edit signals, action ratings.
- Outputs: ranked brief, generated summary in user's voice (Phase 5+), action recommendations, Brain dot-connections, Voice DNA-personalized drafts.

---

## §B. The 5-question audit (current state, 2026-05-05)

### Q1 — Removed-AI test → **NO** ✅

If we strip out every LLM/AI/automation call, what survives:

| Layer | Without AI |
|---|---|
| Source ingest (RSS fetch) | ✅ works (just HTTP GET + parse) |
| Source scoring | ❌ gone (no Gemini scoring → no signal) |
| Curation | ❌ gone (no relevance ranking) |
| Brief generation (HTML/text summary) | ❌ gone (Claude Sonnet writes these) |
| Onboarding wizard | ❌ gone (Claude Haiku extracts intent + Sonnet picks sources) |
| Brain dot-connector (Phase 4) | ❌ gone (OpenAI embeddings + cosine search) |
| Voice DNA (Phase 5) | ❌ gone (entire premise is LLM personalization) |
| Action templates (Phase 3) | ❌ gone (LLM synthesis layer in 4-layer architecture) |
| Watchers / Agents (Phase 9) | ❌ gone |

**Estimated survival: ~5%.** Just an authenticated RSS aggregator. **PASS — AI is structurally centered.**

### Q2 — Flywheel test → **YES** ✅

Mechanisms by which ForgeMinds gets smarter as more users use it:

| Mechanism | Phase | Compound effect |
|---|---|---|
| Per-user save/dismiss → personal scoring weights | 2 | Each user's recall improves cycle-over-cycle |
| Voice DNA edit-tracking → user's writing style learned | 5 | After ~50 edits, drafts match user's voice |
| Action template effectiveness → realized-outcome ratings → template re-ranking | 6 | Templates that produce outcomes float to the top |
| Community Brain (cross-user, k=5+ aggregates) | 8 | "Users in your cluster who took action X had +$Y median outcome" |
| Source catalog quality refinement (save-rate → quality_score) | 8 | Catalog quality_score becomes data-driven, not curator-only |

**PASS — flywheel exists, compounds across all four layers** (information / advice+action / Brain / community).

### Q3 — Hours-replaced test → **Several hours per session → category-defining for power users**

Per typical Builder/Architect-tier user:

- News triage (Pipedream replacement): 1-2 hrs/day saved
- Action research (Phase 3 templates surfacing investment / build / content angles): 1-3 hrs/week saved
- Voice-matched content drafts (Phase 5): 2-5 hrs/week saved
- Knowledge-base curation (Brain Phase 4): 30 min/week saved + amortized future-recall benefit
- Multi-step research (Phase 9.B agents): replaces a research assistant on episodic deep dives

**Total ~5-15 hours/week per active user. Tier: Centered AI → Category-defining.**

### Q4 — Cost-per-session test → **Scalable**

Marginal AI cost per active session, current Phase 1.5 estimate:

| Operation | Provider | Cost |
|---|---|---|
| Onboarding intent extract | Claude Haiku | $0.001 |
| Catalog RAG embed query | OpenAI embed-3-small | $0.0002 |
| Catalog proposal pick (Sonnet, prompt-cached) | Claude Sonnet | $0.04 (first call) → $0.005 (cached subsequent) |
| Per-brief scoring (~20 articles) | Gemini Flash | $0.005 |
| Per-brief summary generation | Claude Sonnet | $0.02 |
| Per-action-template synthesis | Claude Sonnet | $0.03 |
| Per-Voice-DNA draft | Claude Sonnet | $0.04 |

**Daily-active Builder user (1 brief/day, 3 actions/wk, 2 drafts/wk):** ~$0.04/day = **$1.20/mo per active user.**
**Architect heavy user (3 briefs/day, 10 actions/wk, 7 drafts/wk):** ~$0.20/day = **$6/mo per active user.**

vs. tier prices ($14.99 Builder / $34.99 Architect):
- Builder: 92% margin
- Architect: 83% margin

**PASS — scalable; even free Explorer tier (1 brief/day, no Phase 5/6) costs <$0.50/mo per user, absorbed into freemium funnel.**

### Q5 — Proprietary advantage test → **Strongest moat (vertical-specific dataset)**

What can ForgeMinds do that anyone with API keys cannot:

| Asset | Owner | Replication difficulty |
|---|---|---|
| Per-user **Voice DNA** (edit-history × N users) | ForgeMinds | Cannot replicate without that user's edit history — months of data per user |
| Per-user **Brain** (saved items + dot-connections) | ForgeMinds | User-specific; persistent personal memory |
| **Outcome-tagged action templates** (Phase 6: ratings × realized values × profile clusters) | ForgeMinds | Requires year+ of user outcomes; impossible to bootstrap |
| **Community Brain** (anonymized cross-user aggregates, k=5+ gated) | ForgeMinds | Network-effect moat, gets stronger per user |
| **Curated source catalog with quality scores** (300-500 entries) | ForgeMinds | Curated; competitor would need months of curation work |

**PASS — strongest moat. Product gets stronger per user AND per cohort.**

### Audit summary

| Q | Answer | Pass? |
|---|---|---|
| Q1 — Removed-AI test | NO (~5% survives) | ✅ |
| Q2 — Flywheel test | YES (4 compounding mechanisms) | ✅ |
| Q3 — Hours-replaced | Several hours/week → category-defining | ✅ |
| Q4 — Cost-per-session | Scalable across all 3 tiers | ✅ |
| Q5 — Proprietary advantage | Strongest moat (Voice DNA + Brain + Community + outcomes) | ✅ |

**Verdict: ForgeMinds passes the AI-first audit cleanly.** Continue building; no pivot needed.

---

## §C. Trust Ladder mapping

What each Loop count unlocks for a ForgeMinds user. **Locked, not hidden** — the user sees what the system is capable of and exactly what would unlock it.

| Loop | Definition (ForgeMinds-specific) | Available | Locked |
|---|---|---|---|
| **L0** — Cold start | User signed up; onboarding agent run; sources written; no briefs delivered yet | Conversational onboarding (Phase 1.5), source catalog browse, manual source add, dashboard with empty state, Phase 1 cron pipeline running but dormant | Personalized re-ranking, "we noticed..." claims, action templates surfaced, Voice DNA drafts, Community Brain insights |
| **L1** — First brief delivered | First brief lands in `/dashboard` and Gmail; no save/dismiss outcomes captured yet | Real ranked brief (composite score, recency, novelty, source-quality), source diversity stats, ticker callouts, "this is your first brief — mark articles to teach the AI" copy | Per-user scoring weights, hedged personalization, pattern claims |
| **L2** — First cycle outcomes | User saved/dismissed at least 3 articles in their first brief | Hedged personalization with sample-size disclosure ("based on 1 brief, low confidence"), preview-state pattern hints | Confident pattern claims, cross-cycle aggregation, action template auto-suggest |
| **L3** — Second brief with prior outcomes | User has ≥2 briefs with outcomes captured; ≥10 outcomes total | Cross-loop hints ("you saved 3 oncology articles last cycle — should I tilt next brief?"), action template surfacing for high-confidence matches | Auto-execution of any action, scheduled content publishing, default-on agents |
| **L4-L5** — Established rhythm | ≥5 briefs with outcomes; ≥30 outcomes; ≥3 action plans with check-in rating; ≥5 Voice DNA edit captures | Confident self-tuning suggestions, Voice DNA drafts in opt-in preview, Brain dot-connector with 50+ saved items, Watchers (Phase 9.A) opt-in | Default-on agents, multi-step automation without per-step approval |
| **L6+** — Power user | ≥10 briefs, multi-month history, ≥50 saved items, ≥10 action plans rated, Voice DNA mature | Full agent mode opt-in (auto-curate, auto-draft, auto-research via Phase 9.B), self-tuning thresholds, Trust Escalation (Phase 6) auto-approval per template | Default-on agent (always opt-in even at L6) |

---

## §D. Per-feature gating state

Every AI feature in ForgeMinds and its current state. **Status uses HIDDEN / LOCKED / PREVIEW / AVAILABLE / RECOMMENDED** per ai-first-principles.md §4.

| Feature | Phase | Today's state (2026-05-05) | Trigger to advance |
|---|---|---|---|
| Conversational onboarding agent | 1.5 | LOCKED until catalog seeded | Apply 20260510 migrations + seed ≥200 sources via curator subagent |
| Source-validator (custom URL path) | 1.5 | AVAILABLE (skeleton) | Already passing tsc/lint/e2e auth gates |
| Per-user scoring | 2 | HIDDEN until L1 unlocks | First brief delivered (Phase 1 close) |
| Personalized re-ranking | 2 | LOCKED until L2 | 3+ save/dismiss outcomes captured |
| Pattern claims ("you tend to...") | 4 | LOCKED until L3 | 3+ completed brief cycles with outcomes |
| Brain save-to-pgvector | 4 | LOCKED until L1 | Phase 4 ships |
| Brain dot-connector | 4 | LOCKED until L4 | 50+ saved items + 3+ briefs |
| Decay alerts (resurrection panel) | 4 | LOCKED until L4 | 50+ saved items aged 90+ days |
| Voice DNA extraction | 5 | LOCKED until L4 | 5+ edits captured |
| Voice DNA drafts | 5 | LOCKED until L5 | 50+ edits with diff_analysis |
| Action template surfacing | 3 | LOCKED until L3 | 3+ briefs delivered |
| Action template auto-suggest | 3 | LOCKED until L4 | 3+ action plans completed with rating |
| Trust Escalation (auto-approve) | 6 | HIDDEN until L5 | 15+ approved actions in same template |
| Outcome aggregates per template | 6 | LOCKED until L4 | 3+ user outcomes per template |
| Build Kickoff Packages | 7 | LOCKED until L3 | First "build" vector action completed |
| Community Brain insights | 8 | LOCKED until k=5+ users with 3+ cycles | Cross-user threshold |
| Watchers (Phase 9.A) | 9 | LOCKED until L4 | 10+ outcomes captured |
| Multi-step Agents (Phase 9.B) | 9 | LOCKED until L5 | Voice DNA + Brain populated |
| Workflows (Phase 9.D) | 9 | HIDDEN until L6 | Power-user tier earned |

---

## §E. Anti-fabrication enforcement (per `ai-first-principles.md` §5)

Mechanisms in place / pending in ForgeMinds:

| Rule | Status | Implementation |
|---|---|---|
| 1. No fabricated claims (substring validators) | ⏳ Phase 4+ | To build for: Brain summary generation, brief synthesis, Voice DNA drafts. Pattern: any LLM-output snippet of an article/review/saved-item must be a verbatim substring (case + whitespace normalized). Reject + retry up to 3x, then surface "couldn't generate" empty state. |
| 2. No theatrical "AI thinking..." spinners | ✅ | Spinners only display during real fetch/compute (verified during Phase 0). No fake-loading patterns. |
| 3. No hardcoded "AI suggestion" pretending to be ML | ✅ | Per VIBE Rule 55 — every UX-affecting value lives in `user_preferences` columns. Static rules labeled as such (e.g., "boost articles tagged with `tracked_tickers`" is deterministic boost, not AI). |
| 4. No agent saying "I learned from your last cycle" before there is one | ✅ Structurally enforced | Trust Ladder (§C) gates each capability per Loop count. Phase 4-5 features check `count(distinct user's outcome cycles) >= N` before rendering. |
| 5. No vendor lock-in to one AI provider | ✅ | `src/lib/ai/router.ts` abstracts every provider. Swap by changing `TASK_MODEL_MAP`. Phase 1.5 added Claude/OpenAI/Perplexity alongside existing Gemini/Grok. |
| 6. No silent failure | ⚠️ Partial | Onboarding routes return `503` with detail when catalog/RPC missing, `422` for low-quality intent. Need to extend to Brain/Voice DNA/Action Templates as they ship. |
| 7. No PII in event logs | ✅ | Privacy.md auto-loaded. `behavioral_events.metadata` jsonb is the analytics surface; no full names / SSN / email addresses written. Truncate-merchant-to-20-chars rule applies. |
| 8. No accuracy claims without measurement | ✅ | Marketing copy currently states "real RSS, real AI scoring" — no fabricated accuracy %. Future claims require benchmark logged in DECISIONS.md. |

---

## §F. Reconciliation with existing factory rules

This file SUPERSEDES the lighter weight rules added 2026-05-05:

- **VIBE Rule 57** (AI-at-the-Core) — kept as the high-level principle. The mechanical test ("≥75% works without AI = bandage") is consistent with `ai-first-principles.md` Q1.
- **Factory CLAUDE.md §4 Rule 19** — kept as the cross-project pointer. Body of the rule references both the universal `ai-first-principles.md` and `data-flywheel.md` files now living in this project's `.claude/rules/`.
- **lessons.md #99-100** — applies as historical lessons; no conflict.

The newly-imported `ai-first-principles.md` and `data-flywheel.md` are MORE rigorous (Trust Ladder, feature gating states, substring validators, k=N rule, sequenced phase order). Where the universal rules and the older factory rules disagree, the universal rules win.

---

## §G. Audit history

| Date | Phase context | Pass/Fail | Notes |
|---|---|---|---|
| 2026-05-05 | Phase 1 close pending, Phase 1.5 skeleton built | ✅ All 5 questions pass | First formal audit. Established baseline. |

(Future audits append rows.)
