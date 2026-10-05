# Bridge Brief — `phase-2.2-outcome-capture`

> Generated 2026-05-17 by running the Senior Council against ForgeMinds Phase 2.2.
> Companion docs in this folder: `council.md` (per-role deep-dive), `data-citizenship.md` (standalone four-trait audit).
> Founder sign-off required (exact phrase: "build approved") before any code lands in `src/`.

---

## 1. Job-to-be-Done

**User:** An alpha tester reading their first ForgeMinds daily brief, mid-coffee on a weekday morning, with three minutes before their first meeting.

**Sentence:** *"I want to tell ForgeMinds which of today's stories were worth my time, so tomorrow's brief is sharper without me writing a survey."*

**Success criteria (one):** The user **clicks one of {save, dismiss, rate}** on at least one article in the brief — and the click visibly persists across a page refresh.

**Five states + copy:**

| State | When | UI |
|---|---|---|
| HIDDEN | No brief rendered (briefs index page; auth-redirect) | Not in DOM |
| LOCKED | N/A — outcome capture is available to every authenticated user from brief #1 | — |
| PREVIEW | N/A — capture is binary | — |
| AVAILABLE | Default state for every authenticated user viewing `/briefs/[id]` | Three-button bar under each article: `Save · Dismiss · Rate ★★★★★`. First-brief hint: *"Tell me how this landed — your saves and dismisses tune tomorrow's picks."* |
| RECOMMENDED | After three articles in a row without an outcome captured | Inline nudge: *"One tap per story, no survey. Even a dismiss helps."* Dismissable. |

**Reviewer test:** *"If I swapped 'ForgeMinds' for 'Brief.com' or any other curation product, would this copy still work?"* **NO.** Competitors don't promise the personal learning loop ("tunes tomorrow's picks"). The copy is structurally tied to the per-user flywheel.

---

## 2. Data Contract

**Input rows read:**
- `briefs (id, user_id, article_ids)` — parent brief
- `raw_articles (id, title, source_name)` — article display
- `article_outcomes (article_id, outcome, rating)` WHERE `user_id = current_user` — to paint bar with stored state on first render

**Output rows written:**
- `article_outcomes` — via `public.upsert_article_outcome(p_article_id, p_brief_id, p_outcome, p_rating, ...)` RPC (SECURITY DEFINER, owner-RLS, atomic mirror to `behavioral_events`)
- `behavioral_events` — written by the RPC; no direct write from this feature

**Schema additions:** None. All DDL shipped in `supabase/migrations/20260516000000_phase2_kickoff.sql` (Phase 2 kickoff — commit 16e73d3).

**Indexes required:** None new. Existing indexes cover both paths:
- `article_outcomes_user_idx (user_id, updated_at desc)` — for the user's recent activity list
- `article_outcomes_user_article_uq (user_id, article_id)` UNIQUE — for the RPC upsert

**Reused helpers / components / patterns:**
- `<ArticleOutcomeBar />` component (already imported at `src/app/(dashboard)/briefs/[id]/page.tsx:6` — currently a shell)
- `@supabase/ssr` server client (`createClient`) for read; browser client for `rpc()` write
- `upsert_article_outcome` SECURITY DEFINER RPC (no schema changes needed)
- Existing toast / error-boundary patterns from `/dashboard`

**Extended or conflicting patterns:** None. The component shell exists; this feature wires it.

