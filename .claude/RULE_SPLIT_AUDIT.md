# Rule-File Split Audit — 2026-05-18

Pre-split footprint: **3,088 lines auto-loaded per turn ≈ 62K tokens** (lines × 20-char/token proxy).

## Triage decisions

| File | Lines | Tier | Reason | Notes |
|---|---:|:---:|---|---|
| `CLAUDE.md` | 280 | merge | Slim to ~30-line pointer; project-specific conventions stay; rest folds into CRITICAL.md | Project description, schema choices, top-level constraints |
| `vibe-standard.md` | 189 | **A** | The 60 numbered rules — actively cited at every commit; mechanical tripwires (Rules 35, 50, 52, 53, 54, 59) | Stay at `rules/` |
| `data-protection.md` | 268 | **A** | Destructive-op gate, two-env minimum, token tier system, recovery runbook — non-negotiable on every DB touch | Stay at `rules/` |
| `privacy.md` | 96 | **A** | PII-to-AI API boundaries, VITE_ rule, RLS audit, account-deletion checklist — every feature touching user data | Stay at `rules/` |
| `data-integrity.md` | 196 | **A** | Data Maturity Gate (DMG), AI input gate, prompt_version audit — required on every smart feature | Stay at `rules/` |
| `mcp-tools.md` | 71 | **A** | Connected MCP catalog — referenced when picking tools; short enough to keep loaded | Stay at `rules/` |
| `execution.md` | 241 | **A** | Phase 0-7 workflow, Phase 0 probing, AUDIT GATE block format | Stay at `rules/` |
| `hostile-architect.md` | 153 | **A** | 8-phase pre-build stress test + QA matrix; runs on every blueprint | Stay at `rules/` |
| `consulting.md` | 98 | **B** | Service tiers, GTM strategy — **irrelevant to ForgeMinds product work** (consulting business unit) | Move to `reference/` |
| `data-flywheel.md` | 507 | **B** | Narrative + Postgres-shaped schema patterns + worked examples — load when designing contribution UX, not every turn | Move to `reference/` |
| `lessons.md` | 158 | **B** | 100+ narrative lessons; reference material, not active tripwires (the tripwires made it into vibe-standard.md) | Move to `reference/` |
| `stack-optimizer.md` | 152 | **B** | Only used at Phase 1.5 stack evaluation; ForgeMinds stack is locked | Move to `reference/` |
| `self-reflection.md` | 161 | **B** | End-of-session meta-protocol; not active during build | Move to `reference/` |
| `ai-first-principles.md` | 234 | **B** | 5-question audit + Trust Ladder — runs at phase close, not every turn | Move to `reference/` |
| `aggregate-design.md` | 284 | **B** | Cohort design rules — only triggered when emitting cross-user aggregates (Phase 8+, not current) | Move to `reference/` |

## Tier-A retention summary

| File | Lines |
|---|---:|
| `vibe-standard.md` | 189 |
| `data-protection.md` | 268 |
| `privacy.md` | 96 |
| `data-integrity.md` | 196 |
| `mcp-tools.md` | 71 |
| `execution.md` | 241 |
| `hostile-architect.md` | 153 |
| **Subtotal** | **1,214** |

## Tier-B move summary

| File | Lines |
|---|---:|
| `consulting.md` | 98 |
| `data-flywheel.md` | 507 |
| `lessons.md` | 158 |
| `stack-optimizer.md` | 152 |
| `self-reflection.md` | 161 |
| `ai-first-principles.md` | 234 |
| `aggregate-design.md` | 284 |
| **Subtotal** | **1,594** |

## Expected post-split footprint

| Component | Lines | Tokens (proxy) |
|---|---:|---:|
| `CLAUDE.md` (slim pointer) | ~30 | ~600 |
| `CRITICAL.md` (merged digest of Tier-A tripwires) | ~700-900 | ~14-18K |
| `rules/` (7 Tier-A files, unchanged) | 1,214 | ~24K |
| `rules/reference/` (Tier-B, on-demand only) | 1,594 | not auto-loaded |
| **Auto-loaded total** | **~1,944-2,144** | **~39-43K** |

**Saving: ~62K → ~40K per turn = ~22K tokens saved (~35% reduction).**

The reduction comes entirely from `rules/reference/` no longer being auto-loaded. `CRITICAL.md` lives alongside the Tier-A files as a high-density quick-reference; it duplicates a small amount of Tier-A content (the tripwires that fire most) but its purpose is to give a fast, scannable overview when the full rule set isn't needed.

## Cross-reference impact

Files at `.claude/rules/<filename>.md` that get moved will need cross-references updated in:
- Each Tier-A file (some cite Tier-B files by relative path)
- `CLAUDE.md` §15 (currently lists all auto-loaded rules — collapses to just the 7 Tier-A names)
- Any project doc that grep returns

Grep audit runs in Step 4.
