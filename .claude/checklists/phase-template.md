# Phase X — Definition of Done Checklist

> **Template.** Copy to `phase-X-complete.md` for the phase, replace `X` with the
> phase number, and check off each item only when the corresponding gate
> mechanically passes. Pre-commit hook reads this file and rejects commits
> using "done|complete|finished|ship|deploy" wording unless every box below is
> checked AND an `AUDIT GATE [phase-X]` block from `npm run verify:phase-X` is
> pasted at the bottom of this file.

## Mandatory gates (each one is automated)

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm run verify:db` — every expected migration applied, signature tables exist
- [ ] `npm run verify:columns` — zero schema-drift mismatches in `.from(...).select(...)` calls
- [ ] `npm run verify:rls` — every public table has RLS enabled with at least one policy
- [ ] `npm run verify:honest-strings` — zero fake/placeholder/mock data in `src/`
- [ ] `npm run verify:env-vars` — every Phase X required env var is wired into `src/`
- [ ] `npx playwright test` — auth + dashboard + sources + health flows green

## Phase-specific items (fill these in per phase)

- [ ] _Phase X feature 1 verified end-to-end_
- [ ] _Phase X feature 2 verified end-to-end_

## AUDIT GATE block (paste from `npm run verify:phase-X` output)

```
AUDIT GATE [phase-X]
✓ tsc --noEmit            — pass
✓ lint                    — pass
✓ verify:db               — pass
✓ verify:columns          — pass
✓ verify:rls              — pass
✓ verify:honest-strings   — pass
✓ verify:env-vars         — pass
✓ playwright e2e          — pass
verified-at: <ISO timestamp>
```

> **Reminder.** This file is the contract. Until every box is checked AND the
> AUDIT GATE block is present, no commit may use "done|complete|finished|ship
> |deploy" wording. The pre-commit hook enforces it. Discipline alone failed
> on Phase 0 — that's why this checklist exists.
