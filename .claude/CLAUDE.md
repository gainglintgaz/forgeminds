# ForgeMinds — Personal Intelligence OS

> **Auto-load contract (post-rule-split, 2026-05-18):**
> - **Single source of truth:** `.claude/CRITICAL.md` — the always-loaded digest covering the 60 VIBE rules, the 5 phase-workflow tripwires, data-protection / privacy / data-integrity gates, the 8-phase Hostile Architect summary, and the MCP catalog.
> - **Tier-A full rules at `.claude/rules/`** (7 files: vibe-standard, data-protection, privacy, data-integrity, execution, hostile-architect, mcp-tools) — load the specific file when designing a feature in its domain.
> - **Tier-B reference at `.claude/rules/reference/`** (7 files: consulting, data-flywheel, lessons, stack-optimizer, self-reflection, ai-first-principles, aggregate-design) — load on demand only.
>
> Split rationale + token-budget evidence at `.claude/RULE_SPLIT_AUDIT.md`.

## What this project is

A personal intelligence OS. Ingest news + research from user-chosen sources → AI-score per user → curate via density caps → generate brief via Claude Haiku → user captures outcomes (save / dismiss / rate) → flywheel sharpens tomorrow's pick.

## Stack

Next.js 16 (App Router, Turbopack) · Tailwind v4 · shadcn/ui new-york · Supabase Postgres + Auth + pg_cron + pg_vector + Realtime · Vercel Fluid Compute · Stripe billing · Resend transactional email · AI router (`src/lib/ai/router.ts`) for all Gemini / Claude / Grok / Perplexity calls.

## Project conventions (every commit)

- DB columns `snake_case`; TypeScript `camelCase`
- Money: BIGINT cents in DB; `/100` only at display
- RLS on every public table — no exceptions
- All AI calls through `src/lib/ai/router.ts` — never direct provider SDKs
- Every AI-output row carries `prompt_version`
- Every import table has `content_hash` UNIQUE
- Cron routes require `Authorization: Bearer $CRON_SECRET`
- Secrets are server-side env vars only — never `NEXT_PUBLIC_` / `VITE_` prefix
- Two Supabase projects: dev `ymgbjtgczgnooscigplb` (default for AI work) + prod (founder flag required)

For the full rule contract: read **`.claude/CRITICAL.md`** first; load `.claude/rules/<rule>.md` for the deep dive.
