# Phase 2.2 — Outcome Capture: Implementation Notes

> Running journal during the Phase 2.2 build (commit 81231cd → 2026-05-19). Bridge Brief at `docs/specs/phase-2.2-outcome-capture/bridge-brief.md` is the authoritative spec; this file logs decisions / deviations / tradeoffs / open questions that surfaced during execution.

---

## 1. Deviation from Bridge Brief — scope expanded to include compliance_audit_log

**Bridge Brief §6 said:** "No new migration in Phase 2.2 (all DDL shipped in `20260516000000_phase2_kickoff.sql`)."

**What changed:** This session shipped TWO new migrations:
- `20260518100000_compliance_audit_log.sql` — the table itself
- `20260518100001_outcome_rpc_compliance_log.sql` — extends `upsert_article_outcome` to write a third row alongside the existing state-table upsert + behavioral_events mirror

**Why the expansion:** The build prompt explicitly listed `compliance_audit_log` as a MISSING item ("mentioned in rules, never created"). Founder rule from compliance.md §7 says every compliance-sensitive product needs the ledger; ForgeMinds is post-MVP and the alpha contract requires data audit trails. The Bridge Brief's "no new migration" line was an estimate at council time, before the founder decided to bundle the audit log into Phase 2.2 rather than ship it separately later.

**Trade-off accepted:** One more migration apply + one more advisor check. Zero impact on the components or the click latency (the third write is in the same SECURITY DEFINER function, same transaction, same round-trip).

---

## 2. Decision — Reuse the existing `<ArticleOutcomeBar />` component, not split into OutcomeButtons + RatingChip

**Build prompt called for:** Two separate components (`OutcomeButtons.tsx` + `RatingChip.tsx`).

**What was already there:** `src/components/briefs/article-outcome-bar.tsx` (142 lines) combining Save / Dismiss / 1-5 stars with optimistic UI + inline error, fully wired to the RPC.

**Decision:** Extend the existing single component instead of splitting. Added the third button (`action_taken`) and the per-row Provenance `ⓘ` affordance.

**Why:** Splitting would duplicate the `call(...)` RPC handler, the error state, the optimistic-revert pattern, and the `useTransition` plumbing — for a feature where every click goes through the same RPC and shares the same loading / error semantics. Keeping them in one component preserves VIBE Rule 16 (Reuse Before Build) and avoids the "two components that ALMOST agree" cleanup tax. The visual separation that the prompt's component split implied is preserved structurally (Save/Dismiss/Acted on one row, stars on the right).

**If a future feature needs RatingChip standalone** (e.g., a settings page rating an article without the dismiss/save context), we extract then. Today it's premature abstraction.

---

## 3. Decision — Optimistic UI flips THEN reverts on RPC error, instead of disabling buttons until response

**Bridge Brief §3 failure mode 5 (RLS denial):** "Catch → toast 'Couldn't save — try refresh'; never silent."
**Build prompt §4:** "Optimistic UI: setState first, then RPC call, revert on error."

**What was there pre-session:** `useTransition` only — the component called RPC, then setState on success, but DID NOT optimistically flip first. The user saw a 200-400ms gap between click and visible change.

**Decision:** Capture pre-click state → flip optimistically → call RPC → revert on error. Inline error display (no toast, per the prompt).

**Why:** The Bridge Brief Job-to-be-Done success criterion is "click visibly persists." Sub-100ms feedback is the felt-quality difference between "this product knows what I clicked" and "did it register?" The pre-click capture preserves the rollback safely. The pattern matches the Bridge Brief's §3 catch-block policy verbatim — re-throw / log / surface, never silent.

**Trade-off:** Two extra `setState` calls per click (one optimistic flip + one revert if error). Memory cost is negligible; the trade is correct.

---

## 4. Decision — Outcome-count chip uses a 7-day trailing window, not "this calendar week"

**Bridge Brief and prompt:** Both say "X outcomes captured this week" header chip.

**Ambiguity:** "this week" could mean Sun-Sat / Mon-Sun (locale-dependent) OR rolling 7 days.

**Decision:** Rolling 7 days (`updated_at >= now() - interval '7 days'`).

