# Email Delivery — Architecture & Phased Plan (E0 / E1 / E2)

> Status: **DESIGNED + ADVERSARIALLY REVIEWED** (desktop session, 2026-06-11; 3-lens review: hostile-architect / code-accuracy / factory-compliance — all PASS_WITH_FIXES, fixes integrated below)
> Owner: Victor · Implementer: PS Claude (repo write-lock holder) · Verifier: desktop session (DB/MCP)
> Companion handoff: `docs/ops/PS_PROMPT_email-fix.md` (the executable steps for Phase E0+E1)

## 0. Founder constraints (verbatim, binding)

1. *"Finkeel is its own, separate project / app? ForgeMinds also is going to be its own, separate app? … that's not right."* → **No cross-project mixing.** ForgeMinds never sends from `finkeel.app`, and the FinKeel-shared Resend account is a temporary tolerated state, not the end state.
2. *"I'm not buying domain yet … hope it is fine."* → It is fine. **Phase E1 requires zero domain purchase.** The domain is a launch-time cost (~$10–15/yr), not a test-time cost.

## 1. Verified current state (evidence-backed, 2026-06-11)

| # | Finding | Evidence |
|---|---|---|
| 1 | Deliver step fails for both pending briefs: `{"briefsPending":2,"sent":0,"failed":2}` | `net._http_response` ids 4451, 4453, 4454 (manual re-fire) |
| 2 | `delivery_log` is **completely empty** — zero rows ever | `SELECT … FROM delivery_log` → `[]` |
| 3 | Brief `2aefc610…` has `is_delivered=false`, `delivered_at=null` | `briefs` SELECT |
| 4 | Recipient resolves to `vctrbbnv@pm.me` (auth.users email of user `3707759d…`) | `auth.users` SELECT + route code path |
| 5 | Cron dispatchers (jobs 7–12, incl. deliver) are ACTIVE, `* * * * *` — loop self-runs unattended | `cron.job` SELECT |
| 6 | Resend account = **vctrbbnv@gmail.com**, free tier, **testing mode** (no ForgeMinds domain verified; the single free-tier domain slot is `finkeel.app`, verified, belongs to FinKeel) | Resend dashboard screenshots (Victor, 2026-06-10) |
| 7 | `@react-email/render` is **NOT installed at top level** — it exists only nested at `node_modules/@react-email/components/node_modules/@react-email/render` (v1.0.4), unresolvable from the `resend` package | `Glob node_modules/@react-email/render/package.json` → none; nested path exists |
| 8 | Resend SDK v6 renders `react:` payloads via the shared render helper that dynamic-imports `@react-email/render` and **throws** `"Failed to render React component"` when unresolvable | `node_modules/resend/dist/index.mjs:210-217` (shared helper; invoked from Emails ≈:780) |
| 9 | The deliver route's per-brief `catch` only does `console.error` + `failedCount++` — **no `delivery_log` write** | `src/app/api/cron/deliver/route.ts:228-231` |
| 10 | All Worker env vars are **secrets** (`wrangler secret put`) — `wrangler.jsonc` has no `vars` block | `wrangler.jsonc` + `docs/ops/PS_PROMPT_deploy.md` step 4 |
| 11 | All `delivery_log` insert columns verified against live `information_schema.columns` (user_id, brief_id, delivery_type, recipient, status, provider, provider_message_id, error_message all exist; enums `email_digest`/`sent`/`failed` valid) — **VIBE 35 gate 5 closed for this change** | desktop session SELECTs, 2026-06-11 |
| 12 | Partial unique index `delivery_log_sent_once on (brief_id, delivery_type) where status='sent'` **applied to live DB** (advisors after: no new findings) | migration `add_delivery_log_sent_once_unique`, 2026-06-11 |

## 2. Root cause — three stacked defects

**D1 — Render dependency unresolvable (the active thrower).**
`resend.emails.send({ react: … })` → SDK dynamic-imports `@react-email/render` → not resolvable from `resend`'s position in `node_modules` (and not bundleable by the OpenNext webpack build for the same reason) → **throws before any network call**. The emails have never reached Resend. This is why the `RESEND_FROM_EMAIL` change (`briefs@forgeminds.app` → `onboarding@resend.dev`) changed nothing: the failure happens upstream of the from-address entirely.

