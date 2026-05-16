# ForgeMinds — The Bar

> **Purpose:** the product-level definition of "done" that sits ABOVE every phase, every sprint, every audit gate. Locks the meaning of "ready" so future sessions (and future Claudes) can't drift back into "ship at 45% and call it done."
>
> **Pairs with:** `AI_FIRST_AUDIT.md` (the principles), `DATA_FLYWHEEL.md` (the data contract), `CURRENT_SPRINT.md` (the path), `DECISIONS.md` (the history). This file is the gravity.
>
> **Locked:** 2026-05-16 (after the Phase 1.5 close-out audit produced a 51/100 honest scorecard).
> **Review cadence:** re-read at every phase close. Update only via PR with `DECISIONS.md` entry explaining what changed and why.

---

## §1 — What ForgeMinds IS (one sentence, locked)

**A multi-tenant AI-first personal intelligence OS that earns the right to act on a user's behalf by accumulating per-user evidence of what they care about, what they actually do about it, and whether it worked — and that uses that earned data to compound personalization, deepen a Community Brain moat, and make every subsequent user's first day better than the last user's.**

What ForgeMinds is **not**:
- A news reader. (Newsblur, Feedly do that.)
- An AI summary tool. (ChatGPT does that.)
- A bookmarking app. (Pocket, Instapaper do that.)
- A productivity dashboard. (Notion does that.)

If the daily user experience could be substituted with any of those four, we are building the wrong thing.

---

## §2 — The 6 axes scorecard and where we are

From the 2026-05-16 strategic audit (Explore agent). These are the dimensions that define "ready for the real complex world." Re-scored at every phase close.

| Axis | 2026-05-16 score | Target before V1 ship | Hard floor (no exceptions) |
|---|---|---|---|
| Vision clarity | 92 | ≥ 90 | ≥ 85 |
| Architecture soundness | 88 | ≥ 88 | ≥ 80 |
| Execution maturity | 34 | ≥ 75 | ≥ 65 |
| Data velocity | 12 | ≥ 60 | ≥ 50 |
| Moat defensibility | 58 | ≥ 70 | ≥ 60 |
| Real-world readiness | ~30 | ≥ 75 | ≥ 65 |

**Composite minimum for V1 paid ship: ≥ 70 average AND no axis below its hard floor.**

The current 51 average IS NOT a ship-ready product. It is a research prototype with excellent bones. Anyone — Victor, a future Claude, a future investor — who pushes "we're close, let's ship" before the composite hits 70 is wrong, and this document is the receipt.

---

## §3 — Definition of "ready for the real complex world"

A vague phrase made concrete. ForgeMinds is ready for the real complex world when ALL of the following are simultaneously true:

### §3.1 The core flywheel actually spins (the load-bearing claim)

- ≥ 5 external alpha users (not Victor, not friends-as-courtesy — strangers with skin in the game) have used ForgeMinds for ≥ 4 weeks each
- Each alpha user has captured ≥ 10 article outcomes (save/dismiss/rate) on real briefs
- ≥ 3 alpha users have a measured Voice-DNA-ranking delta: week-4 brief relevance score > week-1 brief relevance score, by a margin we have pre-declared as meaningful (e.g., +15 percentile-points on stated relevance ratings)
- At least one user has logged a Phase-3 action outcome with a real-world dollar / time / decision impact
- The Community Brain has fired at least once: at least one k≥5 cohort has accumulated and a real cohort-derived signal has been surfaced to a user

If any one of these five is missing, we are NOT ready, regardless of how good the code looks.

### §3.2 The product survives a hostile second user

A second user — chosen for being maximally unlike Victor (different interests, different time zone, different expertise level, no understanding of RSS) — can:

- Sign up without help
- Complete onboarding in < 10 minutes and end with a working pipeline
- Receive their first brief on schedule, in their timezone
- Save, dismiss, and rate articles without confusion
- Take one Phase-3 action recommendation and complete it
- Delete their account and have all PII + behavioral data removed within 30 days
- Not see a single hardcoded "victor" anywhere in the experience

No "I'll just SQL it in for them" workarounds.

### §3.3 The AI-future-proofing is real, not aspirational

Tested, not designed:
- A model swap (e.g., Claude Sonnet → next-gen Claude or → frontier competitor) requires changing ONE entry in `model-router.json` and zero application code
- The router has been forced through a fallback at least once in production (primary provider degraded → fallback engaged → user never saw the failure)
- Per-user `user_preferred` model overrides actually route correctly (tested with a user picking a non-default provider)
- Every AI-generated row has `prompt_version` set, verified by SELECT count = total AI-gen rows
- Cost caps ($5/task, $30/session per VIBE Rule 58) actually trip in production at least once and surface gracefully

### §3.4 The moat is observable, not just claimed

