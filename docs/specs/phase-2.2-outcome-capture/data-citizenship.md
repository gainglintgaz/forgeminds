# Data Citizenship Audit — Phase 2.2 Outcome Capture

> Per `.claude/rules/data-citizenship.md`. Every value this feature creates or displays must have all four traits filled in — and the 30-second audit-fitness test must pass.

---

## Value 1 — Outcome state (saved / dismissed / no_action / action_taken)

### Source
The user's click on the outcome bar. The row of record is `public.article_outcomes` keyed by `(user_id, article_id)`. The auth boundary is the `auth.uid()` check at the entry of the `upsert_article_outcome` RPC — if the user is unauthenticated, the RPC raises and no row is written.

**Forbidden source kinds for this value:** any default value other than the column default (`'no_action'::article_outcome_kind`). The column default is the source-of-truth for "user has not yet given signal on this article."

### Derivation
Identity transform. The displayed bar state is rendered directly from `article_outcomes.outcome` — no formula, no aggregation, no extrapolation. The bar shows:
- `'no_action'` → bar in neutral state (all three buttons clickable, none filled)
- `'saved'` → Save button filled, others clickable
- `'dismissed'` → Dismiss button filled, others clickable
- `'action_taken'` → reserved for Phase 3+ Action Engine; renders as "Acted" badge in 2.2

### Destinations
Every consumer of `article_outcomes.outcome` for this `(user_id, article_id)` pair:

| Destination | When it consumes | Read pattern |
|---|---|---|
| `/briefs/[id]` outcome bar | Every render of the brief | `.from('article_outcomes').select('outcome, rating').eq('user_id', auth.uid).in('article_id', articleIds)` |
| `behavioral_events` mirror | Synchronously, per upsert | Written by `track_event()` inside `upsert_article_outcome` RPC |
| Phase 2.5 Voice DNA training | Daily batch (planned) | TBD — Bridge Brief for that consumer must drill its Source column back to this row |
| Phase 3 per-user scoring weights | Per-tick weight recalculation (planned) | TBD — Bridge Brief for that consumer must drill its Source column back to this row |

**Forward-coupling note:** Phase 2.5 and Phase 3 consumers don't exist yet. When their Bridge Briefs are written, their **Source** column must explicitly cite `article_outcomes` rows; their **Destination** column then closes the loop by listing those new consumers here. The Data Citizen role on this Council will block Phase 2.5/3 sign-off if their Bridge Briefs don't drill back.

### Provenance
- **who:** `article_outcomes.user_id` (matches `auth.uid()` at write time per RLS)
- **when:** `created_at` (first signal) + `updated_at` (latest change, maintained by `article_outcomes_set_updated_at` trigger)
- **from_where:** "user click on outcome bar at /briefs/[id]"; concrete `brief_id` recorded in `article_outcomes.brief_id` column
- **via_what:** `upsert_article_outcome` RPC; `prompt_version` column NULL because Phase 2.2 outcomes are direct user actions (no AI involved)
- **as_of:** N/A — outcome state is the latest user signal, not a derived snapshot

**Audit query a user could run** (or that we'd surface via Provenance affordance):
```sql
select outcome, rating, created_at, updated_at, brief_id
from public.article_outcomes
where user_id = auth.uid() and article_id = '<article uuid>';
-- Plus the event stream:
select event_type, created_at, metadata
from public.behavioral_events
where user_id = auth.uid() and article_id = '<article uuid>'
order by created_at desc;
```

---

## Value 2 — Rating (1–5 stars)

### Source
The user's star-click. Same row of record (`article_outcomes`) — the `rating` smallint column constrained to 1..5.

### Derivation
Identity, rendered as N filled stars of 5 (e.g., `rating = 4` → ★★★★☆). No averaging across users or articles in Phase 2.2 scope.

### Destinations
Same set as Value 1 — the bar, the mirror, future Voice DNA and scoring-weight consumers.

### Provenance
Same row and audit trail as Value 1.

**Special note:** `rating` is nullable. The semantic is "user has not provided a rating" — distinguishable from rating = 0 (which the CHECK constraint disallows). The bar must NEVER render `null` as "0 stars" or "no rating yet" as anything other than the neutral empty state.

---

## Provenance component contract (Phase 2.2 implementation)

The outcome bar gets a `ⓘ` affordance immediately to its right. On hover or tap:

```
┌─────────────────────────────────────────────────────────────┐
│ Saved by you on May 20 at 9:14 AM                            │
│ Last changed: 4 minutes ago                                  │
│ Outcome row: article_outcomes [outcome_id slice]            │
│ Mirror event: behavioral_events.event_type = article_save   │
└─────────────────────────────────────────────────────────────┘
```

The article title itself is the link to the source article (the underlying news content). Clicking the article opens `raw_articles.url` in a new tab — the article IS its own source row in the user's mental model; the bar's `ⓘ` is the per-(user, article) decision row.

---

## 30-second audit-fitness test

A user looking at "I marked this article as Saved 3 days ago" must be able to answer:

1. **"Where did this come from?"** Hover the `ⓘ` → see "Saved by you on <date> at <time> · last changed <relative-time>." Click article title → open the source article. **Round-trip in ≤10 seconds. PASS.**

2. **"Where else does this end up?"**
   - Phase 2.2 scope: the bar itself + the `behavioral_events` mirror row. Both visible in the `ⓘ` tooltip.
   - Future consumers (Voice DNA, scoring weights): not built yet. When they ship, the `ⓘ` tooltip should be extended to list them.
   - **PASS for Phase 2.2 scope; the forward-coupling depends on Phase 2.5+ honoring the Source-citation contract.**

**Overall: PASS.**

---

## No AI output in Phase 2.2

This feature does not generate any AI-derived text or number. The `sources[]` substring-validation contract from `data-citizenship.md` §2.3 does not apply. If Phase 3 Action Engine generates AI suggestions based on `article_outcomes` rows, that Bridge Brief will need its own AI-output section with substring validation and `ai_output_provenance` logging.

---

## Pre-commit grep tripwire compliance

Per `data-citizenship.md` §4:

- **Numeric display without Provenance import:** The outcome bar displays counts and star-renderings of `rating`. The component imports `<Provenance />` (or the equivalent inline `ⓘ` tooltip) — the file containing the bar must reference it. Verified in implementation review.
- **Hardcoded dollar literals in user-facing components:** N/A — Phase 2.2 has no dollar values.

---

## Citizenship sign-off

✅ **Pass.** Outcome capture is structurally citizen-of-the-system: both the outcome state and the rating have all four traits filled, the Provenance affordance is wired, the 30-second test passes, and no AI hallucination surface exists in Phase 2.2 scope. Forward-coupling to Phase 2.5+ is conditional on those future Bridge Briefs honoring the Source citation contract — the Data Citizen role will enforce that at their merge time.
