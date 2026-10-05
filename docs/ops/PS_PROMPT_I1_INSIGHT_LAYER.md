# PS Claude / Codex kickoff — Slice I1 probe (insight & decision-support layer)

> DESIGN-ONLY session (architect-first). Produces docs/architecture/insight-layer.md; writes ZERO code.

```
ROLE: Architect-probe session for ForgeMinds slice I1 (insight & decision-support layer). NO CODE —
output is docs/architecture/insight-layer.md ("Foundational scope: feature"), then STOP and await
the founder's "build approved".

VERBATIM FOUNDER REQUEST (2026-07-09): "these numbers and analysis need to expand include more
insights and analytics etc because it doesn't really tell me why it went up or [down] and whether it
presents a good opportunity to standby or be on a watch or actually buy or sell or hedge or do
options, etc and how to trade... can any of this be built as an extra or spinoff or just for me (it
can be opinion or insight, doesn't have to be full blown advice)... remember this app is not just
for me or not even just for finance, i'm just testing it on investment/finance/trading hobbies —
this app is no one size fits all."

Read FIRST: docs/architecture/forgeminds-v1-finance-core.md §1 (Layer-1/Layer-2 boundary),
docs/architecture/full-os-phase-1-actions.md (the approved Analyze action + resolveActionConfig),
supabase/migrations/20260613000005_analysis_lenses.sql (existing lens table + seed),
src/app/api/cron/generate/route.ts + src/lib/pipeline/brief-validation.ts (substring gate),
.claude/rules/ (compliance/§3.2 financial-advice copy, ai-native Truth Shield, data-integrity DMG),
docs/architecture/curation-hardening-vra.md (H1 — pending approval; I1 must not conflict).
Dev Supabase ymgbjtgczgnooscigplb ONLY; NEVER read .env*.

DESIGN THE THREE-TIER SPECTRUM (the framing is locked; the probe designs the implementation +
draws the exact regulatory boundary):

- TIER A — causal "why" grounding. generate currently states price/%/PE facts with no cause. The
  curated articles usually CONTAIN the cause. Design: prompt change instructing generate to connect
  each entity's data to what the curated story text actually says (earnings, guidance, macro, sector
  move) — fact-grounded, substring-gate compatible, zero new schema. Recommend sequencing: this
  tier likely ships BEFORE E6 dogfood (it improves the brief being judged vs Pipedream) — confirm
  or refute with reasoning.

- TIER B — decision-support statistics ("statistics-not-directives"). Position in 52w range,
  valuation vs own history, realized volatility context, next earnings date, factual levels
  ("52w high at X"). Data mostly exists in ticker_data (Finnhub metric/profile2, intraday). No
  imperatives, no predictions, no price targets. Design what renders where (brief prose vs a
  stats block), DMG gating (what minimum data before a stat renders — data-integrity.md), and
  the disclaimer wrapper (ai-native.md SS4.2).

- TIER C — personal opinion/insight lens ("what I'd watch; what a hedge here would look like").
  Per-user OPT-IN lens, OFF by default, personal-use posture. The Domain Expert persona MUST do
  real regulatory-boundary work here, not hand-wave: publisher's exclusion contours; the RIA
  trigger triad (personalized advice + compensation + regular business); how clearly-labeled
  "scenario/educational" tools position themselves; EXACTLY what changes if ForgeMinds ships
  publicly (Tier C locked/dark/BYOK for other users pending attorney review — design the gate).
  Every Tier-C output: AI-disclaimer-wrapped, prompt_version + sources[] logged, framed as
  scenario/education, banned-phrase list enforced (guaranteed/price-target/income-promise class).

LAYER BOUNDARY (hard constraint, per the founder's "not one size fits all"): the MECHANISM is
Layer-1 generic — a per-user insight-lens config (reuse analysis_lenses + the E4 Analyze design +
user_preferences; NO parallel knobs, VIBE Rule 55). Finance is merely the first lens pack. The
artifact MUST include at least one worked non-finance lens sketch (e.g. medicine: "what does this
trial phase/result mean"; sports: tactical read) proving no finance logic leaks into Layer-1.

ALSO ANSWER: is Tier C a lens inside ForgeMinds, or the "spinoff/extra just for me" the founder
floated? Recommend one with reasoning (cost of a fork vs a gated lens; the wired-not-orphaned risk
of a spinoff nobody maintains).

CONSTRAINTS: reuse-before-build everywhere; additive-only schema if any; don't touch the 47 empty
tables; sequencing recommendation vs E3-E6 + H1 required; 9-scenario map, two-way traceability for
every displayed stat/insight, explicit [pending] assumptions block, acceptance criteria as runnable
SQL/greps, rollback plan — per architect-first.md §3 template.

Commit the artifact (prefix `docs(arch):`, stage ONLY the new file), then STOP. Await "build approved".
```
