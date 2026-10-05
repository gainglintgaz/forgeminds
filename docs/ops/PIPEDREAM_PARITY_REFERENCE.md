# Pipedream parity reference — the benchmark ForgeMinds must beat (2026-07-09)

> **Founder verdict on the E1/E2 briefs (2026-07-09, verbatim):** "far worse than my Pipedream
> output that has social media post, more market data and charts and graphs and proposed video
> script and proposed short X post and Facebook post and links to original story and source and
> more... they also kind of international surface level everyone knows news and stories...
> [the Equity Snapshot is] basically useless without more details, data, statistics, analysis and
> interpretation. My equity snapshot was also relevant to the story... I don't need unrelated
> equity snapshot if they have nothing to do with stories."
>
> E1's Antarctica/relevance gate passed; the **vs-Pipedream package gate fails** until E3 (WF2
> outputs) + I1 Tier A/B (depth) + the story-tied market-data correction land. This doc distills
> the founder's actual Pipedream workflows (2 workflows, ~10 steps, code reviewed 2026-07-09)
> into the spec E3 must meet or beat.

## Parity table — Pipedream step → ForgeMinds

| Pipedream step | What it does | ForgeMinds status |
|---|---|---|
| fetch_rss_feeds | parallel RSS, URL-keyed dedup, recency window, 15-min cache, **last-known-good fallback** | ✅ ingest/rss.ts (content_hash dedup, recency). ❌ no last-known-good fallback — H1 source_health is the sibling; LKG itself = candidate for H2 |
| fetch_api_news | Finnhub/Benzinga/Alpaca/AlphaVantage parallel + LKG | ✅ ingest fetchers (per-user source-gated) |
| fetch_grok_x_news | Grok X search (aggressively cached, non-blocking) | ❌ not present. PARK — X API pay-per-use possible later; VRA dropped it as redundant noise ($15-50/mo) |
| gather_categorize_news | LLM impact/depth/tone scoring, paywall domain blocklist | ✅ scorer.ts (Haiku, 4-dim + per-user relevance — BETTER: personalized) |
| curate_with_ai | two-pass diverse select, **max_per_entity=1**, earnings cap 4, min viral | ✅ curator.ts post-E1; entity cap lands in H1 (note: Pipedream default 1, ForgeMinds pref default 2); earnings cap ≈ category caps |
| enrich_tickers | alias map + $TICKER regex + Finnhub lookup + learned-tickers store | ✅ E2 (scorer extraction + entities resolver, UUID-strict) |
| tickers_data | price/change/volume/52w/PE + **interpretation strings** (valuation label, cap label, near-high/low) | ✅ enrich (S3). Interpretation strings exist but are THIN vs founder's need — I1 Tier A/B deepens |
| generate_charts | Alpaca intraday 5-min candles → QuickChart PNG (line + range band + open ref, up/down color) | ❌ **E3 build** — Recharts (web) + QuickChart PNG (email) per approved plan; intraday JSON already persisted |
| generate_video_script | Grok Imagine video prompts + subtitles + overlay + style tips + X/FB posts (analytical + witty) | ❌ **E3 build** — port the prompt formula + voice rules below near-verbatim as a Layer-2 content pack |
| generate_posts + approval email | per-story card: posts + approve buttons + charts + **story-tied market table** + source links + runtime breakdown | ❌ **E3 build** — ForgeMinds has the Approve gate in the actions design (full-os-phase-1-actions.md); render in brief + email |

## The output contract E3 must hit (from the founder's real approval email)

