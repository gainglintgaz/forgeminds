# Phase 0 — Foundation: Definition of Done Checklist

> **Status:** NOT YET COMPLETE. This file is the mechanical proof gate.
> Until every box below is checked AND an `AUDIT GATE [phase-0]` block from
> `npm run verify:phase-0` is pasted at the bottom, no commit may use
> "done|complete|finished|ship|deploy" wording for Phase 0. The pre-commit
> hook enforces this.

## Why this file exists

Phase 0 was declared "done" three times during the 2026-04-13 → 2026-04-29
build. Each time the build compiled, but:
- 6 API routes referenced wrong column names from an earlier mock schema
- The dashboard query used `symbol` instead of `ticker_symbol`
- Auth flow was never tested end-to-end
- Every Phase 0 API call would have crashed at runtime on first user click

Discipline alone failed under shipping pressure. This checklist is the
mechanical fix.

## Mandatory automated gates

- [x] `npx tsc --noEmit` exits 0 (catches Supabase column-string drift in `as`-cast contexts)
- [x] `npm run lint` exits 0 (zero ESLint errors)
- [x] `npm run verify:db` — all 7 migrations applied (69 tables); every signature table exists
- [x] `npm run verify:columns` — zero `.from("foo").select("bar")` calls referencing nonexistent columns (30 call sites scanned)
- [x] `npm run verify:rls` — every public table has RLS enabled AND at least one policy (69/69 compliant)
- [x] `npm run verify:honest-strings` — zero fake/placeholder/mock data in `src/` (75 files clean)
- [x] `npm run verify:env-vars` — all 4 Phase 0 required vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`) read by functional code paths in `src/`
- [ ] `npx playwright test` — `health.spec.ts` + `auth.spec.ts` + `dashboard.spec.ts` + `sources.spec.ts` all green (requires `npm run dev` running; not yet executed)

## Phase 0 feature gates

- [ ] **`/api/health`** returns 200 + `{ ok: true }` on Vercel-deployed build
- [ ] **Signup → confirm → login → dashboard** flow works end-to-end (Playwright `auth.spec.ts` green)
- [ ] **Logout** wired (`/api/auth/logout` exists and clears the Supabase session)
- [ ] **Dashboard `(dashboard)/page.tsx`** queries use canonical column names (`summary`, `raw_metadata`, `ticker_symbol`) — no references to `description`, `metadata`, or `symbol`
- [ ] **Sources page `/sources`** lets a logged-in user add an RSS feed and the row lands in the `sources` table with `is_active = true` (Playwright `sources.spec.ts` green)
- [ ] **Empty-state pages** render for `/`, `/archive`, `/sources`, `/content`, `/settings`, `/analytics` without console errors (DMG Level 0: Ghost)
- [ ] **Cron routes** (`/api/cron/ingest`, `/api/cron/score`, `/api/cron/curate`) gated by `CRON_SECRET` header AND use canonical column names per `ARCHITECTURE_NOTES.md` Schema Canonical Names Reference
- [ ] **Action templates registry** seeded (10 stubs in DB)
- [ ] **Tool capabilities seed** applied (`supabase/seeds/tool_capabilities.sql` rows present in `tool_capabilities` and `tool_lessons_learned`)
- [ ] **Vercel deployment** live and `/api/health` reachable from public internet
- [ ] **Domain `forgeminds.app`** resolves to Vercel deployment

## Architecture state captured

- [x] `ARCHITECTURE_NOTES.md` Schema Canonical Names Reference table reflects the live schema (verified by `verify:columns` zero-mismatch run on 2026-04-30)
- [x] `DECISIONS.md` 2026-04-29 audit-failure decision recorded
- [x] `CURRENT_SPRINT.md` Phase 0 status reflects truthful completion percentage
- [x] Factory `lessons.md` #93-96 captured

## AUDIT GATE block (from `npm run verify:phase-0:no-e2e` output)

```
AUDIT GATE [phase-0]
✓ tsc --noEmit             — pass
✓ lint                     — pass
✓ verify:db                — pass    (7/7 migrations, 69 tables)
✓ verify:columns           — pass    (0 mismatches across 30 call sites, 75 files)
✓ verify:rls               — pass    (69/69 tables RLS-enabled with policies)
✓ verify:honest-strings    — pass    (0 fakery occurrences across 75 files)
✓ verify:env-vars          — pass    (4/4 Phase 0 required vars wired)
verified-at: 2026-04-30T01:57:49.736Z
e2e: not-yet-run (requires `npm run dev` + Vercel deployment for `/api/health`)
```

> **Note.** The 7 structural gates above are mechanically verified. Three remaining gates require a running app:
> - Playwright e2e (auth + dashboard + sources flows) — needs `npm run dev` in another terminal
> - `/api/health` smoke test from public internet — needs Vercel deploy
> - Manual click-through of empty-state pages
>
> When all three are green, paste the FULL AUDIT GATE block (including playwright e2e) into the commit message body and mark Phase 0 truly done.

> **Reminder.** Phase 0 is not done until every box above is checked AND a
> real AUDIT GATE block (not the empty placeholder) lives at the bottom of
> this file. The pre-commit hook reads this file before allowing any
> "done|complete|finished" commit on Phase 0. See `.claude/CLAUDE.md`
> "🔴 PHASE COMPLETION ENFORCEMENT" section for the rationale.
