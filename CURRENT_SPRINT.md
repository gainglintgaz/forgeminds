# ForgeMinds — Current Sprint

## ✅ PHASE 1.5 CLOSED — 2026-05-15

- Phase 0: CLOSED (commit d09300a)
- Phase 1: CLOSED 2026-05-12 (commit ab471e0)
- Phase 1.5: **CLOSED 2026-05-15** (commit 3ee8b69) — ALL GATES PASSED
  - Catalog: **218 rows**, 100% embedded, **13 distinct categories**, 51 subcategories, median quality 0.850
  - Skeleton: 100% — every Phase 1.5 file/route/component exists + passes all gates
  - Cost-audit: PASSED 2026-05-24 (commit e2b46b8)
  - verify:phase-1-5: ✅ 11/11 gates — tsc, lint, verify:db, verify:columns, verify:rls, verify:honest-strings, verify:env-vars, verify:cron-routes, verify:cron-empty-handling, verify:source-catalog, playwright e2e
- Phase 2 prep: DRAFTED (commit dbafdbf — file-only)

**Next:** Phase 2 — apply article_outcomes migration + remove from PENDING_MIGRATION_TABLES

---

## Pre-park sprint state (reference only — historical)

### Phase 1.5: AI-Assisted Source Discovery — last update 2026-05-24
**Status (as of park):** Phase 1 closed 2026-05-12; Phase 1.5 catalog seeded 67/200 sources, 5/10 categories
**Started:** 2026-05-05 (overnight autonomous build, parallel with Phase 1 close)
**Last update before park:** 2026-05-24

### Where we are right now (post-2026-05-24 session)

**Catalog state (MCP-verified):**
- 67 rows total, 100% embedded
- 5 categories: medicine, finance, tech, sciences, geopolitics
- 17 subcategories
- Median quality 0.880 (target ≥0.65 ✓)
- 88% free or freemium (target ≥50% ✓)

**Phase 1.5 close still needs ~3-4 more sessions of curator dispatches:**
- ~133 more rows (target ≥200)
- ~5 more categories (target ≥10: education, arts, lifestyle, sports, civic, etc per VECTORS.md)
- Then: real onboarding round-trip smoke + cost audit (currently blocked on Anthropic key) + verify:phase-1-5 + close commit

**Recommended next 4 curator batches (parallel dispatch, foreground only):**
1. `education / edtech` — Khan Academy, EdSurge, Inside Higher Ed, Hechinger, Substack edtech
2. `arts / literature` — NYRB, LARB, Paris Review, Lit Hub, Substack literary
3. `sports / strategy` — The Athletic, ESPN xG, FiveThirtyEight sports, RotoWire
4. `lifestyle / longevity` — Peter Attia, Huberman, Outlive newsletter, podcast feeds

After those 4: ~120 rows, 9 categories. One more wave (5 categories × 10 sources = 50 rows) to clear Phase 1.5 gate.

**What "skeleton built" means:** Every Phase 1.5 file/route/component exists, type-checks clean, lints clean, and passes the pre-commit gates. Catalog seeding via the `source-catalog-curator` subagent + dev DB migration apply happen in dedicated Phase 1.5 sessions. Those are the only remaining gates between skeleton and ship.

### Skeleton inventory (all committed; see overnight commits 09a2bd2 → 938ceb6)

| Block | Deliverable | Files | Commit |
|---|---|---|---|
| A | source_catalog + source_suggestions migrations | 2 SQL | 09a2bd2 |
| B | Catalog seed dir + curator dispatch README | 1 MD | 3817625 |
| C | Onboarding wizard (3 pages + layout + 3 client components + 2 API routes + 4 lib files) | 14 ts/tsx | 818b465 |
| D | Claude/OpenAI/Perplexity providers + router wiring | 4 ts | e2f8991 |
| E | Source-validator runtime + onboarding e2e stubs | 3 ts | be44173 |
| F | verify-phase-1-5 + verify-source-catalog + checklist + npm scripts | 4 files | 8c64d70 |
| G | /sources page redesign (CatalogBrowser + SuggestionsPanel + SourceHealth) | 4 tsx | 938ceb6 |