**D2 — Resend testing-mode recipient constraint (lurking behind D1).**
With no verified ForgeMinds domain, Resend only delivers to the account owner's address (`vctrbbnv@gmail.com`). The pipeline's recipient is `vctrbbnv@pm.me`. Once D1 is fixed, sends will reach Resend and be rejected (structured 4xx) until either the recipient is overridden (E1) or a ForgeMinds domain is verified (E2).

**D3 — Silent failure path (VIBE Rule 52 violation).**
The `catch` path writes nothing to `delivery_log`, which is why this took DB forensics + SDK source reading to diagnose instead of one SELECT. Fixed permanently in E0.

**D4 — No double-send protection (found by hostile review, fixed in E1).**
`briefs.update({is_delivered:true})` was never error-checked: one transient failure there and the every-minute cron resends the same brief up to 1,440×/day (burning the 100/day Resend free tier in ~100 min). A tick-overlap race (send latency near the 60s `maxDuration`) could also double-send. Nothing in code or schema prevented it.

**Standing violation (structural):** ForgeMinds currently authenticates with the same Resend account/API key as FinKeel — against `secrets-handling.md` §7.1 (one credential per project). Tolerated only while in test mode with Victor as the sole recipient; **eliminated structurally in E2** (Cloudflare Email binding has no API key at all).

## 3. The phases

### Phase E0 — Make failure visible (permanent fix, ships with E1)
- Per-brief `catch` writes a `status='failed'` row to `delivery_log` with `error_message` (mirroring the structured-error path at route.ts:195-203).
- The **success-path** `delivery_log` insert is also error-checked (same silent-failure class; reviewer finding).
- Console lines log `brief.id` + `user_id` prefix, **never the raw email address** (observability.md §2 — no PII in worker logs; the address lives only in the RLS-protected `delivery_log.recipient` column).
- Plain-language: *if an email ever fails again, one SQL query shows exactly why — no more invisible failures.*

