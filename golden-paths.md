# ForgeMinds — Golden Paths

> Proven patterns to reuse. Check this (and `errors-fixed.json`) before building. Append-only; continue the factory `GP-###` sequence.

---

## GP-014: Diagnose an AI pipeline via `pipeline_runs` telemetry before trusting status logs

**Used in:** 2026-06-14 ForgeMinds drawing-board forensics (found the real root cause that the handoff notes missed).

**When to use:** any time an AI/cron pipeline "runs" but the output is wrong, shallow, or suspiciously cheap — before assuming the model or the product is bad.

**The path:**
1. `SELECT step_name, status, count(*), max(started_at), sum(ai_calls_made), sum(items_created), sum(items_failed) FROM pipeline_runs GROUP BY step_name, status` — every step can show `status='completed'` while `ai_calls_made=0` and `items_created=0`. "Completed" ≠ "did its job."
2. Inspect the actual produced rows (`briefs.generation_model`, `scored_articles.diversity_category`, `user_preferences.topics`) against what the UI claims.
3. Compare deployed build vs current code — a wired code path means nothing if a stale build is running or the dispatcher stalled.

**Why it works:** runtime telemetry is ground truth; design docs and "looks wired" code are not. This is the operational form of lesson #104 (runtime-truth Definition of Done) and #108 (verify live DB/telemetry over handoff docs).

---

## GP-015: Strict resolution layer — AI output maps to an existing DB UUID, never invents

**Used in:** designed in `docs/architecture/forgeminds-v1-finance-core.md` to fix the single-`core`-category bug (ERR-021).

**When to use:** any pipeline where an LLM extracts a category, entity, ticker, or tag that must become a typed relation in the database.

**The path:**
1. Pass the model a fixed list of valid IDs/labels (categories, tickers) pulled from the DB.
2. After extraction, resolve the model's text to an existing UUID via an alias table.
3. On an unresolved value: **flag for review, do not blind-insert**; the run fails/retries rather than persisting a hallucinated category.

**Why it works:** AI hallucinates strings; databases require relations. This prevents "everything becomes one `core` bucket" and "AI invents a category." See lesson #105 + VIBE Rule 24 (Invisible Ledger).
