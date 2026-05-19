# ForgeMinds — CRITICAL.md (always-loaded digest)

> **The single auto-loaded rule file.** Replaces the prior `.claude/CLAUDE.md` + 14-file `.claude/rules/` auto-load. Tier-A rules (vibe-standard, data-protection, privacy, data-integrity, execution, hostile-architect, mcp-tools) live in full at `.claude/rules/` — this file extracts the tripwires + mechanical gates that fire most. Tier-B reference material lives at `.claude/rules/reference/` — load on demand.
>
> **Last updated:** 2026-05-18
> **Source-of-truth ordering:** This file → individual `rules/*.md` (full) → `rules/reference/*.md` (deep-dives).
> **If anything below conflicts with the full rule file, the full rule file wins.**

---

## §0 — What this project is

ForgeMinds is a personal intelligence OS. Pipeline: RSS / API ingest → AI scoring (Gemini Flash) → curation (per-user density caps) → brief generation (Claude Haiku via the AI router) → user outcomes (save / dismiss / rate) → flywheel re-scores tomorrow's pick.

**Stack:** Next.js 16 App Router, Tailwind v4, shadcn/ui (new-york), Supabase Postgres + Auth + pg_cron + pg_vector + Realtime, Vercel Fluid Compute, Stripe billing, Resend email.

**Architecture:** Smart Monolith with module boundaries at `src/lib/`. Modules communicate via the `jobs` table, not via direct imports.

**Top-level conventions (every commit):**
- DB columns: `snake_case`; TypeScript: `camelCase`
- Money: BIGINT cents in DB; `/100` only at display
- RLS on **every** public table — no exceptions
- All AI calls go through `src/lib/ai/router.ts` — never direct provider SDKs
- Every AI output row gets `prompt_version`
- Every import table gets a `content_hash` UNIQUE
- Cron routes require `Authorization: Bearer $CRON_SECRET`
- Secrets are server-side env vars only — never `NEXT_PUBLIC_` / `VITE_` prefix

---

## §1 — VIBE Standard tripwires (most-fired rules)

The full 60 numbered rules live at `.claude/rules/vibe-standard.md`. The mechanical tripwires below fire on most commits — read those rules in full when designing a feature; reference these when committing.

- **Rule 35 — Build-passing ≠ working.** Five gates, in order, each blocks the next:
  1. `npx tsc --noEmit` — 0 errors (catches what Vite/Turbopack skip)
  2. `npm run lint` — 0 errors
  3. Browser click-through with DevTools open on primary flows — 0 console errors
  4. DB SELECT round-trip — for any write, query confirms the row exists with correct columns
  5. Column-drift grep — `verify:columns` against live `information_schema`
- **Rule 50 — Probing before building** (money / AI output / user trust): state data contract, identify canonical helper, list failure modes (sparse / wrong mode / RLS denial / stale store), sketch verify-with-SELECT test BEFORE writing code.
- **Rule 52 — No silent catch blocks.** Every catch must re-throw, log with feature-tagged context, or render a user-visible error. `catch(e) {}` is forbidden.
- **Rule 53 — N+1 prevention.** Any data fetch inside `.map()`/`.forEach()` is a mandatory review stop. Use JOIN, `.in()`, or an RPC that returns the full graph.
- **Rule 54 — Schema-first for new tables.** Before any INSERT/SELECT: PK + FK behavior + indexes on every WHERE/ORDER BY/JOIN column + DOWN migration. Import tables: `content_hash` UNIQUE. AI-output tables: `prompt_version`.
- **Rule 59 — Surface conflicts, don't average.** If two existing patterns contradict, pick one (more recent / more tested), explain why, flag the other for cleanup. "Average" code that satisfies both is the worst code.
- **Rule 60 — Read before you write.** Before adding code to a file with ≥3 existing functions, state what those functions do and why your new code doesn't duplicate. If you can't state this, you haven't read enough.

