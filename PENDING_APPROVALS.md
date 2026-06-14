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


---

## Self-Reflection Report — 2026-06-14

> Generated after the ForgeMinds drawing-board reset (product + architecture). Per `self-reflection.md`, lessons + rule-update proposals are surfaced here for founder approval; nothing is auto-committed to rule files.

### Gaps Found

1. The factory's architect-first / AI-first-audit ran at the FEATURE level but never at the PRODUCT level, and audits checked design/build, never runtime truth — so a product that made 0 AI calls "passed" everything until the founder tested it live.
   - **Current rule:** `execution.md` Phase 5 / VIBE Rule 35 (five-gate Definition of Done) + `ai-first-principles.md` Q1.
   - **What it says:** the gates check tsc/lint/browser/DB-round-trip/column-drift and "if you removed every AI call, what % works."
   - **What it should say:** add a RUNTIME-TRUTH gate — `ai_calls_made > 0` in telemetry for the period + a human rated one real product output as good (dogfood) — and run the AI-first audit at the PRODUCT level against a concrete benchmark, not only per feature.
   - **Why:** ForgeMinds' score/curate/enrich/generate all reported `completed` at 0 AI calls; the AI-first audit (2026-05-05) said "passes cleanly" while runtime made ~0 AI calls.

2. No mechanical "strict resolution" requirement — the AI was free to emit category strings, producing a single invented `core` bucket.
   - **Current rule:** VIBE Rule 24 (Invisible Ledger: safeParseJson + mapping layer).
   - **What it should say:** strengthen Rule 24 to require AI category/entity/ticker outputs to RESOLVE to an existing DB UUID before insert; an unresolved value flags-for-review (no blind insert).
   - **Why:** there was a mapping layer in spirit but no enforcement; everything degraded to one bucket (ERR-021).

3. The project CLAUDE.md stack line is now stale (says "Vercel Fluid Compute"; the deploy went to Cloudflare Workers, which failed; decision is now Railway).
   - **Current rule:** project `.claude/CLAUDE.md` "Stack" section.
   - **What it should say:** Next.js on Railway (Node container) + Supabase brain; off Cloudflare Workers.
   - **Why:** ERR-026 + the 2026-06-14 stack DECISIONS entry.

### Proposed Rule Updates (founder to approve before any rule file is edited)

- [ ] `execution.md` / `vibe-standard.md` Rule 35: add the runtime-truth gate (`ai_calls_made > 0` + human dogfood rating) to the Definition of Done.
- [ ] `vibe-standard.md` Rule 24: add the strict-resolution-to-DB-UUID requirement (flag-don't-insert on a miss).
- [ ] `GOAL.md`: add the dogfood gate ("a human runs the product's own loop and rates a real output every cycle") to the §6 shippable gate.
- [ ] Project `.claude/CLAUDE.md` Stack section: Cloudflare/Vercel → Railway + Supabase.
- [ ] Promote lessons #104-#110 from this project's `reference/lessons.md` into the factory `reference/lessons-archive.md` (cross-project canon).

### New Lessons Drafted (appended to `.claude/rules/reference/lessons.md`)

- 104. **Runtime-truth Definition of Done.**
- 105. **Strict resolution layer: AI maps to existing DB UUIDs, never invents.**
- 106. **Architect-first applies to the PRODUCT, anchored to a concrete benchmark.**
- 107. **Dogfood gate: a human must run the product's own loop every cycle.**
- 108. **Verify against the live DB / telemetry over handoff docs.**
- 109. **Day-one value vs long-term moat — don't conflate them.**
- 110. **Don't build the universal abstraction before proving one concrete instance.**

### No Action Needed

- The pg_cron dispatcher, AI router, finance fetchers, user-prefs spine, and briefs UI are sound and reusable (~85% reuse) — verified against live code/schema, not assumed.
- RLS is enabled on all public tables (verified via `list_tables`).
- `docs/architecture/strategy-architecture-brief-2026-06-14.md` correctly captured the reconciled positions and was externally adversarially reviewed.



---

## Signal-Auto Proposals (2026-06-14, project: forgeminds)

### [SIGNAL-AUTO] SECURITY signal fired 1x -- verify no token exposure (2026-06-14)
- **Project:** forgeminds
- **Signal count:** 1 SECURITY events this session
- **Action:** Review signal-log.jsonl for entries with secret_in_prompt:true. If any found, rotate the affected token immediately per secrets-handling.md SS3.
- **File:** .claude/signal-log.jsonl
- **Priority:** CRITICAL -- Victor action required

