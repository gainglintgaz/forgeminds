# Bridge Brief — Phase 2.3a: DSR Endpoints (Data Export + Account Deletion)

> **Status:** DRAFT — awaiting founder "build approved"
> **Spec author:** Claude Opus 4.8 (Senior Council session, 2026-05-30)
> **Companion rules:** `compliance.md` §8 (DSR), `privacy.md` (account deletion), `data-protection.md` §6 (deletion gates), lessons-critical.md #81 (verify_jwt on destructive routes)
> **Blocks:** Phase 2.4 (alpha recruiting) — cannot legally onboard a stranger without working delete/export.

---

## §1 — Job-to-be-Done

**User story:** As an alpha user who agreed to test ForgeMinds, I want to (a) download
everything the system knows about me as a file, and (b) permanently delete my account
and all my data — both without emailing anyone — so that I trust the product with my
attention data and can leave clean if I want out.

**Verbatim contributor pact (`data-flywheel.md §11`):** *"Your public contributions stay
yours. You pick anonymous, named, or private. You can delete any of them anytime."*

**Success =** a stranger can export their full data as valid JSON in one click, and can
delete their account (typed "DELETE" confirmation) with every row gone, verified by a
post-delete SELECT returning zero rows across all 10 user-scoped tables.

---

## §2 — Data Contract

### User-scoped tables: **49 live** (enumerated 2026-05-30 via `information_schema`)

The live schema has **49 tables with a `user_id` / `owner_id` / `invited_by` / `saved_by_user_id`
/ `reviewed_by` FK to `auth.users`** — far more than an early draft assumed. This is the single
most important finding for this brief: **the delete list MUST be derived at runtime, never
hardcoded.** A hardcoded list of 10–11 tables would silently orphan ~38 tables of user data on
every account deletion — a GDPR Art. 17 violation and a trust bomb.

Full live list (2026-05-30): `action_plans, action_template_runs, article_outcomes,
behavioral_events, brain_memberships, briefs, build_kickoff_packages, community_brain_queries,
community_data_settings, compliance_audit_log, connected_accounts, content_drafts, delivery_log,
dot_connections, embeddings, engagement_decay, external_subscriptions, improvement_proposals,
interactions, notification_preferences, notifications, pipeline_runs, profiles, prompt_outcomes,
published_items, raw_articles, saved_items, scored_articles, scoring_feedback, serendipity_log,
session_summaries, shared_brains, source_suggestions, sources, ticker_data, topic_evolution,
trust_levels, user_analytics, user_context_matrix, user_filter_preferences, user_geographies,
user_goals, user_preferences, user_profile_cluster, user_profiles_extended, voice_profiles,
voice_training_samples` (+ join tables that cascade via FK, e.g. `brief_articles`).

**Delete strategy (mandatory):**
1. The `delete_account()` RPC queries `information_schema` / `pg_constraint` at runtime to build
   the live set of user-scoped tables, then DELETEs in FK-dependency order (children → parents)
   inside one transaction. **No hardcoded table list in code.**
2. The simplest correct mechanism: rely on `ON DELETE CASCADE` from `auth.users` where it exists,
   and the RPC explicitly handles any table whose FK is *not* cascade. STEP 1 of the build is an
   audit: which of the 49 have `ON DELETE CASCADE` vs need explicit DELETE? `auth.admin.deleteUser()`
   then cascades the rest. This audit is a build-time deliverable, not an assumption.
3. A `verify:dsr-coverage` check (new) asserts every `user_id`-bearing table is either
   cascade-covered or explicitly handled — fails loudly if a future migration adds table #50.