### Remaining for Phase 1.5 close

1. ✅ Apply migrations 20260510000000_source_catalog.sql + 20260510000001_source_suggestions.sql — APPLIED 2026-05-05 to ymgbjtgczgnooscigplb
2. ✅ Apply seeds/source_catalog_rag_rpc.sql + switch to SECURITY INVOKER — APPLIED 2026-05-05 (advisor confirmed clean: 5 known/accepted warnings, 0 new from Phase 1.5)
3. ✅ Embed backfill script written (`scripts/embed-source-catalog.ts`, commit `f278ece`)
4. ⏳ Add ANTHROPIC_API_KEY, OPENAI_API_KEY, PERPLEXITY_API_KEY to .env.local + Vercel
5. ⏳ Run source-catalog-curator subagent for ≥10 (category, subcategory) pairs to seed ≥200 sources (file-by-file commits per README in supabase/seeds/source_catalog/)
6. ⏳ Run embed-source-catalog backfill script after each curator seed batch
7. ⏳ Smoke test: real onboarding run → proposals returned → /onboarding/finalize → sources written
8. ⏳ Run `npm run verify:phase-1-5` (with dev server) → all gates green
9. ⏳ `feat: phase 1.5 complete` commit with AUDIT GATE [phase-1-5] + PHASE AUDIT blocks

---

## Phase 1: Pipeline Infrastructure (PRIOR — pending close)
**Status:** Audit complete (7 blockers identified, all fixes landed) — 2026-05-04
**Started:** 2026-04-30 (after Phase 0 closed)
**Last update:** 2026-05-05 (Phase 1.5 build did not regress Phase 1 gates)

**Revised closure criteria (DECISIONS.md 2026-05-04):** "Pipeline infrastructure is ready and dormant until users tell it what to do — and the pipeline genuinely does nothing until they do." Articles only flow after Phase 1.5 (AI-Assisted Source Discovery) ships.

### Phase 1 audit findings (commit `e631bb5`, audit file `.claude/checklists/phase-1-audit-2026-05-04.md`)

| # | Blocker | Status |
|---|---|---|
| 1 | `/api/cron/ingest` calls 4 paid news APIs unconditionally for every user | ✅ FIXED — gated by source-type presence |
| 2 | Project bootstrap SQL not yet applied to dev DB | ⏳ MANUAL — Victor pastes once |
| 3 | `verify:pipeline-flow` hard-fails when pipeline is correctly dormant | ✅ FIXED — replaced by `verify:cron-empty-handling` |
| 4 | `verify:cron-empty-handling` script missing | ✅ FIXED — `scripts/verify-cron-empty-handling.ts` shipped |
| 5 | Fetcher refactor (per-source config) hardcodes "general" category | 🟡 DEFERRED — Phase 1.5 work (no user has these source types yet; gating in Blocker 1 fix prevents harm) |
| 6 | 4 hardcoded `.limit(...)` UX values (score 100, deliver 20, briefs 30, feed 50) | ✅ FIXED — migration `20260504000000_user_preferences_pagination.sql` + routes wire prefs |
| 7 | `CURRENT_SPRINT.md` stale (Phase 0-only) | ✅ FIXED — this update |

**Remaining for Phase 1 close:**
1. ⏳ Victor pastes `supabase/seeds/phase-1-project-bootstrap.sql` once (vault secret + base_url + cron jobs active)
2. ⏳ Victor runs Supabase advisor scan (security + performance), confirms 0 critical findings
3. ⏳ Re-run `phase-auditor` subagent → confirm zero blockers
4. ⏳ Run `npm run verify:phase-1` (with dev server) → green
5. ⏳ Run Playwright e2e once dev server is up → 4/4 specs pass
6. ⏳ `feat: phase 1 complete` commit with AUDIT GATE + PHASE AUDIT blocks in body

---

## Phase 0: Foundation (DONE — commit `d09300a`, 2026-04-30)
**Status:** ✅ COMPLETE — all 8 gates green
**Started:** 2026-04-13
**Closed:** 2026-04-30 (all 8 verify:phase-0 gates green)

