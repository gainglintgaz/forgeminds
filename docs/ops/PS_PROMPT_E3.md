# PS Claude kickoff — Slice E3 (WF2 outputs: charts + social drafts + video prompts, Pipedream parity)

> Build session. RUN AFTER the H1 build lands (H1 touches generate/scorer/curator — same files).
> PREREQUISITE READ: docs/ops/PIPEDREAM_PARITY_REFERENCE.md — the founder's 2026-07-09 verdict
> (E1/E2 brief LOST to Pipedream) + the exact output contract to hit. That doc is the spec.

```
ROLE: Implementation session for ForgeMinds slice E3 (WF2 outputs, proven LOCALLY). Model: Sonnet.
Read FIRST: docs/ops/PIPEDREAM_PARITY_REFERENCE.md (the benchmark + founder corrections),
docs/architecture/v1-execution-plan-2026-07-08.md (E3 + Global Constraints),
docs/architecture/curation-hardening-vra.md (H1 — landed; compose with its budget cap + injection
firewall, don't conflict), docs/architecture/insight-layer.md (I1 — if founder has approved, fold
Tier A [causal-why prompt] + Tier B [deterministic stats] into this slice's generate work; if NOT
yet approved, build E3 without them and leave clean seams).
Dev Supabase ymgbjtgczgnooscigplb ONLY; NEVER read .env* (CRON_SECRET via node --env-file pattern,
never printed). Build ONE slice, then STOP.

GOAL: the brief becomes a PACKAGE that matches or beats the founder's Pipedream approval email —
per-story: source link, X posts (analytical+witty), Facebook posts (analytical+witty), video
prompt + subtitles + overlay (top stories), chart PNG, STORY-TIED market data table. This is the
slice the founder's FAIL verdict named; E6 dogfood cannot pass without it.

THE WORK (per plan E3 + founder corrections):
1. FOUNDER CORRECTION FIRST — story-tied market data only. generate currently renders an "Equity
   Snapshot" of the full watchlist regardless of story relevance ("basically useless... I don't
   need unrelated equity snapshot"). Render market data ONLY for tickers the curated stories are
   about. The E2 watchlist-union in curate may remain for enrich coverage, but generate's rendered
   output must be story-scoped. Kill the unrelated dump.
2. Charts: Recharts component (web brief) + QuickChart PNG (email) from ticker_data.intraday_json
   (data exists). Match the Pipedream chart spec (line + range band + open reference, green/red by
   direction, title with price+change) — see the reference doc.
3. Social drafts: ≥1 X post pair (analytical+witty) + ≥1 FB post pair per top story, generated in
   the pipeline (not the dead manual endpoint), using the VOICE RULES in the reference doc
   (banned-word list, third person, ≤2 numbers, no hashtags). Each draft: prompt_version +
   sources[] + substring anti-fabrication gate (brief-validation.ts) + stored in content_drafts
   with provenance. Surface in brief UI + email with the existing Draft approve gate (actions
   design) — never auto-post.
4. Video prompts: port the Grok Imagine prompt formula from the reference doc (scene formula,
   camera rotation, narration 25-40 words, subtitles pipe-format, overlay suggestion, style tips)
   for top ~3 stories. Copy-paste blocks, no video API calls.
5. Source links: every rendered story links to its raw_articles.url.
6. Deliver: email embeds chart PNGs + drafts + video prompts + story-tied market tables.

CONSTRAINTS: Layer-1 stays finance-agnostic (the video/social generators are Layer-2 content-pack
prompts behind config, not hardcoded finance logic in shared code). All AI through router.ts,
under H1's daily budget cap. Respect H1's injection firewall delimiters in any new prompt.
tsc 0, lint 0. Avoid done/complete/finished/ship/deploy in commit subjects. Additive migrations
only (content_drafts.provenance etc. per plan E4 §5 if needed early); get_advisors after any
migration. Known hazard: stale-host 'core' contamination rows — filter from verification queries.

VERIFY LOCALLY (dev server may already be running on :3000 — reuse it):
  select count(*) from content_drafts where created_at > now()-interval '48 hours';  -- > 0 auto-produced
  -- read the brief end-to-end: story-tied tables only, charts render, drafts + video prompts present,
  -- every story has a source link, zero unrelated watchlist tickers in the rendered output.
STOP + report: files changed, query output, one full story-package excerpt (post pair + video
prompt + table), pass/fail vs the reference-doc output contract. Founder judges vs Pipedream.
```