Per curated story:
1. **Source link** — every story links to the original article (raw_articles.url exists; must render).
2. **X posts ×2** — `[analytical]` + `[witty]`, ≤270 chars, ≤1 number, ≤1 cashtag, no hashtags, no first person, don't start with ticker.
3. **Facebook posts ×2** — analytical 100-180 words / witty 60-120 words, ≤2 numbers, third person, short paragraphs.
4. **Video prompt** (top-N stories) — Grok Imagine copy-paste block, 50-90 words: `[realistic static-environment scene] + [ONE camera move] + [lighting/mood matched to sentiment] + [Narrator says: "25-40 word fast fact-dense voiceover"] + [Background: audio] + "Cinematic realism, 9:16"`. Rules: grounded real-world settings (no holograms/sci-fi), camera moves not object physics, ONE continuous shot, NO on-screen text (AI garbles it), never invent specific fictional scenes. Rotate camera styles: aerial descent / dolly forward / steadicam glide / crane rising / low-angle tracking / static zoom.
5. **Subtitles** — the narration verbatim, pipe-separated 4-7-word lines, ONE all-caps word per line.
6. **Overlay suggestion** — max 5 words, the single most impactful datum ("ETH $1949 (-1.61%)").
7. **Market data table — STORY-TIED ONLY** (founder correction): only tickers the story is about; price/change/volume/52w range + interpretation line. NO unrelated watchlist dump in the rendered brief. (The E2 watchlist-union may still feed enrich; generate renders only story-relevant tickers.)
8. **Chart PNG** per story-ticker (top ~3), inline in email.
9. **Runtime breakdown** header (per-step timings) — ForgeMinds equivalent: pipeline_runs timings; nice-to-have.

## Voice rules (port verbatim — they're good)

Banned words: amid, boasts, robust, landscape, notably, signaling, positioning, driven by, fueled by,
structural reset, key data, aligns with, underscoring, despite strong, pressuring valuations,
implications for, highlights, prevails, significant turbulence, experienced significant, mismatch,
surges on, failed to lift, exceeding forecasts, typically signals.
Never: first person, hashtags, CTAs, profanity/slang, >2 numbers per post.
Self-check: "reads like Reuters wire → simplify; reads like Reddit → professionalize."

## Depth corrections (beyond parity — why Pipedream still won on substance)

- **"Surface level everyone-knows news"** — story SELECTION depth. Levers: source pool (add
  higher-signal analysis feeds vs headline wires), scorer depth_score weighting, min floors.
  Note the Pipedream paywall paradox: it BLOCKS wsj/bloomberg full-text; ForgeMinds only uses
  RSS title+summary, so those feeds are usable — but summaries alone may be producing the
  shallow feel. Consider full-text extraction where permitted (VRA: best-effort with
  extraction_status; licensing wall applies only if ever redistributed publicly).
- **"Why it moved + so-what"** — I1 Tier A (causal grounding from article text) + Tier B
  (52w position, valuation vs own history, vol context, next earnings date — statistics, not
  directives). The flat "AAPL down 1.52%" line without cause is the exact anti-pattern.
- **Charts/graphs** — non-negotiable for parity (E3).

## Pipedream subscription decision (founder question)

Keep paying UNTIL: (a) ForgeMinds E6 dogfood passes (Global Constraint 5 — it's the benchmark
AND the safety net), and (b) VRA Briefing-v2 Phase B parity ships (VRA D3 says the same). One
subscription serves both gates; FinKeel/EaseAway don't use Pipedream. Cancel at the later of the
two. Do not cancel before — it is currently the founder's only working daily finance brief.

## Cross-pollination log (VRA ↔ ForgeMinds, reviewed 2026-07-09)

Adopted into ForgeMinds: two-pass diversity + entity cap (H1), source_health + loud degradation
(H1), injection firewall + key scrub (H1), video-prompt formula + voice rules (E3), story-tied
market tables (E3), statistics-not-directives framing (I1 Tier B), banned-phrase compliance lint
(E3 + parked landing rework), "honesty/LOCKED as brand" (parked, IDEAS_BACKLOG).
Parked for ForgeMinds: audio/TTS script (VRA E2 pattern — IDEAS_BACKLOG), X API source
(pay-per-use), FFmpeg auto-mp4 (VRA E3b), last-known-good ingest fallback (H2 candidate).
ForgeMinds → VRA: task-routed AI router pattern; strict UUID entity resolution; per-user
config spine (only if VRA ever goes multi-user/hosted P3+).