**Data flow paragraph:** User opens `/briefs/[id]`. Server component reads brief + articles + pre-existing outcomes (RLS-scoped to caller's auth.uid) and paints the bar with stored state. User clicks Save / Dismiss / Rate. Browser calls `supabase.rpc('upsert_article_outcome', { p_article_id, p_brief_id, p_outcome, p_rating })`. RPC writes `article_outcomes` row AND mirrors to `behavioral_events` atomically. Server returns the new `outcome_id`. UI flips optimistically on click; reconciles to confirmed state on RPC success. On RPC error, UI reverts and surfaces a toast.

**Failure if a downstream layer goes down:** Supabase REST endpoint down → bar shows a transient error toast and stays in pre-click state. The user can retry. No data is lost because no optimistic-only path persists state that isn't server-confirmed.

---

## 3. Failure Modes

| # | Failure mode | Default outcome (without our handling) | Our handling |
|---|---|---|---|
| 1 | Empty data | Bar renders in default `no_action` state | Correct — no special case needed |
| 2 | Sparse data | N/A | Outcome capture is per-article, not aggregated |
| 3 | Wrong-period data | N/A | Outcomes are immutable post-creation; period = brief_date implicitly |
| 4 | Concurrent writes (two tabs) | Race condition on `INSERT` | RPC upsert resolves via `(user_id, article_id)` UNIQUE; last write wins; both tabs reconcile on refresh |
| 5 | RLS denial | RPC raises 42501 → unhandled exception | Catch → toast "Couldn't save — try refresh"; never silent |
| 6 | Network down mid-write | Fetch rejects | UI reverts to pre-click state + retry button surfaced |
| 7 | AI output malformed | N/A — feature is non-AI |
| 8 | Re-clicked button (double-tap) | Two RPC calls | Idempotent via `(user_id, article_id)` UNIQUE + RPC `on conflict do update`; same outcome_id returned both times |
| 9 | Cron tick missed | N/A — feature is user-driven |
| 10 | Schema drift on `article_outcomes` columns | Stringly-typed RPC arg name drift | Engineer integration test calls RPC with happy-path args; `verify:columns` catches column drift |

**Catch-block policy:** The component handler is:
```ts
try {
  await supabase.rpc('upsert_article_outcome', args)
} catch (e) {
  console.error('[outcome-bar] rpc failed', { articleId, outcome, err: e })
  toast.error('Couldn\'t save — try again')
  revertOptimisticState()
}
```
No silent catches. Per VIBE Rule 52.

---

## 4. Senior Council Findings

See `council.md` in this folder for the per-role deep-dive. Summary:

| Role | Status | Open vetoes |
|---|---|---|
| Architect | ✅ Sign-off | None |
| Engineer | ✅ Sign-off | None |
| Product | ✅ Sign-off | None |
| Security & Privacy | ✅ Sign-off | None |
| Data Citizen | ✅ Sign-off (see §5) | None |

### Conflict Log

| # | Conflict | Roles | Resolution | Decided by |
|---|---|---|---|---|
| 1 | Rate input: ★ 1–5 vs thumbs up/down? | Product / Engineer | **★ 1–5** — matches `article_outcomes.rating` smallint column (range 1..5). Thumbs would force a column redesign that's out of Phase 2.2 scope. | Engineer (schema constraint) |
| 2 | Should optimistic UI persist across refresh? | Product / Architect | **No** — refresh always shows server state. Optimistic flip is in-session-only; source of truth is `article_outcomes` rows. Avoids stale-cache user-confusion class of bug. | Architect |
| 3 | Should we trigger a re-score after each save (so tomorrow's pick is "smarter")? | Product / Engineer | **No, defer to Phase 2.5** — Phase 2.2 is JUST the capture mechanism. Voice DNA / scoring-weight integration belongs to the alpha-data-accumulation phase. Premature integration adds load to every click and entangles Phase 2.2 acceptance with Phase 2.5 alpha learnings. | Architect (separation of concerns) |

---

## 5. Data Citizenship Audit

See `data-citizenship.md` in this folder for the standalone audit. Summary:

| Value displayed | Source | Derivation | Destinations | Provenance |
|---|---|---|---|---|
| Outcome state (saved / dismissed / no_action) per article | `article_outcomes.outcome` for `(user_id, article_id)` | Identity (display directly) | `/briefs/[id]` outcome bar · Phase 2.5 Voice DNA training · Phase 3 per-user scoring weights · `behavioral_events` mirror | `created_at` + `updated_at` on `article_outcomes`; `behavioral_events` row per tap |
| Rating (1–5 stars) | `article_outcomes.rating` smallint | Identity (render as N filled stars of 5) | Same as above | Same as above |

**Provenance affordance:** Hover/tap on the outcome bar reveals a `ⓘ` tooltip: *"Saved by you on <date> at <time> · last changed <relative-time>"*. Click on the article title opens `raw_articles.url` in a new tab — the article is its own source row.

**30-second audit-fitness test:**
- Backward ("where did this come from?"): hover bar → see the timestamp + your action. **PASS.**
- Forward ("where else does this end up?"): the Phase 2.2 surface only feeds itself. Phase 2.5+ adds Voice DNA and scoring-weight consumers; those will need their own Bridge Briefs whose Destinations columns drill BACK to this row. **PASS for Phase 2.2 scope; future-coupled.**

**No AI outputs in this feature.** The `sources[]` substring-validation contract does not apply.

---

## 6. Acceptance Criteria

- [x] All five Senior Council roles signed off (above) — **done in this brief**
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] `npm run verify:columns` — 0 drift on `article_outcomes`
- [ ] `verify:rls` — `article_outcomes` RLS-on with `article_outcomes_owner_all` policy (verified at migration apply 2026-05-15)
- [ ] Browser click-through: click Save on one article → refresh → bar still shows "Saved" → confirm `behavioral_events` row exists with event_type `article_save`
- [ ] DB SELECT round-trip:
  ```sql
  select outcome, rating, created_at, updated_at
  from public.article_outcomes
  where user_id = '<test user>' and article_id = '<test article>';
  ```
  Returns the row written by the click, with matching `outcome` and `updated_at` ≥ click time.
- [ ] No new migration in Phase 2.2 (all DDL shipped in `20260516000000_phase2_kickoff.sql`)
- [ ] Provenance affordance (`ⓘ` tooltip) renders on the outcome bar
- [ ] Bridge Brief signed off: founder reply **"build approved"** ____ (date)

**Founder sign-off:** _____________________ **Date:** ___________
