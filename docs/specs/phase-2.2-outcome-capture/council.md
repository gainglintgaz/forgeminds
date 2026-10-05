# Senior Council — Phase 2.2 Outcome Capture

> Per `.claude/rules/senior-council.md`. Each role wrote its deliverable independently first, then conflicts were surfaced and resolved (logged in `bridge-brief.md` §4).

---

## Architect

**Data flow:**
The brief detail page (`/briefs/[id]`) is already a server component that reads `briefs` + `raw_articles` per the existing Phase 2.1 wiring. Phase 2.2 adds ONE additional read (`article_outcomes` for the current user × current brief's article_ids) and ONE write path (`supabase.rpc('upsert_article_outcome', ...)` from a client-side component nested inside the server-rendered card).

```
[/briefs/:id server render]
  ├── briefs (RLS-scoped)
  ├── raw_articles  (IN article_ids)
  └── article_outcomes  (user_id = auth.uid, article_id IN article_ids)   ◄── NEW

[client: <ArticleOutcomeBar />]
  └── rpc('upsert_article_outcome', { p_article_id, p_brief_id, p_outcome, p_rating })
        └── INSERT/UPDATE article_outcomes
        └── INSERT behavioral_events   (mirrored atomically)
```

**Reuse-vs-build:** REUSE. Component shell, RPC, indexes, RLS — all shipped. Phase 2.2 wires what exists; no new files except (a) the component logic and (b) a `useTransition` hook for optimistic UI.

**Pattern conflict check (VIBE Rule 59):** Three potentially-overlapping patterns in this codebase: (a) direct supabase-js writes from client, (b) Server Actions, (c) RPCs. Outcome capture uses RPC because the upsert + behavioral_events mirror must be atomic; Server Actions can't enforce atomicity across two tables without explicit transactions, and a client-side supabase-js write would split the two writes. RPC is the winning pattern here; Server Actions and direct writes remain valid for non-atomic single-table updates elsewhere.

**Failure-domain mapping:** If Supabase REST is down, the bar shows error toast + stays in pre-click state. If `behavioral_events` insert fails INSIDE the RPC (rare; both writes are in the same SECURITY DEFINER function), the outcome write is rolled back too — Postgres handles this naturally. If the RPC times out, the client catches and reverts.

**Sign-off:** ✅ No vetoes.

---

## Engineer

**Schema-first check:** `article_outcomes` table + RPC + RLS + indexes shipped in `20260516000000_phase2_kickoff.sql`. Re-audited 2026-05-17:

```sql
-- Confirmed live in dev project ymgbjtgczgnooscigplb:
\d public.article_outcomes
-- Columns: outcome_id, user_id, article_id, brief_id, outcome (enum),
--          rating (smallint 1..5), worth_it (bool), would_repeat (bool),
--          time_spent_seconds, triggered_action, notes, context (jsonb),
--          prompt_version, created_at, updated_at
-- Indexes: article_outcomes_pkey, article_outcomes_user_article_uq,
--          article_outcomes_user_idx, article_outcomes_article_idx,
--          article_outcomes_brief_idx, article_outcomes_saved_idx
-- RLS: enabled, policy "article_outcomes_owner_all" (auth.uid = user_id)
```

**No new schema needed for Phase 2.2.**

**N+1 audit:** The page reads outcomes with `.in('article_id', articleIds)` — single batch query. The click path is one RPC per click; no loop. **Clean.**

**Catch-block policy:** Component handler wraps the `await supabase.rpc(...)` in try/catch with explicit log + toast + revert. No silent catches.

**Test coverage:**
1. Happy path: integration test signs in as a seeded test user, calls `upsert_article_outcome` with `outcome: 'saved'`, asserts row exists with correct `outcome` AND a matching `behavioral_events` row.
2. Failure mode: same test with the supabase client temporarily revoking the user's session — RPC should raise; component should toast and revert.

**`verify:columns`:** `article_outcomes` shipped in the migration; verify:columns confirmed clean post-migration (commit 16e73d3). Re-run after Phase 2.2 code lands.

**Sign-off:** ✅ No vetoes.

---

## Product

**Job-to-be-Done in user's words:** *"I want to tell ForgeMinds which of today's stories were worth my time, so tomorrow's brief is sharper without me writing a survey."*

This is verbatim from the Phase 2 GOAL.md alpha-thesis user voice. The user is NOT trying to "rate articles" abstractly — they're trying to tune a system that learns from them. The capture UI must surface that promise.

**Five states designed:** See Bridge Brief §1 table. Five states are HIDDEN / LOCKED (N/A) / PREVIEW (N/A) / AVAILABLE / RECOMMENDED. The two non-applicable states are documented as "intentionally N/A — capture is binary and available from brief #1." This is honest per `ai-first-principles.md` — features at AVAILABLE state from the first interaction (no loop required) should declare it explicitly.

**Reviewer test (template check):** *"If I swapped 'ForgeMinds' for 'Brief.com' or any other curation product, would this copy still work?"* The first-brief hint copy is: *"Tell me how this landed — your saves and dismisses tune tomorrow's picks."* The "tune tomorrow's picks" half is structurally tied to the per-user flywheel — Brief.com's curation isn't personalized, so this copy would feel either misleading or aspirational on their product. **PASS — story-driven, not template.**

**Success criterion check:** "The user CLICKS one of {save, dismiss, rate}" — this is a verb the user actively performs. "User SEES the outcome bar" was the original draft; that's passive (anyone seeing the brief page passively sees the bar). The active version is the right success criterion. **PASS.**

**Sign-off:** ✅ No vetoes.

---

## Security & Privacy

**Auth requirement:** The RPC `upsert_article_outcome` calls `auth.uid()` at entry and raises if null. This is verified live (`select has_function_privilege('authenticated', ...)` returns true; `anon` returns false). The server component read of `article_outcomes` is RLS-scoped — even if a bug constructed a wrong `user_id`, RLS would block the read.

**RLS check:** `article_outcomes_owner_all` policy active: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`. Tested by signing in as user A and attempting to read user B's outcomes — returns 0 rows. **PASS.**

**PII to AI APIs:** Phase 2.2 is non-AI. No PII path. **PASS.**

**`VITE_` prefix on secrets:** None added. **PASS.**

**Token registry:** No new tokens. **PASS.**

**Special note on `behavioral_events`:** The mirror table also has RLS (owner-only). Its `track_event` RPC is SECURITY DEFINER (already advisor-warned but accepted — see `senior-council.md` §2.4 on accepted patterns). Re-verified: no new advisor findings from Phase 2.2's planned wiring.

**Sign-off:** ✅ No vetoes.

---

## Data Citizen

See `data-citizenship.md` in this folder for the standalone audit. Summary of the four traits for Phase 2.2:

- **Source:** User input (a click). `article_outcomes.user_id + article_id` is the source row.
- **Derivation:** Identity transform for outcome state; star count for rating.
- **Destinations:** Phase 2.2 surface (the bar itself); Phase 2.5 Voice DNA training; Phase 3 per-user scoring weights; `behavioral_events` mirror.
- **Provenance:** `created_at` + `updated_at` on every outcome row; `behavioral_events` row per tap with `event_type` + `metadata.outcome_id`.

**Provenance affordance:** The `ⓘ` tooltip on the outcome bar reveals when the user last changed the state. The article title is a link to `raw_articles.url` — the article is its own source row.

**30-second audit-fitness test:**
- Backward: hover the bar → see "Saved by you on May 20 at 9:14 AM." **PASS.**
- Forward: in Phase 2.2 scope, there's nothing downstream to drill into yet (Phase 2.5+ adds Voice DNA / scoring-weights consumers). Document this as "forward destinations will be linked back when Phase 2.5 ships." **PASS for Phase 2.2 scope, conditionally future-coupled.**

**Sign-off:** ✅ No vetoes. Conditional follow-up: when Phase 2.5 ships its Voice DNA consumer, that Bridge Brief must drill its Source column back to `article_outcomes` rows.

---

## Conflicts surfaced and resolved

See `bridge-brief.md` §4 Conflict Log. Three conflicts surfaced, all resolved without escalating to a veto:

1. ★ 1–5 vs thumbs (Product/Engineer) → ★ wins on schema constraint
2. Optimistic UI persistence across refresh (Product/Architect) → No, server state wins
3. Re-score trigger on every save (Product/Engineer) → Defer to Phase 2.5

No open vetoes. Council recommends proceeding to founder sign-off.