**Export scope:** all 49 tables filtered to `auth.uid()`. At alpha scale (one user's rows) this
is trivial volume; revisit streaming at 1k users.

### Export reads
All 11 tables filtered to `auth.uid()`. Plus `auth.users` row (email, created_at — the
user's own identity only).

### Writes
- **Export:** one `compliance_audit_log` row (`event_type = 'data_export'`), one
  `consent_log`-adjacent entry if applicable. No mutation of user data.
- **Delete:** DELETE across all tables in FK order, then `auth.admin.deleteUser()`.

---

## §3 — Failure Modes

| # | Failure | Handling |
|---|---|---|
| 1 | Unauthenticated request | 401. `verify_jwt: true` equivalent — read `auth.uid()` from session, reject null. **(lessons-critical #81 — the FinKeel open-door bug)** |
| 2 | User deletes someone else's data | Impossible — all queries scoped to `auth.uid()` server-side; no `user_id` accepted from client body |
| 3 | Partial delete (crash mid-wipe) | Wrap all DELETEs + auth delete in a single RPC transaction (`security definer`). All-or-nothing. |
| 4 | Double-submit delete | Idempotent — second call finds zero rows, still returns 200 |
| 5 | Rate-limit abuse | 1 export / 24h, 1 delete attempt / 24h per user (`compliance.md §8`) |
| 6 | Export too large (memory) | Stream JSON; cap at alpha scale (single user's rows — trivial). Revisit at 1k users. |
| 7 | Compliance/consent log retention vs deletion | **TENSION (see below)** |
| 8 | Delete leaves storage orphans | No Storage buckets in use yet — N/A for alpha. Note for when Storage ships. |

**§3.7 Retention tension (Senior Council must resolve):** `compliance.md §7` says the audit
log is *append-only, retained*. `compliance.md §8` + GDPR Art. 17 say deletion *cascades
through compliance_audit_log subject to retention requirements*. The shipped
`compliance_audit_log` has `ON DELETE CASCADE` from `auth.users` — so deleting the auth user
**wipes the audit trail too**. For an invite-only free dev alpha this is acceptable (no
regulatory retention obligation yet). **Decision needed from Victor:** (A) cascade-delete the
audit log with the user (simplest, current behavior), or (B) anonymize-in-place (null the
user_id, keep the event rows) for future-proofing. Recommend **(A) for alpha**, revisit at
paid launch. Logged as the one open Council item.

---

## §4 — Senior Council Findings (5 roles)

### 4.1 Architect
- **Pattern:** Next.js App Router route handlers (`app/api/account/export/route.ts`,
  `app/api/account/delete/route.ts`) — mirrors existing `/api/cron/*` server-route pattern.
  NOT Edge Functions (consistent with stack-on-Vercel).
- **Delete mechanism:** a single `delete_account()` Postgres RPC (`security definer`) that
  wipes all tables in FK order in one transaction, called from the route; the route then
  calls `supabase.auth.admin.deleteUser()` with the service-role key. Two-step but the data
  wipe is atomic.
- **Reuse:** `compliance_audit_log` already exists (2.2). `consent_log` already exists.
  No new tables. ✅

### 4.2 Engineer
- Export: `Promise.all` of 11 scoped SELECTs → assemble JSON object → `Response` with
  `Content-Disposition: attachment`. Single round trip per table, no N+1.
- Delete RPC: explicit `DELETE FROM <t> WHERE user_id = v_uid` for each leaf→parent, inside
  `begin/exception` — on any error, raise (transaction rolls back). **No silent catch**
  (VIBE 52).
- Both routes: `export const dynamic = 'force-dynamic'` + `runtime = 'nodejs'`.
- Rate limit: check last `compliance_audit_log` row of matching event_type < 24h → 429. ✅

### 4.3 Product
- Export: a "Download my data" button in Settings → triggers GET → browser downloads
  `forgeminds-export-<date>.json`. One click. No modal.
- Delete: Settings → Danger Zone → "Delete account" → modal requires typing **DELETE** →
  confirm → sign out + redirect to a goodbye page. (per `privacy.md` Account Deletion)
- Empty/error states: 429 shows "You already did this today — try again tomorrow." ✅

### 4.4 Security & Privacy
- **HARD GATE (lessons-critical #81):** both routes reject unauthenticated requests. The
  delete route is the single most destructive surface in the app — `auth.uid()` is read
  server-side from the session cookie, NEVER from a request body. No `user_id` param exists.
- Service-role key used ONLY inside the route handler (server), never shipped to client.
- Export excludes all other users' data by construction (scoped queries).
- PII: the export contains the user's OWN PII (their email, their data) — that's the point
  and it's going only to them over an authenticated channel. No third party. ✅
- **VETO condition:** if any reviewer proposes accepting `user_id` from the client → blocked.

### 4.5 Data Citizen
- Export IS the ultimate traceability artifact — the user sees every row.
- Delete logs its own provenance: a `compliance_audit_log` `account_deleted` row written
  *before* the cascade (so the deletion event itself is recorded in the same transaction
  that then cascades it away under option A — or survives under option B).
- Audit-fitness: "where did my data go?" → the goodbye page states "all 11 tables wiped,
  here's the list." ✅

**Open Council item:** §3.7 retention decision (A cascade vs B anonymize). Defaulting to A
for alpha pending founder call.

---

## §5 — Data Citizenship Audit

Every value the export emits is a verbatim DB row — source IS the row, derivation is
identity, destination is the user's download, provenance is each row's own `created_at`.
The delete endpoint's provenance is the `account_deleted` audit row. Both directions
trivially satisfied (the export literally is the source rows).

---

## §6 — Acceptance Criteria

1. All five Senior Council roles signed off (§3.7 resolved by Victor)
2. `npx tsc --noEmit` — 0 errors
3. `npm run lint` — 0 errors
4. `npm run verify:columns` — 0 drift; delete RPC table list matches live `information_schema`
5. `verify:rls` — no new tables; routes enforce `auth.uid()` server-side
6. **Browser: export** → downloads valid JSON containing the user's rows from all 11 tables
7. **Browser: delete** → type DELETE → confirm → post-delete SELECT returns 0 rows across
   all 11 tables for that user_id AND `auth.users` row gone
8. Unauthenticated curl to both routes → 401 (the lessons-critical #81 regression test)
9. Rate-limit: second export within 24h → 429
10. `delete_account()` RPC is atomic (simulated mid-transaction failure rolls back fully)
11. New migration → `get_advisors` run after apply, 0 new findings; commit body notes it

---

## §7 — Rollback

- Export route: pure read, revert the commit, no data impact.
- Delete route: the RPC is additive. Reverting the code disables the feature; no data to
  unwind (it only ever deletes on explicit user action). The migration adds one function —
  `drop function delete_account()` to fully revert.

---

## §8 — Build sequence (one commit each, push after each)

1. Migration: `delete_account()` RPC + (if option B) audit-anonymize logic → apply to dev → `get_advisors`
2. `app/api/account/export/route.ts` + rate-limit helper
3. `app/api/account/delete/route.ts`
4. Settings UI: Download-data button + Danger-Zone delete modal
5. Verification: criteria #6–#10, AUDIT GATE block

---

*Bridge Brief is the contract. Code follows the spec. No code until "build approved." — VictorForge Discovery Protocol*