**State as of 2026-04-30:** Phase B column-drift fixes complete and mechanically verified. All 7 structural gates pass:

```
AUDIT GATE [phase-0]
✓ tsc --noEmit             — pass
✓ lint                     — pass
✓ verify:db                — pass    (7/7 migrations, 69 tables)
✓ verify:columns           — pass    (0 mismatches across 30 call sites, 75 files)
✓ verify:rls               — pass    (69/69 tables RLS-enabled with policies)
✓ verify:honest-strings    — pass    (0 fakery occurrences)
✓ verify:env-vars          — pass    (4/4 Phase 0 required vars wired)
verified-at: 2026-04-30T01:57:49.736Z
```

The 8th gate (Playwright e2e) requires `npm run dev` running concurrently and a Vercel deploy for the `/api/health` smoke test. That's the only remaining mechanical work for Phase 0 sign-off.

### Phase A — Enforcement Infrastructure (installed 2026-04-29)

- [x] Lessons #93-96 appended to factory `.claude/rules/lessons.md`
- [x] VIBE Rule 35 strengthened (5 sequential gates) in `vibe-standard.md`
- [x] Phase 5.5 Audit Gate added to `execution.md`
- [x] `.claude/CLAUDE.md` 🔴 PHASE COMPLETION ENFORCEMENT section added
- [x] `DECISIONS.md` 2026-04-29 audit decision recorded
- [x] `ARCHITECTURE_NOTES.md` Schema Canonical Names Reference table added
- [x] `scripts/verify-columns.ts` — schema drift detector
- [x] `scripts/verify-rls.ts` — RLS coverage gate
- [x] `scripts/verify-honest-strings.ts` — fakery scanner
- [x] `scripts/verify-env-vars.ts` — env-var wiring gate
- [x] `scripts/verify-phase-0.ts` — orchestrator + AUDIT GATE block emitter
- [x] `playwright.config.ts` + `e2e/{health,auth,dashboard,sources}.spec.ts`
- [x] `.claude/checklists/{phase-template,phase-0-complete,phase-1-complete}.md`
- [x] `.husky/pre-commit` hook (AUDIT GATE wording check + tsc + verify:columns + secret grep + lint)
- [x] `package.json` scripts wired (`verify:*`, `e2e`, `prepare: husky`) and `husky` + `@playwright/test` added to devDependencies

### Phase A — Activation steps (Victor to run, one-time)

These three commands activate everything Phase A installed:

```bash
cd projects/forgeminds
npm install                        # installs husky + @playwright/test
npx playwright install chromium    # downloads the browser binary
chmod +x .husky/pre-commit         # (Git Bash / WSL); on plain Windows PowerShell, use: git update-index --chmod=+x .husky/pre-commit
```

Then in Supabase SQL editor (one-time, required for `verify:columns` and `verify:rls`):

```sql
create or replace function public.forgeminds_columns()
  returns table(table_name text, column_name text)
  language sql security definer set search_path = public
  as $$
    select c.table_name::text, c.column_name::text
    from information_schema.columns c
    where c.table_schema = 'public';
  $$;
grant execute on function public.forgeminds_columns() to service_role;

create or replace function public.forgeminds_rls_state()
  returns table(table_name text, rls_enabled boolean, policy_count bigint)
  language sql security definer set search_path = public
  as $$
    select c.relname::text,
           c.relrowsecurity,
           coalesce((select count(*) from pg_policies p
                       where p.schemaname='public' and p.tablename=c.relname), 0)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname='public' and c.relkind='r'
    order by c.relname;
  $$;
grant execute on function public.forgeminds_rls_state() to service_role;
```

Then run the first audit:

```bash
npm run verify:phase-0:no-e2e      # runs every gate except Playwright (until you've started `npm run dev`)
```