Money / trust features additionally enforce Rules 44-48 (Data Completeness Gate, Temporal Integrity, Year Scope Label, Prerequisite Checklist, Data Basis Disclosure). N/A in ForgeMinds today (no money surface) — promoted when billing lands.

---

## §2 — Phase workflow (every feature, every time)

The full workflow lives at `.claude/rules/execution.md`. The fast-path:

1. **Phase 0 — Probing.** For money / AI / trust features ask: (a) data contract, (b) failure modes, (c) what time period this covers, (d) what auth at every layer, (e) what RLS policy. 30-min conversation prevents 8-hour rework.
2. **Phase 1 — Blueprint.** One sentence of what it does, the data it needs, the wireframe, the measurable "done."
3. **Phase 1.5 — Stack optimization** (`stack-optimizer.md`, reference). Skip if reusing the locked ForgeMinds stack.
4. **Phase 2 — Hostile Critique.** Run the 8-phase stress test from `hostile-architect.md`. Address ALL CRITICALs before any code; HIGH items get mitigations planned.
5. **Phase 3 — Step 1.** Smallest possible working increment: one file, one function, one route. Must work UI → DB → UI.
6. **Phase 4 — Incremental build.** One task per commit, build check + test + CURRENT_SPRINT update after each.
7. **Phase 5 — Verification.** Five Rule-35 gates + 9-scenario coverage check + console-clean.
8. **Phase 5.5 — AUDIT GATE block.** Commit subject containing `done|complete|finished|ship|deploy` requires an AUDIT GATE block in the body listing all 5 gates green. Pre-commit hook enforces.
9. **Phase 6 — Learning loop.** SESSION_DEBRIEF + suggestions to `errors-fixed.json`, `golden-paths.md`, rule updates — founder approves.
10. **Phase 7 — Ship.** Security audit, mock-data audit, test coverage, bundle size, known issues ranked.

**Token budgets** (Rule 58): per-task 4K, per-session 30K. If approaching: recap state + start fresh session.

---

## §3 — Data protection (every DB touch)

The full rule lives at `.claude/rules/data-protection.md`. Non-negotiable surface:

- **Two Supabase projects** — `forgeminds-dev` (`ymgbjtgczgnooscigplb`) for all AI work; `forgeminds-prod` for live users. Migrations apply to dev first, tested, promoted via PR.
- **MCP tokens scoped to dev by default.** Prod requires explicit founder flag in the session; the flag does NOT persist beyond the single operation.
- **Destructive ops gated.** `DROP TABLE/COLUMN`, `ALTER ... DROP`, `TRUNCATE`, `DELETE FROM <table>` without `WHERE`, `DROP POLICY/INDEX`, `RESET ROLE` all blocked by pre-commit unless commit body contains `[approved-destructive]` flag with reason.
- **Migration confirmation gate.** Before any `apply_migration` MCP call: diff against current schema, surface every destructive op explicitly, wait for explicit user confirmation per operation. Never proceed silently.
- **Post-migration `get_advisors`** — mandatory after every `apply_migration`. Commit body must contain `Advisors: clean` OR explicit findings list. (Migrations may not be self-approved.)
- **Off-platform backup path required.** Supabase PITR + daily `pg_dump` to a different vendor (B2/S3/GCS). Single-path = no path. Restore-tested quarterly.
- **Component deletion forbidden by default.** Files under `src/features/` or `src/components/` that look hardcoded / fake / unused get GATED (sparse-data state) — never deleted. Tripwire: commits deleting such files require `[approved-deletion]` flag with justification.

---

## §4 — Privacy + secrets

The full rule lives at `.claude/rules/privacy.md`. Non-negotiable surface:

**NEVER send to any AI API:** SSN, EIN, bank account / routing numbers, full names (first+last together), full addresses, credit card numbers, passwords/auth tokens.

**Truncate merchant names to 20 chars before sending to any AI.**

