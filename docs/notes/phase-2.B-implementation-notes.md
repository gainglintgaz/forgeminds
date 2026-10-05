# Phase 2.B — Voice DNA Capture: Implementation Notes

> Running journal of decisions / deviations / tradeoffs while building input Voice DNA capture (style anchors + tone + density) alongside the rule-file split. Light-cost audit trail (Thariq's pattern) so the next session doesn't re-litigate.

**Session date:** 2026-05-18 → 2026-05-19 (overnight)
**Branch:** master
**Migration:** `20260518000000_user_style_anchors.sql` (applied to dev `ymgbjtgczgnooscigplb`)

---

## 1. Decision — Wizard insertion point: new step between refine and confirm

**Choice:** Inserted `/onboarding/style` as a NEW page (step 3 of 4), pushing `/onboarding/confirm` to 4 of 4. Refine now routes to `/onboarding/style` instead of straight to `/onboarding/confirm`.

**Alternatives considered:**
- **Fold style capture into `/onboarding/intake`** — rejected because intake is conversational/chat-based and already busy with topic discovery. Mixing modalities (chat for topics + form for style) inside one page would dilute both.
- **Fold style capture into `/onboarding/refine`** — rejected because refine is a long list of source toggles. Adding 8+ form fields below it would push the Continue button below the fold for any user with >3 proposals.
- **Make style capture a post-onboarding settings page** — rejected because the brief generator reads `style_*` columns on EVERY brief; un-captured users get the bland default prompt forever unless prodded back to settings.

**Why a dedicated step wins:** Separable from topic capture (different cognitive task), pre-loaded with prior values for re-runs (user can recalibrate without re-doing onboarding), and forces the capture before the first brief generates rather than relying on the user finding settings.

---

## 2. Decision — Anchors as JSONB array, not a separate table

**Choice:** `user_preferences.style_anchors jsonb default '[]'::jsonb` instead of a `style_anchors` table with FK to `user_preferences`.

**Tradeoffs:**
- JSONB **pro:** one row per user, no joins on every brief generate, MIN/MAX validation in the API layer
- JSONB **con:** can't enforce per-anchor constraints in SQL (had to do `>=3, <=5` in the route handler instead)
- Separate-table **pro:** queryable individually (e.g., "users who anchor on Matt Levine"), enforce length/CHECK at DB
- Separate-table **con:** another migration, another RLS policy, joins on every brief

**Verdict:** JSONB. The anchor data is tightly coupled to its user, never queried across users (privacy: it's part of the per-user moat), and is read whole-or-nothing by the brief generator. If a future feature wants "users who anchor on X" for community-brain purposes, that's a Phase 8 problem and a derived index, not a schema redesign.

---

## 3. Decision — Bounded enum-via-CHECK for tone + density, not a dedicated enum type

**Choice:** `text CHECK (style_tone IN (...))` instead of `CREATE TYPE style_tone_kind AS ENUM (...)`.

**Why:** Adding a new tone later (e.g., "playful") to a CHECK is a no-downtime `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT`. Adding to a Postgres ENUM is also online in PG ≥ 12 but historically required full table rewrite. CHECK is more portable, easier to extend, and the brief generator reads them as strings anyway.

**Tradeoff:** No automatic TypeScript type generation from the DB. Mitigated by hand-typed unions in `src/lib/pipeline/user-prefs.ts` (`StyleTone`, `StyleDensity`).

---

## 4. Decision — Brief prompt extension is a prefix, not a wholesale rewrite

**Choice:** `buildStylePrefix(style)` returns a string that gets prepended to the existing v0.1 system prompt. Bumped `GENERATE_PROMPT_VERSION` to `generate-v0.2`.

**Why:** Preserves the v0.1 HARD RULES (no fabrication, JSON schema contract) verbatim. Style adaptation is an ADDITIVE layer above the no-hallucination contract — never overrides it. The prefix explicitly says: *"Style adaptation NEVER overrides the HARD RULES below."*

**Tradeoff:** A naive model could over-weight the style anchors and start inventing facts to match the anchor's voice (e.g., "Matt Levine often jokes about M&A — let me invent a joke about M&A"). Mitigation: the prefix says "match rhythm, vocabulary, and stance — without quoting them." Future enhancement (deferred): fetch actual sample text from anchor URLs via Jina Reader for tighter style transfer, but only after we ship the basic version and measure user feedback.

**`prompt_version` rationale:** schema change (`style_anchors` column added) + prompt change (`buildStylePrefix` added) → version bump. The `prompt_version` audit chain captures both the column-add migration date AND the prompt template version.

---

## 5. Decision — Validation lives in the API route, not the DB

**Choice:** The `/api/onboarding/style` route validates anchor count (3-5), name length (≤100), URL shape (http(s), ≤500), why length (≤300), and tone/density set membership. The DB only enforces the CHECK on tone/density.

**Why:** API-level validation gives better error messages (named fields, specific reasons) for the wizard UX. DB constraints are the last line of defense against a malicious client, but anchor count is a UX rule, not a data-integrity rule.

**Defense-in-depth:** The DB still rejects invalid tone/density via CHECK; an attacker bypassing the API still can't insert "tone = 'spicy'". The "≥3 anchors" rule is UX-only because the DB has no way to count JSONB array elements in a CHECK constraint without a function — and that function would have to evolve as the rule changes.

---

## 6. Open question — Style update flow post-V1

If a user wants to change their style anchors AFTER the alpha, where do they go? Options:
- **A.** Re-run `/onboarding/style` (the page pre-loads existing values, so this works out of the box — but `/onboarding/*` URLs are weird to revisit post-onboarding)
- **B.** Add a `/settings/style` page that mounts the same `<StyleCaptureForm />` component
- **C.** Inline edit on `/dashboard` or `/briefs/[id]`

Deferred to Phase 2.5 alpha learning. If alpha testers ask for it, we'll know which surface they want.

---

## 7. Deviation — `loadPrefs` extended in this session

The original Phase 2 brief said "wire submission to write to user_preferences via /api/onboarding/finalize." I chose a dedicated `/api/onboarding/style` route instead — finalize is already a 200-line beast doing source acceptance + intent extraction + user_preferences update for cadence/density. Adding style logic inside it would make the file harder to read AND would couple style capture to the source-acceptance step (can't update style without re-running finalize).

**Tradeoff:** One more route file. Cleaner separation. Style updates can fire independently of source acceptance (future settings page).

---

## 8. Open question — Sample-text fetch from anchor URLs

The brief prompts call out anchor names + "what you love about their style" — but the model doesn't actually see HOW the anchor writes. To do tighter style transfer, we'd need:
1. Fetch the URL via Jina Reader (or Firecrawl)
2. Extract 500-1000 chars of representative prose
3. Cache per-anchor with a TTL of ~7 days
4. Feed the sample as additional context in the prompt prefix

**Cost concern:** Each fetch is ~$0.0005-0.002 depending on tool, plus storage. For 5 anchors × ~1000 users at $0.001 each = $5/refresh-cycle. Tolerable, but only worth doing if alpha shows that name-only style transfer is insufficient. Building the measurement first; the fetch comes in Phase 2.5+ if measured to matter.