- Voice DNA has produced at least one measurably better draft than a generic prompt for at least one user (A/B'd, blinded)
- Community Brain has surfaced at least one signal that no individual user could have produced alone
- Source catalog quality scores have been re-ranked at least once by user-aggregate save/dismiss data (not curator-only)
- An action template's `effectiveness_score` has updated based on real user outcomes

If none of these are true, we have no moat — we have a UI over public APIs.

### §3.5 The compliance posture is real, not paperwork

Cross-reference `compliance.md`:
- ToS + Privacy Policy + AI Disclosure exist, are linked at signup, are linked from every regulated surface
- Account deletion endpoint exists, tested with a real test account end-to-end
- Data export endpoint returns valid JSON
- `compliance_audit_log` table is populated for every compliance-sensitive action
- For any financial / investment surface (Phase 3 invest templates): full 3-layer disclaimer stack present
- Attorney has reviewed Privacy Policy + ToS within last 12 months OR explicit `DECISIONS.md` entry that we are pre-attorney-review and operating in closed alpha only

### §3.6 The pre-launch QA matrix passes 100%

All 15 tests from `hostile-architect.md` §QA Matrix pass on a fresh browser, fresh account, fresh device. Specifically the ones that historically catch us:
- Test 9 (Data Completeness Gate Test)
- Test 12 (OAuth Fresh Tab Test)
- Test 13 (Dead Button Test)
- Test 14 (Export Relevance Test)
- Test 15 (Code Read Test)

---

## §4 — What we will NEVER compromise on

These are tripwires. If any are violated, the build stops until fixed. No "ship now, fix later."

1. **No fabrication.** Every number, name, quote, recommendation must trace to real data. Substring-validated where AI-summarized. The 4-layer no-hallucination architecture is not optional.

2. **No PII to AI APIs.** SSN, EIN, bank, full names, credit cards — never. (`privacy.md` §1.) Even if a user pastes one into an article-summary request, the scrubber catches it before egress.

3. **Locked features stay honest.** A locked feature shows an honest "unlocks at N cycles" — not a hidden one, not a fake one, not a "coming soon" tease. (`ai-first-principles.md` §4.)

4. **No silent feature deletion.** Components are user trust. (Factory CLAUDE.md §4 #14.) Gate, don't delete.

5. **Multi-tenant from day 1.** No hardcoded `victor` anywhere. Every UX-affecting value lives in `user_preferences`. (VIBE Rule 55.)

6. **No shipping at 45%.** Every "done" claim must produce an AUDIT GATE block + PHASE AUDIT block. Pre-commit hook enforces. (VIBE Rule 35, Project CLAUDE.md PHASE COMPLETION ENFORCEMENT.)

7. **No vendor lock-in to one AI provider.** Model swap-ability is a structural property, not an option. (VIBE Rule 57(e).)

8. **No production token in agent-accessible `.env`.** Dev project by default. Prod requires explicit user flag per session. (`data-protection.md` §3.)

9. **Off-platform backup runs daily.** Restore-tested quarterly. No single-platform blast radius. (`data-protection.md` §2.2.)

10. **Privacy is structural, not promised.** Community Brain `contribution_id` ≠ `user_id`. Aggregator strips user_id BEFORE insert. Cohort key NEVER computed client-side. (`aggregate-design.md` §7.1.)

---

## §5 — The North Star: what we measure weekly

These are the only numbers that matter. Anything else (DAU, signup count, page views) is vanity until these are healthy.

| Metric | What it measures | Healthy band | Crisis band |
|---|---|---|---|
| **Active loops per user / week** | How many save/dismiss/rate outcomes captured per active user | ≥ 5/week | < 1/week |
| **Cycle completion rate** | Of briefs delivered, % where user captured ≥ 1 outcome within 48h | ≥ 60% | < 20% |
| **Voice-DNA-ranking delta (week-N vs week-1)** | Per-user, measured by stated relevance | +10 percentile-points by week 4 | flat or negative |
| **Community Brain k-hits** | Count of cohorts that crossed k=5 this week | ≥ 1 per category per month at 100 users | none at 100+ users |
| **Action template completion rate** | Of templates surfaced, % that user marks "completed" | ≥ 15% | < 5% |
| **Action outcome rating (when measurable)** | 1-5 of completed actions | ≥ 3.5 median | < 2.5 median |
| **AI cost per active user / month** | All-in inference + embedding cost | ≤ $1.20 Builder / ≤ $6 Architect | > 1.5x of band |
| **Fallback engagement rate** | Of all AI calls, % that hit fallback provider | 1-5% | > 15% (primary unstable) or 0% (router untested) |
| **Hostile second-user pass rate** | % of new alpha users who complete onboarding without intervention | ≥ 80% | < 50% |

Dashboard for these is a Phase-2 hard requirement (cross-ref `observability.md`).

---

## §6 — The "is it shippable" gate (mechanical, not aspirational)

Before any commit subject contains the words "v1", "ship", "launch", "GA", or "production-ready":

- [ ] Composite scorecard ≥ 70/100, no axis below hard floor (§2)
- [ ] All five §3.1 flywheel claims are simultaneously true
- [ ] All six §3.2 hostile-second-user claims are simultaneously true
- [ ] All §3.3, §3.4, §3.5, §3.6 claims are simultaneously true
- [ ] All ten §4 tripwires are clean
- [ ] Phase-N AUDIT GATE block + PHASE AUDIT block exist for every closed phase, no skipped phases
- [ ] `compliance_audit_log` is being populated for every regulated event
- [ ] Off-platform backup tested in last 90 days (per `data-protection.md` §2.3)
- [ ] At least one Phase-3 action has been completed end-to-end by a non-Victor user with a logged outcome rating
- [ ] Attorney has reviewed Privacy Policy + ToS within last 12 months (OR explicit closed-alpha DECISIONS entry)

Pre-commit hook should reject any "v1|ship|launch|GA" commit subject without an inline `SHIPPABLE GATE` block confirming each item with evidence link (commit hash, audit file, screenshot).

This is the same enforcement pattern as the Phase AUDIT GATE — mechanical, not memorable.

---

## §7 — Sequencing principle: prove the loop, then scale

In order, and never skip steps:

1. **Prove the personal flywheel works on strangers.** ≥ 5 alpha users, 4 weeks, measured Voice-DNA-ranking delta. If this fails, we have re-invented Feedly; we stop, learn, redesign.

2. **Prove the Community Brain k-anonymized signals add user-visible value.** At least one cohort, at least one signal, at least one user reports "that was useful." Without this, we're a curated reader, not a moat.

3. **Prove the action engine produces measured outcomes.** At least one action plan completed end-to-end by an alpha user with a logged dollar / time / decision result. Without this, we're a smart feed, not an OS.

4. **Prove the moat compounds across cohorts.** Source quality scores update from user data. Action template effectiveness updates. New users in the same cohort get a measurably better day-1 than the last new user did. Without this, we don't have a flywheel — we have parallel single-user products.

5. **Prove the AI-future-proofing is real.** Force a model swap. Verify fallback under degradation. Confirm cost caps actually engage.

6. **Then, and only then, scale.** Marketing, paid acquisition, Architect-tier feature build, agent ecosystem (Phase 9), mobile (Phase 10).

The greatest threat to ForgeMinds is not a competitor. It is **building Phase 4-10 features on a Phase 2 foundation that hasn't been proven yet.**

---

## §8 — Anti-drift commitments

These exist because every long project drifts. Capturing them so a future Claude (or a future Victor under pressure) can be pointed at this file:

- **"Ship it, we'll iterate" is not a strategy for ForgeMinds.** Tax, finance, AI-recommended actions, user trust — these CAN'T be iterated on publicly. The cost of one published wrong number is permanent user loss. (`lessons.md` #48.)

- **"AI will fix it later" is not a substitute for design.** AI is the moat, not the bandaid. Every feature must pass the 5-question audit BEFORE it's coded. (`ai-first-principles.md` §2.)

- **"It's just a prototype" is over the moment a second user signs up.** Multi-tenant from day 1, no exceptions. (VIBE Rule 55.)

- **"The locked state is fine for now" — only if the locked-state copy is honest.** No vague "coming soon." Specific "unlocks after N cycles, here's what we'll learn." (`ai-first-principles.md` §6.)

- **"We can attorney-review later" is not acceptable for any monetized surface.** Closed alpha is the only excuse for missing legal review, and even closed alpha needs a `DECISIONS.md` entry stating it.

- **"Let me just commit before tests pass, I'll fix in next commit" — pre-commit hook says no.** AUDIT GATE block or no done-wording in commit subject.

- **"More features = more value" is a Pipedream mindset.** More closed feedback loops = more value. Number of features is a vanity metric.

---

## §9 — What this file is NOT

- NOT a roadmap. (See `CURRENT_SPRINT.md`.)
- NOT a feature list. (See spec at `docs/superpowers/specs/2026-04-13-forgeminds-design.md`.)
- NOT an architecture doc. (See `ARCHITECTURE_NOTES.md`.)
- NOT a decision log. (See `DECISIONS.md`.)
- NOT a future ideas backlog. (See `IDEAS_BACKLOG.md`.)
- NOT a checklist of features. It's a checklist of **proofs.**

This file's only job: make sure future-Victor and future-Claude have a hard, unambiguous standard for "ready" that survives pressure.

---

## §10 — Re-review triggers

This file is updated only when one of these happens:

1. A phase closes — append new scorecard reading + brief reflection on §2 trend
2. A §3 claim moves from FALSE to TRUE — celebrate explicitly + note evidence
3. A §4 tripwire fires in production — incident review + the rule gets strengthened
4. The product strategy materially changes — `DECISIONS.md` entry references this update
5. The 6-axis target thresholds (§2) need to be recalibrated — only with founder sign-off

History is APPEND-ONLY in this file. Prior versions live in git, and each revision logs WHO updated and WHY.

---

*Locked 2026-05-16 by Victor + Claude. Composite scorecard at lock: 51/100. Target before next ship-related decision: 70/100 with all axes above their hard floors and all §3 claims simultaneously true.*
