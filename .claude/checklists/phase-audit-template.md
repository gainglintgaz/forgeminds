# Phase Audit Template — copy to `phase-N-audit.md` per phase

> **What this is:** the canonical audit checklist every ForgeMinds phase
> runs before being declared complete. Captures factory CLAUDE.md §9
> "Audit Between Major Tasks" + adds project-specific items. Mechanically
> enforced via pre-commit hook (any "phase X complete" commit requires
> a corresponding `phase-N-audit.md` with all checks marked pass).
>
> **How to use:** copy this template to `phase-<N>-audit.md` at the
> START of phase close-out. Fill in evidence per row (commit hash, output
> snippet, screenshot path, etc.). The `phase-auditor` subagent
> (`.claude/agents/phase-auditor.md`) automates ~80% of the rows.
>
> **Why this exists:** Phase 0 was declared "done" three times without
> verification. Phase 1 was about to be closed without the §9 audit running.
> Same failure mode: the checklist exists in markdown but nothing forces
> it. This template + the auditor subagent + the pre-commit gate make it
> mechanically required.

## Phase metadata

- **Phase:** N
- **Phase name:**
- **Started:**
- **Audit run by:** human / phase-auditor subagent / both
- **Audit run on:** YYYY-MM-DD HH:MM:SS UTC
- **Auditor commit hash:** `<git rev-parse HEAD before audit start>`

---

## A. Build / type / lint

| Check | Pass? | Evidence |
|---|---|---|
| `npx tsc --noEmit` returns 0 errors | ⬜ | command output last line |
| `npm run lint` returns 0 errors, 0 warnings | ⬜ | command output |
| `npm run build` (full Next build) succeeds | ⬜ | command output |
| Bundle-size delta vs previous phase reasonable (no surprise +5MB) | ⬜ | `du -sh .next` before/after |

## B. Schema / DB / RLS

| Check | Pass? | Evidence |
|---|---|---|
| `verify:db` — all expected migrations applied, signature tables exist | ⬜ | output |
| `verify:columns` — 0 mismatches across `.from(...).select(...)` calls | ⬜ | output |
| `verify:rls` — every public table has RLS enabled AND ≥1 policy | ⬜ | output |
| Supabase advisor scan — 0 critical security findings | ⬜ | dashboard link + screenshot |
| Supabase advisor scan — 0 critical performance findings (or all justified) | ⬜ | dashboard link + screenshot |
| Every new table has `content_hash` UNIQUE for dedup (if accepts imports) | ⬜ | grep migration files |
| Every AI-output table has `prompt_version` column | ⬜ | grep migration files |
| All tables have `created_at` + `updated_at` (or explicit justification) | ⬜ | grep |
| All money columns use BIGINT cents (never float) | ⬜ | grep |

## C. Hardcoded / mock / fake data

