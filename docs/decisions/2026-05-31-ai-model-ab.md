# Decision: AI Model Selection — A/B Test Results

> **Date:** 2026-05-31
> **Method:** Real A/B harness (`scripts/scratch/ab-brief-models-v2.ts`) — 8 models × 4 real-article input sets = 32 live calls against Victor's actual `raw_articles`, using the production `generate-brief` prompt mirrored from `src/app/api/cron/generate/route.ts` @ commit 61728a1.
> **Decided by:** Victor, after reviewing all 32 outputs.

---

## Decisions

| Task | Model | Rationale |
|---|---|---|
| `generate-brief`, `generate-blog`, `deep-analysis` | **claude-sonnet-4-6** (unchanged) | Reliable, balanced voice, $0.011/brief. Already the pin — no change. |
| Heavy-reasoning one-offs (future) | claude-opus-4-8 (reserve) | Best voice but 16× cost for routine briefs. Save for tasks where reasoning is genuinely needed. |
| `score`, `categorize` | **gemini-2.5-flash** (was gemini-2.0-flash) | 2.0-flash returns 404 for new accounts — pipeline was dead. 2.5-flash: cheapest clean option, zero fabrication. |

## Disqualified for brief synthesis (with evidence)

- **Perplexity sonar** — FABRICATED. Added "Uganda", "Ituri Province", "8 lab-confirmed cases", "no travel restrictions", `[1][4]` citation markers — none in the source articles. Search-grounded models pull live web facts; unfit for paraphrase-only synthesis. (Fine for its real job: research/search.)
- **Gemini 3.5 Flash** — BROKEN. Truncated / leaked reasoning on 3 of 4 runs (raw HTML fragments, `"6. Verify Constraints:"` leaked into output). Thinking model; maxOutputTokens consumed by reasoning. Would need `responseMimeType: application/json` + thinking-budget config to be usable.
- **Grok 4.3** — flat affect, slowest (20–34s), and narrated its own instructions verbatim ("Short sentences track each item by numbers and locations only").
- **GPT-5.5** — most expensive ($0.044/brief = 4× Sonnet), slow, gimmicky (overdoes the engineer metaphor: "incident queue", "error logs", "logging errors loudly").

## Cost per brief (measured)

| Model | $/brief | ~$/mo @ 1k users × 30 briefs |
|---|---|---|
| Perplexity (disq) | $0.0011 | — |
| Gemini 2.5 Flash | $0.0016 | ~$48 |
| Grok (disq) | $0.0021 | — |
| Haiku 4.5 | $0.0025 | ~$75 |
| **Sonnet 4.6 (chosen)** | $0.0113 | ~$339 |
| Opus 4.8 | $0.0273 | ~$819 |
| GPT-5.5 (disq) | $0.0442 | ~$1,326 |

## Architecture decisions

- **No multi-model pipeline now.** Single-call Sonnet output is already clean + on-voice. A 4-stage pipeline would 4× latency + failure points to solve a problem that mostly isn't there. Parked as a future option "where it makes sense and is needed" (Victor, 2026-05-31).
- **Fabrication defense = code-level, not an agent.** The only real quality failure was Perplexity (a search model). Add a cheap proper-noun/number substring check to brief generation per the no-hallucination rule — defense in depth, not a pipeline. Deferred as a small scoped item.

## Scratch harnesses (research tools, in `scripts/scratch/`)

- `ab-smoke-test.ts` — per-provider key + auth + model-string validator
- `ab-brief-models.ts` — 2-candidate version
- `ab-brief-models-v2.ts` — 8-model × 4-input matrix

Kept for re-running when new models ship. Not production code.
