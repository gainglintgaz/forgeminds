# PENDING_APPROVALS

---

## Email E2 launch checklist (2026-06-11, project: forgeminds) — WIRING OBLIGATION

> Source: `docs/architecture/email-delivery.md` §3/§9 (the binding design doc).
> Status: **OPEN — blocked on founder buying a ForgeMinds domain (deliberate deferral, not forgotten).**
> Owner: Victor (domain purchase) + PS Claude (code) + desktop session (verification).
> Trigger: the moment Victor decides ForgeMinds is launch-ready and buys the domain.

Phase E1 (live test mode) ships with a **DEV-ONLY scaffold** that MUST be removed at launch:

- [ ] Buy ForgeMinds domain via **Cloudflare Registrar** (at-cost; lands on CF DNS automatically)
- [ ] Onboard domain to Cloudflare **Email Sending** (dashboard one-click DNS records) — do this **1–2 weeks BEFORE first external user** (new-account daily quota warms up with reputation)
- [ ] Add `send_email` binding to `wrangler.jsonc`; switch deliver route `resend.emails.send` → `env.EMAIL.send` (html/text payload unchanged)
- [ ] **Remove `RESEND_TEST_RECIPIENT`** override code in `src/app/api/cron/deliver/route.ts` + delete the Worker secret — tripwire: `grep -r "RESEND_TEST_RECIPIENT" src/` returns 0 **AND** `npx wrangler secret list` shows no `RESEND_TEST_RECIPIENT` (override is user-scoped + fail-closed in code, but the secret itself must die too)
- [ ] Remove `resend` dependency + `RESEND_API_KEY` + `RESEND_FROM_EMAIL` secrets + the route's RESEND startup guard (route.ts ~89-96 hard-500s without them) + the dead `SYSTEM_USER_ID` resolveRecipient branch (unreachable: `briefs.user_id` NOT NULL FK)
- [ ] Recipient-unresolvable skip path (opt-out / missing email): today it console.warns only and the brief re-fetches every tick forever — write a terminal `failed` delivery_log row or excise from the pending set
- [ ] Set `NEXT_PUBLIC_APP_URL` + route briefUrl fallback to the purchased domain (E1 points both at the workers.dev URL)
- [ ] Backlog: provider webhooks (bounce/open) → populate `delivery_log.delivered_at`/`opened_at` (NULL orphan columns until then; `status='sent'` = provider-accepted only) — or drop the columns
- [ ] **SEC:** this closes the standing `secrets-handling.md` §7.1 violation (ForgeMinds currently shares FinKeel's Resend account/key — tolerated ONLY while in test mode with Victor as sole recipient)
- [ ] Verify: brief delivers to real user email (`auth.users`) with `delivery_log.provider='cloudflare'`
- [ ] Backlog (scope at E2): UI surface for delivery status (`delivery_log` is queryable but unrendered — traceability gap noted in design doc §4)


---

## Signal-Auto Proposals (2026-06-10, project: forgeminds)

### [SIGNAL-AUTO] REWORK fired 3x -- architectural review suggested (2026-06-10)
- **Project:** forgeminds
- **Signal count:** 3 REWORK events (threshold: 3)
- **Action:** Run /audit-gate or Hostile Architect review. Frequent rewrites signal under-specified requirements.
- **Priority:** HIGH



---

## Signal-Auto Proposals (2026-06-10, project: forgeminds)

### [SIGNAL-AUTO] APPROVAL fired 3x -- golden path candidate (2026-06-10)
- **Project:** forgeminds
- **Action:** Identify the pattern that earned approval. If it recurs across projects, add to golden-paths.md.
- **Priority:** LOW