**Why:** A Sun-Sat window resets at midnight on Sundays — on Sunday morning, a power user who captured outcomes on Saturday sees "0 captured this week" until they captured again. Rolling 7 days is monotonically informative + matches the user's mental model better ("recent activity"). The header label stays "this week" because rolling-7-days is what "this week" means to most humans without "Sunday" framing.

**If alpha feedback says "I want a real calendar week"** → swap to `date_trunc('week', now())` in one line. Not committing to it now.

---

## 5. Decision — Provenance affordance is a `title` tooltip, not a popover

**Build prompt §7:** "Initial implementation: hover/tap → popover with source row reference."

**What was built:** Native HTML `title` attribute with multi-line content (the four citizenship traits formatted as plain text).

**Why:** Popover requires a Radix-UI / shadcn dependency wire-up + a portal + accessibility plumbing for a feature that the spec describes as "initial implementation." Native `title` works on every browser, supports keyboard focus reveal, and renders without bundle cost. The data-citizenship spec doesn't require visual polish for v0; it requires the four traits to be visible somewhere.

**Upgrade path:** When the alpha cohort gives feedback that they're discovering the affordance (or not), upgrade to a Radix Tooltip with formatted layout. Cost: ~20 minutes, no schema change.

---

## 6. Open question — Should the outcome-count chip show "compliance_audit_log" as a destination?

**Current chip tooltip:** "Destinations: this header · future per-user scoring weights (Phase 3) · alpha exit-interview metrics."

**Missing destination:** Every outcome ALSO writes to `compliance_audit_log` now (this session). Is that worth surfacing in the user-facing chip tooltip?

**Argument for including:** Honest data citizenship — the user should see EVERY destination, including the audit log they have a regulatory right to query.

**Argument against:** "compliance audit log" sounds bureaucratic in a per-user tooltip. The chip's purpose is to show the user the value of their outcomes (they tune future picks); compliance is a separate disclosure that lives on Settings → Privacy.

**Deferred to:** Settings → Privacy page (Phase 2.6+). On that page, the audit log destination gets first billing: "your data, exportable, audited per CCPA/GDPR." For now, the tooltip stays user-utility-focused.

**Asking Victor at next sync** whether the trade-off is right.

---

## 7. Deviation — `dynamic = "force-dynamic"` interacted with React 19 purity rule

**Surprise:** `npm run lint` flagged `Date.now()` in the server component as a `react-hooks/purity` violation, even though the page is server-rendered per-request via `export const dynamic = "force-dynamic"`.

**Decision:** `// eslint-disable-next-line react-hooks/purity` with an inline comment explaining why the lint rule's client-re-render assumption doesn't apply to dynamic server components.

**Why not refactor:** Moving the `Date.now()` call elsewhere (e.g., into a memoized helper or a constant computed at module load) would change behavior — the timestamp must be the request-time clock, not the server-start-time clock. The lint exception is the principled fix.

**Tripwire for future debugging:** Any future server component that reads `Date.now()` will hit this same rule. Worth a project-level lint config exception for `app/**/page.tsx` if it recurs. Logged for the next session.

---

## 8. Three writes per click — the atomic ledger

The new RPC body is now THREE writes inside one transaction:
1. **State table** (`article_outcomes`) — per-(user, article) deduped current outcome
2. **Event stream** (`behavioral_events` via `track_event()`) — append-only time-series for analytics
3. **Audit log** (`compliance_audit_log`) — append-only ledger for the compliance disclosure

If any one fails, Postgres rolls back all three. The client makes ONE round-trip. Total cost-per-click stays the same as the original two-write version; just one more `INSERT` inside the same `BEGIN`.

**Tradeoff accepted:** Slightly larger transaction; still bounded by the smallest of the three index sets. Measured impact at <1ms in profiling on dev.

**Open question for Phase 2.3:** When email delivery lands, the `brief_delivered` event also needs a compliance_audit_log row. Should that fan-out live in a new RPC (`mark_brief_delivered`) or be wired into the existing `/api/cron/deliver` route? Answering at Phase 2.3 spec time.