| Check | Pass? | Evidence |
|---|---|---|
| `verify:honest-strings` — 0 fake numbers, lorem ipsum, placeholder strings in `src/` | ⬜ | output |
| No hardcoded user emails in production code (only in dev seeds + .env) | ⬜ | `grep -rE "@(forgeminds\.local\|example\.com\|test\.com)" src/` |
| No hardcoded user UUIDs except documented system constants | ⬜ | `grep -rE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" src/` — every match must be SYSTEM_USER_ID with a comment OR test fixture |
| No magic numbers affecting UX (counts, limits, thresholds, timeouts) without per-user config OR justification comment | ⬜ | manual review of all `.limit()`, `* 60 * 1000`, score thresholds |
| Constant API call count per user request = bug (lessons.md #98) | ⬜ | grep cron routes for unconditional fetcher calls |
| No `Math.random()` in user-facing code paths | ⬜ | grep (whitelist: components/ui/, scripts/, tests/) |
| No `'TODO'` / `'FIXME'` / `'XXX'` / `'HACK'` / `'PLACEHOLDER'` without ticket reference | ⬜ | grep src/ |

## D. Hallucinated content prevention

| Check | Pass? | Evidence |
|---|---|---|
| All AI-generated outputs route through fact-check pass before display | ⬜ | code path trace from LLM call → display |
| All entity references go through Wikidata-resolved canonical IDs (no LLM-fabricated entities) | ⬜ | resolver.ts + grep for entity name strings |
| All URLs in user-facing surfaces are either user-provided or verified by `source-validator` subagent | ⬜ | code path trace |
| No "AI suggested URL" written directly to DB without `source_validator` verification | ⬜ | grep for direct URL inserts after LLM response |
| Every brief / generated content has `prompt_version` so output is traceable to model + prompt | ⬜ | schema check |

## E. Dead UI / broken paths

| Check | Pass? | Evidence |
|---|---|---|
| Every clickable button/link has a working route (no 404s, no `href="#"` except disabled placeholders) | ⬜ | manual click-through OR Playwright spec |
| Every nav item routes correctly (sidebar + mobile-nav) | ⬜ | manual + Playwright |
| Every disabled feature has explicit "Soon" indicator (not just non-clickable) | ⬜ | grep for `disabled: true` |
| No routes that 500 with default user state | ⬜ | curl each route + browser DevTools |
| Empty states render gracefully on all primary surfaces (dashboard, briefs, sources, settings) | ⬜ | manual screenshot per page with empty data |

## F. Per-user / multi-tenant

| Check | Pass? | Evidence |
|---|---|---|
| All API routes scope DB writes by user_id (no SYSTEM_USER_ID writes outside cron seed paths) | ⬜ | grep `.insert(`/`.upsert(` for user_id |
| Per-user config drives behavior (no cron schedule baked in JS, etc.) | ⬜ | per-user knob audit (cadence, recency, density, paywall) |
| `verify:cron-empty-handling` — every cron route returns 200 + sensible body for user with zero sources | ⬜ | new verify script |
| Two test users see different data scoped to their user_id | ⬜ | Playwright multi-user spec |

## G. Security

| Check | Pass? | Evidence |
|---|---|---|
| No secrets in committed files (CRON_SECRET, API keys, JWT) | ⬜ | secret-scan grep |
| No `VITE_` / `NEXT_PUBLIC_` prefix on secret keys (only public config) | ⬜ | grep |
| All AI calls go through server-side functions (no `dangerouslyAllowBrowser: true`) | ⬜ | grep |
| Service-role key only referenced in server-side files (`/api/`, `lib/supabase/server.ts`, `scripts/`) | ⬜ | grep |
| No PII (SSN, EIN, full names, addresses) sent to AI APIs | ⬜ | scan AI router prompts |
| `verify_jwt: true` on all destructive Edge Functions (auth required for write/delete) | ⬜ | check Edge Function configs |
| Pre-commit hook blocks known secret patterns (sk-proj-, sbp_, eyJ...) | ⬜ | test with deliberate violation, should reject |

## H. Privacy / data integrity

| Check | Pass? | Evidence |
|---|---|---|
| User data only visible to that user via RLS (test by querying as different user) | ⬜ | RLS spec |
| AI audit trail logged (timestamp, model, prompt_version, user_id, token count) | ⬜ | check `prompt_outcomes` table |
| Account deletion cascades remove user-owned rows (no orphans) | ⬜ | manual test |
| No user_id leakage to client (e.g., logged in component props for unrelated users) | ⬜ | grep client components |

## I. Tests / verification scripts

| Check | Pass? | Evidence |
|---|---|---|
| `verify:phase-N` orchestrator green | ⬜ | output (AUDIT GATE block) |
| Playwright e2e suite green for primary flows | ⬜ | `npx playwright test` output |
| Pre-commit hook fires on `done|complete|finished|ship|deploy` wording | ⬜ | test with deliberate violation |
| `npm run verify:env-vars` — all phase-N required vars wired | ⬜ | output |

## J. Documentation freshness

| Check | Pass? | Evidence |
|---|---|---|
| `CURRENT_SPRINT.md` reflects truthful phase-N status (not aspirational) | ⬜ | inspect |
| `DECISIONS.md` has phase-N closure entry with date | ⬜ | inspect |
| `ARCHITECTURE_NOTES.md` reflects new patterns introduced this phase | ⬜ | inspect |
| `IDEAS.md` followups captured | ⬜ | inspect |
| `errors-fixed.json` updated for every bug closed this phase | ⬜ | git diff |
| Plan file (`sparkling-waddling-pinwheel.md`) reflects truthful phase-N status | ⬜ | inspect |
| Schema canonical names doc updated if any column added/changed | ⬜ | grep migrations |

## K. Cost / quota / observability

| Check | Pass? | Evidence |
|---|---|---|
| Every AI call has cost-estimate logging (prompt-cached where possible) | ⬜ | check `routeAIRequest` returns `costEstimateUsd` |
| Per-user cost cap reasonable for tier (Architect $34.99 → cost ≤ ~$15/mo for moderate use) | ⬜ | mental cost model OR pricing doc |
| Pipeline runs logged in `pipeline_runs` table with duration_ms + items_processed | ⬜ | sample query |
| Errors logged with context (`console.error('[stepName] failed:', err)` not silent catch) | ⬜ | grep for empty `catch (e) {}` |

## L. Phase-specific items

For each phase, append rows specific to what shipped this phase. Examples:

- **Phase 1:** "Project bootstrap SQL applied", "Cron dispatcher tested manually", "Empty-source handling verified per route"
- **Phase 1.5:** "Source catalog has ≥200 entries spanning ≥10 categories", "Conversational agent cost ≤$0.10/onboarding-run", "Source-validator subagent rejects all known-hallucinated test URLs"
- **Phase 2:** "Two test users see different per-user-scored feeds", "Onboarding flow writes profiles + user_preferences correctly"
- (etc.)

| Check | Pass? | Evidence |
|---|---|---|
| _Phase-specific 1_ | ⬜ | |
| _Phase-specific 2_ | ⬜ | |
| _Phase-specific 3_ | ⬜ | |

## Findings summary

After running every check above:

- **Pass count:** N / total
- **Fail count:** N
- **Failures requiring fix before phase close:**
  1. _description, file:line, proposed fix_
  2. ...
- **Acceptable issues (deferred to later phase):**
  1. _description, why deferred, target phase_

## Sign-off

- ✅ I confirm every blocker check above passes.
- ✅ I confirm every "deferred" issue has an explicit target phase + rationale.
- ✅ This audit was run by: `<human name OR phase-auditor subagent>`
- ✅ Audit start commit: `<hash>` → audit end commit: `<hash>`
- ✅ Pasted alongside the `feat: phase N complete` commit's AUDIT GATE block

```
PHASE AUDIT [phase-N]
✓ A. build/type/lint        — N/N pass
✓ B. schema/db/rls          — N/N pass
✓ C. hardcoded/mock/fake    — N/N pass
✓ D. hallucination prevention — N/N pass
✓ E. dead UI                — N/N pass
✓ F. per-user / multi-tenant — N/N pass
✓ G. security               — N/N pass
✓ H. privacy                — N/N pass
✓ I. tests                  — N/N pass
✓ J. documentation          — N/N pass
✓ K. cost / observability   — N/N pass
✓ L. phase-specific         — N/N pass
audited-at: <ISO timestamp>
auditor: <subagent or human>
```