**API key rules:**
- Never `NEXT_PUBLIC_` / `VITE_` prefix on a secret. Public-only config gets the prefix.
- Never `dangerouslyAllowBrowser: true` on any AI SDK client.
- All AI API calls go through server-side Edge Functions / API routes. Pattern: browser → `supabase.functions.invoke()` → Edge Function → `Deno.env.get('API_KEY')` → external API → response.

**Storage:** all PII encrypted at rest (Supabase default), RLS audit before every launch, user-uploaded buckets `public = false`.

**Secrets management:** `.env`/`.env.local` git-ignored always. `.env.example` committed with placeholders only. Pre-commit hook blocks secret patterns in all files (including `.md` — no real keys in docs as examples).

**Account deletion** (app-store requirement): Settings → Danger Zone → typed "DELETE" confirmation → wipe storage + all user rows (FK order) + auth user → sign out + redirect.

**Pre-launch security checklist:** every item in `privacy.md` "Pre-Launch Security Checklist" passes before any production deploy.

---

## §5 — Data integrity (every smart feature)

The full rule lives at `.claude/rules/data-integrity.md`. The DMG is non-negotiable on every projection / insight / report / advice / recommendation.

**Four levels every smart feature must implement:**

| Level | Trigger | UI behavior |
|---|---|---|
| 0 — Ghost | 0 data points | Feature hidden, or intro card with "Upload to start" CTA |
| 1 — Cold | < 50% required data | Amber banner + Data Hunt checklist + "Upload missing" button |
| 2 — Warm | ≥ 70% required data | Speculative Mode: blurred / range numbers, "Low confidence" badge |
| 3 — Mature | 100% required + verified source | Full feature, precise numbers, "Verified data" badge |

**Source weight hierarchy:**
- Plaid bank sync (cryptographically signed): max Level 3
- AI-extracted (Gemini OCR / verified document): max Level 3
- Manual user entry: **max Level 2 permanently** (never unlocks 3 — no audit trail)
- Extrapolated / estimated: Level 1 only

**Speculative Mode watermark** must be visible on every number in Warm mode — not just a header banner. Numbers shown as ranges. Exports disabled below Level 3.

**Stale data auto-revert:** If an expected recurring data point is missing > 35 days, feature reverts Mature → Warm automatically.

**AI input gate (server-side, BEFORE the model sees data):**
```ts
const maturity = await getMaturityLevel(userId, featureArea);
if (maturity < MINIMUM_FOR_INSIGHT) {
  return { blocked: true, reason: `Need level ${MINIMUM_FOR_INSIGHT}, got ${maturity}` };
}
// only NOW send data to AI model
```
Gating at the UI is insufficient — the wrong answer already exists in memory. Gate at the function that calls the model.

**Per-AI-call audit:** every call logs `{ userId, featureArea, maturityLevel, promptVersion, modelName, timestamp }`. The `prompt_version` enables "why did the app say this 6 months ago?" auditing.

**Maturity cached in `profiles` (one column per feature area) + updated by DB trigger on document upload — never recomputed on page load.**

---

## §6 — Hostile Architect (every blueprint)

The full 8-phase protocol lives at `.claude/rules/hostile-architect.md`. Compact version:

0. **Tool audit + monthly cost** — every paid service inventoried at V1 + 1K-users scale; save to `project-costs.json`.
1. **Boundary attack** — empty state, max-data state, wrong-mode, no-network, stale cache, concurrent writes, port collision, process crash.
1.5. **Second-time attack** — double import, double scan, double click, re-export, re-visit. Every user action creating data must have UNIQUE / hash / idempotency. **Mandatory schema enforcement, not a question.**
1.6. **AI recommendation attack** (for AI-driven recs / scoring): hallucinated URLs, 403 false invalid, citation/body mismatch, schema drift, stale blocklist, uncapped scrape budget, deal score with <3 price points.
2. **Persistence audit** — trace UI → state → API → DB → SELECT → UI. Any broken link = fake feature.
3. **Cascade analysis** — map every dependency. One bad classification ruins everything downstream.
4. **Honest strings check** — every %, $, count, percentage from real data. No hardcoded fakes.
5. **System boundary probe** — RLS policies actually work, Edge Function cold starts within timeout, external API rate limits respected.
6. **Moat check** — what data network effect? What can a fresh clone of the repo NOT have?
7. **Revenue reality** — first-dollar path clear, unit economics CAC < LTV.

