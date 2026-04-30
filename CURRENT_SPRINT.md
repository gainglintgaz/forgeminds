# ForgeMinds — Current Sprint

## Phase 0: Foundation
**Status:** 7/8 GATES PASSING (e2e remaining) — structurally verified 2026-04-30
**Started:** 2026-04-13
**Last update:** 2026-04-30 (post-fix verification)

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