### Phase E1 — Prove the loop today ($0, no domain, no mixing)
1. `npm install @react-email/render@1.0.4` (**pinned** — matches the version `@react-email/components@0.0.32` was built against; unpinned latest 1.x has rendering-internals drift that tsc/lint cannot catch). Switch the route to **explicit, static-import rendering**: `html = await render(reactEl)` passed as `html:` instead of `react:`. Static imports fail at **build time** if unresolvable — this class of bug becomes impossible to ship again. (Chosen over "install-only, keep `react:`" per VIBE 59: the SDK's internal dynamic import stays bundler-fragile; our own static import is deterministic. Install-only remains the documented fallback — webpack does statically resolve the SDK's literal `import("@react-email/render")` once a top-level install exists.)
2. **Idempotent sends (D4):** every send passes `{ idempotencyKey: \`brief/${brief.id}\` }` (verified supported, SDK v6 `dist/index.mjs:1128`); the `briefs.update` result is error-checked (failure → counted failed, retried next tick — the idempotency key makes the retry a provider-side no-op for 24h); the live partial unique index (§1 row 12) makes a duplicate `sent` row impossible, with 23505 treated as already-sent (VIBE 37). Three independent layers.
3. Keep sender `onboarding@resend.dev` (Resend's own test sender — belongs to neither project).
4. **Dev-only recipient override, scoped to the test user** (reviewer finding — a global override would redirect every user's brief content to Victor's gmail, a cross-user leak class the moment testing mode ends): only `brief.user_id === '3707759d-9863-4f69-a6d8-f40036fa15f1'` gets `RESEND_TEST_RECIPIENT` (Worker secret, `vctrbbnv@gmail.com`); any other user while the secret is set is **skipped with a loud error log**, never silently redirected. The (currently unreachable) SYSTEM_USER_ID branch honors the same override so no branch can mail Resend's own test sender. `delivery_log.recipient` records the **actual** address used (honest provenance).
5. **briefUrl integrity:** the route's fallback `https://forgeminds.app` is a domain Victor does **not own** — test emails must not carry dead/squattable links. E1 changes the fallback to the live Worker URL (`https://forgeminds.vctrbbnv.workers.dev`) with an `// until E2 buys the domain` marker, and the founder confirms at deploy time what `NEXT_PUBLIC_APP_URL` was baked in as (build-time inlined from `.env.local`, NOT a runtime secret).
6. Deploy; desktop session re-fires deliver; both pending briefs send (expect **2 emails** in gmail); cron keeps the loop autonomous thereafter.
- Plain-language: *today's outcome is a real ForgeMinds brief in a real inbox, proving ingest→score→curate→enrich→generate→deliver end-to-end, without buying anything or touching FinKeel — and the same brief can never be sent twice.*

### Phase E2 — Launch end-state: Cloudflare Email Service (when Victor decides ForgeMinds is ready)
1. Buy `forgeminds.app` (or chosen domain) via **Cloudflare Registrar** (at-cost; lands on Cloudflare DNS automatically — the exact prerequisite Email Service needs).
2. Onboard the domain to **Email Sending** (dashboard one-click adds SPF/DKIM/DMARC/bounce records — Cloudflare controls the DNS, so verification is minutes).
3. Add `send_email` binding to `wrangler.jsonc`; deliver route switches `resend.emails.send(...)` → `env.EMAIL.send(...)` via the OpenNext Cloudflare context. Same explicit-render output feeds `html:`/`text:` unchanged.
4. Remove: `resend` dependency; `RESEND_API_KEY` + `RESEND_FROM_EMAIL` + `RESEND_TEST_RECIPIENT` secrets; the dev-only override code; **the route's RESEND startup guard (route.ts:89-96, which hard-500s when RESEND_* are missing)**; and the dead SYSTEM_USER_ID fallback branch (unreachable — `briefs.user_id` is NOT NULL FK to auth.users, repoint or delete). Set `NEXT_PUBLIC_APP_URL` + the briefUrl fallback to the real domain. `delivery_log.provider` becomes `'cloudflare'`.
5. **Quota warm-up:** Cloudflare Email starts new accounts on a conservative daily quota that grows with reputation. Onboard the domain and start sending Victor's own daily briefs through it **1–2 weeks before** any external user.
- Why Cloudflare over Resend at launch: native to the Worker already running the app; **no API key exists** (binding-scoped → `secrets-handling.md` §7.1 satisfied by construction); one fewer vendor; domain verification is one click because DNS is already there. Decision recorded here per stack-optimizer; Resend stays the right tool only for the zero-domain test window.

## 4. Data flow & traceability (two-way, per `two-way-traceability.md`)

```
briefs (summary_html, is_delivered=false)
  → deliver route (cron, per-user dispatch)
    → render(DailyBriefEmail) → provider send (idempotencyKey = brief/<id>)
      → delivery_log row  [forward provenance: user_id, brief_id, recipient,
                           status, provider, provider_message_id | error_message, sent_at]
        [unique: one 'sent' row per (brief_id, delivery_type) — DB-enforced]
      → briefs.is_delivered=true, delivered_at, delivery_method='email'  [error-checked]
      → pipeline_runs row (step_name='deliver', items_created/failed)
```
- **Forward:** any email → `delivery_log` row → `brief_id` → brief → `article_ids` → raw articles.
- **Reverse:** any brief → its `delivery_log` rows answer "was this delivered, where, when, via what" in one SELECT.
- **Semantics (honest):** `status='sent'` means **provider-accepted**, not inbox-delivered. `delivered_at`/`opened_at` stay NULL in E1 **and** E2 — no bounce/open webhooks are wired in either phase (tracked obligation, §9). A post-acceptance hard bounce will still read `sent`.
- **Gap (backlog, not blocking):** no UI surface yet shows delivery status to the user; `delivery_log` is queryable but unrendered (PENDING_APPROVALS, E2 scope candidate).

## 5. Failure modes (hostile pass — updated post-review)

| Failure | Handling |
|---|---|
| Both pending briefs send at once after fix | Expected — 2 emails arrive. `is_delivered` flips per-brief. |
| `briefs.update(is_delivered)` fails after a successful send (**D4**) | Error-checked → counted failed + retried next tick; retry is a provider no-op (idempotency key, 24h) and a DB no-op (unique index + 23505-as-already-sent). No duplicate email, no quota burn. |
| Tick overlap (send latency ≈ 60s `maxDuration`) double-fires a brief | Same idempotency key → provider dedups; unique index blocks a second `sent` row. |
| Cron fires every minute against Resend free tier (100/day) | Only undelivered briefs send; post-backlog volume ≈ 1/day. D4 protections cap the pathological case. |
| Explicit render fails on workerd (react-dom/server edge quirk) | Build-time failure surfaces in `npm run deploy`; fallback documented (install-only variant). `npx wrangler tail forgeminds` confirms at runtime. |
| Resend still rejects (unexpected 4xx) | Now **visible**: structured-error path writes `delivery_log.error_message`; one SELECT to read. |
| Recipient unresolvable (opt-out `delivery_email=false`, or missing auth email) | **Known gap:** route skips with console.warn only — no `delivery_log` row, and the brief is re-fetched every tick forever, occupying a `deliver_batch_size` slot. Harmless for the single test user today; logged as an E2 checklist item (write a terminal `failed` row or excise from the pending set). |
| briefUrl points at unowned `forgeminds.app` | E1 step 5: fallback changed to live workers.dev URL; founder confirms the baked-in `NEXT_PUBLIC_APP_URL`. |
| Test override leaks to launch | Structurally scoped to the single test user id (other users skip fail-closed); removal tracked in PENDING_APPROVALS; tripwire = `grep -r "RESEND_TEST_RECIPIENT" src/` returns 0 **AND** `npx wrangler secret list` shows no `RESEND_TEST_RECIPIENT`. |
| CF Email quota too low on launch day | E2 step 5 warm-up window (1–2 weeks of self-sends). |
| `delivery_log` insert fails (either path) | Error captured + `console.error` (brief id, not email address); failure still counted. |

## 6. Acceptance criteria

**E0+E1 (this week):**
- [ ] `net._http_response` for a deliver tick shows `sent:2 / failed:0` (or sent:1 ×2 consecutive ticks)
- [ ] `delivery_log` has `status='sent'` rows with non-null `provider_message_id` for both briefs — and **never more than one** `sent` row per brief
- [ ] `briefs.is_delivered=true` + `delivered_at` set for `2aefc610…` and the second pending brief
- [ ] Victor confirms both emails physically in the **gmail** inbox, rendering correctly, **links resolving to the live workers.dev app** (no `forgeminds.app` links)
- [ ] Next *organically generated* brief auto-delivers within one cron cadence, zero manual firing — proves unattended loop
- [ ] Console/tail output contains no raw email addresses

**E2 (launch checklist — full list in PENDING_APPROVALS "Email E2 launch checklist"):**
- [ ] ForgeMinds domain onboarded to CF Email Sending; binding live; `provider='cloudflare'` rows in `delivery_log`
- [ ] `resend` dependency + all three RESEND_* secrets removed; RESEND startup guard + dead SYSTEM branch removed; tripwire greps clean (code **and** secret list)
- [ ] Brief delivers to `vctrbbnv@pm.me` (real user email, no override)

## 7. Rollback

- **E1:** single revert commit restores prior route; delete `RESEND_TEST_RECIPIENT` secret. E0 logging and the unique index are kept even in rollback — both are pure-upside. The loop returns to failing-but-visibly.
- **E2:** redeploy previous Worker version; Resend path code remains in git history if a full provider revert is ever needed.

## 8. Non-goals

- Buying any domain now (deliberate founder decision — deferred to launch).
- Anything touching `finkeel.app` or FinKeel's Resend slot (founder veto, §0).
- Resend paid upgrade or a second Resend account (E2 makes Resend itself unnecessary).
- **Bounce/open/complaint tracking in E1 or E2** — `delivered_at`/`opened_at` remain NULL; `sent` = provider-accepted only. Webhook phase is a tracked future obligation, not silently absent.
- Marketing/bulk email (CF Email Service is transactional-only).
- In-app delivery-status UI (backlogged, §4 gap).

## 9. Wiring obligations (per `wired-not-orphaned.md` §3)

| Obligation | Tracked in | Done when |
|---|---|---|
| Remove `RESEND_TEST_RECIPIENT` override (code + secret — both greps in §5) | PENDING_APPROVALS → "Email E2 launch checklist" | E2 ships |
| E2 migration (domain + CF Email binding + Resend removal incl. startup guard + dead branch) | PENDING_APPROVALS → same entry | E2 ships |
| Resolve shared-Resend-key violation (secrets-handling §7.1) | PENDING_APPROVALS → same entry (SEC note) | E2 ships (key deleted) |
| Recipient-unresolvable skip path: terminal `failed` row or pending-set excision | PENDING_APPROVALS → same entry | E2 ships |
| Provider webhooks (bounce/open) → populate `delivered_at`/`opened_at` or drop the columns | PENDING_APPROVALS → backlog note | scoped at E2 |
| Delivery-status UI surface | PENDING_APPROVALS → backlog note | scoped at E2 |