For each finding: **CRITICAL** items block all code; **HIGH** items get mitigations planned; **MEDIUM/LOW** acknowledged.

**QA matrix (pre-launch):** 15 tests in `hostile-architect.md`. Critical: offline, chaos (double-click), fresh account, bad-AI JSON, mode-switch, honest-strings audit, DB round-trip, security sweep, data-completeness gate, wrong-year doc, partial data, OAuth fresh-tab, dead-button, export relevance, code-read pass.

---

## §7 — MCP tools (quick reference)

Full catalog at `.claude/rules/mcp-tools.md`. ForgeMinds-relevant servers:

| Server | When |
|---|---|
| **supabase-forgeminds** | All DB / Edge Function / migration / RLS work. Default = dev project `ymgbjtgczgnooscigplb`. Prod requires founder flag. |
| **github** | Repo, PRs, branches, releases — `gainglintgaz/forgeminds` (private). |
| **vercel** | Deployments, env vars, build logs (ForgeMinds is Vercel-hosted). |
| **gmail / google-calendar / google-drive** | Founder communications + assets. |
| **linear / asana** | Project + task tracking. |
| **cloudflare** | Not used by ForgeMinds (Vercel + Supabase only). |

**Anti-defaults:**
- No Firebase auth on ForgeMinds.
- No Mongo / Drizzle / Prisma — supabase-js direct + RLS.
- No Express server — Next.js Route Handlers + Edge Functions only.

---

## §8 — When to load the full Tier-A rule files

The 7 files at `.claude/rules/` are the deep references for §1-§7. Load the full file when:
- Designing a new feature that touches the rule's domain
- Writing a migration (load `data-protection.md` + `data-integrity.md`)
- Debugging a security concern (load `privacy.md`)
- Running a Hostile Architect pass (load `hostile-architect.md`)
- Writing a phase plan (load `execution.md`)

## §9 — When to load reference files

The 7 files at `.claude/rules/reference/` are on-demand only. Load when:
- **`consulting.md`** — N/A for ForgeMinds product work (consulting business unit)
- **`data-flywheel.md`** — designing user-contribution UX, schemas for ratings / reviews / outcomes
- **`lessons.md`** — debugging a recurring failure mode; grep first by keyword
- **`stack-optimizer.md`** — N/A; ForgeMinds stack is locked
- **`self-reflection.md`** — end-of-session SESSION_DEBRIEF generation
- **`ai-first-principles.md`** — at phase close, run the 5-question audit + AI-at-core check
- **`aggregate-design.md`** — Phase 8+ when emitting cross-user benchmarks

---

## §10 — Hierarchy when rules conflict

1. User's explicit in-session instruction (highest)
2. Project `.claude/CLAUDE.md` (slim pointer)
3. This file (`CRITICAL.md`)
4. Individual `.claude/rules/<file>.md` (Tier-A full)
5. `.claude/rules/reference/<file>.md` (Tier-B reference)
6. Factory globals at `C:\Users\vtbsj\victor-ai-factory\.claude\` (if loaded)
7. Default model behavior (lowest)

Compliance + safety rules (data-protection §, privacy §, data-integrity §) never yield to time pressure. Better late than wrong.

---

## §11 — When AI is uncertain

Ask the founder before acting on:
- Anything that mutates production data
- Anything that deletes user-facing components
- Anything that changes pricing, terms, or compliance copy
- Anything that creates a new aggregation or cross-user data flow

Asking is never wrong.