Expected: most gates fail (this is the point — we now mechanically know what's broken).

### Phase B — Fix broken + complete incomplete (next session)

Per the master plan, Phase B fixes will follow the broken-paths surfaced by `verify:columns`. Sketch:

- [ ] `src/app/api/cron/ingest/route.ts` — `enabled` → `is_active`, `description` → `summary`, `metadata` → `raw_metadata`, add `user_id`, fix `pipeline_runs` field names
- [ ] `src/app/api/cron/score/route.ts` — `fetched_at` → `created_at`, `raw_article_id` → `article_id`, score-column rename, conflict key fix
- [ ] `src/app/api/cron/curate/route.ts` — `scored_at` → `created_at`, fix `briefs` upsert columns
- [ ] `src/app/(dashboard)/page.tsx` — `description`/`metadata` → `summary`/`raw_metadata`, `symbol` → `ticker_symbol`
- [ ] `src/components/feed/{article-feed,article-card}.tsx` — type/prop name fixes
- [ ] `src/components/sources/add-source-dialog.tsx` — wire submission
- [ ] `src/lib/ai/router.ts` — stub-and-throw unimplemented providers
- [ ] `src/app/api/auth/logout/route.ts` — create (was missing)
- [ ] Re-run `npm run verify:phase-0`. Repeat until clean.
- [ ] Sign off `phase-0-complete.md` with the AUDIT GATE block pasted at the bottom.

### Phase C — Build forward to end-to-end pipeline

Only proceeds after Phase B mechanically passes. See plan file `C:\Users\vtbsj\.claude\plans\sparkling-waddling-pinwheel.md` Phase C.

### ✅ Done
- [x] Scaffold Next.js 16 + Tailwind v4 + shadcn/ui
- [x] Design system: ForgeMinds colors, fonts, semantic tokens
- [x] CLAUDE.md project instructions + 4-layer no-hallucination architecture
- [x] DECISIONS.md, IDEAS.md, ARCHITECTURE_NOTES.md (persistent thinking)
- [x] PWA manifest
- [x] launch.json for dev server
- [x] `.env.local` populated (Phase 0 keys + many Phase 1+ keys)
- [x] Leaked OpenAI key revoked + replaced with restricted key
- [x] Supabase project created (ymgbjtgczgnooscigplb)
- [x] All 8 schema migrations applied (69 tables)
- [x] Role grants restored after schema reset (lesson learned)
- [x] Verify script working (`npx tsx scripts/verify-db.ts`)
- [x] Action templates registry stubs (10 templates)
- [x] Tool capabilities seed (30 tools, 6 lessons learned)
- [x] OAuth-based Supabase MCP wired (project-scoped)

### 🟡 In progress / next session
- [ ] Run Supabase security advisor + fix any RLS findings
- [ ] Build authenticated dashboard layout (sidebar, topbar, mobile nav, bell icon)
- [ ] Wire Supabase Auth UI (signup/signin pages)
- [ ] Build empty-state pages for /, /archive, /sources, /content, /settings, /analytics
- [ ] Deploy to Vercel
- [ ] Verify deployed `/api/health` endpoint
- [ ] Domain setup (forgeminds.app via Cloudflare Registrar)

### Verification criteria for Phase 0 done
- [x] All 7 migrations applied (✓ verified via verify-db.ts and supabase migration list)
- [x] RLS active on all tables (✓ enabled in migrations)
- [x] JS SDK can query tables with anon/service_role keys (✓ confirmed)
- [ ] Auth flow works (signup → confirm → login → see dashboard)
- [ ] All dashboard pages render with empty states (DMG Level 0: Ghost)
- [ ] PWA installable on mobile
- [ ] Build passes with zero TypeScript errors
- [ ] Deployed to Vercel and `/api/health` returns OK

### Architecture state
- 70 tables across 8 migrations
- 6-layer Brain Stack documented
- 10 action templates stubbed (Phase 1 implementation)
- 30+ tool capabilities cataloged (HuntHive lessons captured)
- OAuth MCP for Supabase project-scoped to ymgbjtgczgnooscigplb
- Stack confirmed: Vercel + Supabase + Cloudflare DNS (Option C from build-vs-buy decision)

### What's blocked / parked
- Supabase Agent Skills installer (parked — interactive installer; revisit when needed)
- Build kickoff package generator UI (Phase 4)
- Voice DNA edit-learning (Phase 4)
- Collective Brain processing pipeline (Phase 7)
