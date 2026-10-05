# PARKED Spec — Search-as-a-Source (ForgeMinds)

> **Status:** 🅿️ PARKED — gated behind Phase 2.6 alpha green-light. NOT pulled forward.
> **Why parked:** `CURRENT_SPRINT.md` locks Phase 2 to closed-alpha-prove-the-loop. New source types are Phase 3+ (gated on alpha proof). This spec is captured now (specs aren't gated, only builds) so the design is ready when the gate opens.
> **Author:** Claude Opus 4.8, 2026-05-30. Triggered by: "fill the 'no RSS feed exists for my niche' gap" + reuse-before-build directive.

---

## §1 — The gap this closes

ForgeMinds ingest supports **6 source types, all finance-tilted**: `rss, alpaca, alpha-vantage, benzinga, coingecko, finnhub`. There is **no general search/discovery source**. This breaks for the majority of intended users (Rule 56): a medicine researcher, a historian, a poet — most don't know which RSS feeds exist for their niche, and many niches have no clean feed at all. The conversational onboarding (Phase 1.5) can *suggest* catalog sources, but if nothing in the 218-row catalog covers "wastewater epidemiology in Southeast Asia," the user is stuck.

**Search-as-a-source = a query becomes a source.** The user (or the AI onboarding agent) saves a *search query* as a source row; ingest runs that query against a search API and pulls fresh matching articles each cycle.

## §2 — Reuse-before-build: provider options

| Provider | Cost model | Reuse fit | Recommendation |
|---|---|---|---|
| **Google News RSS** (`news.google.com/rss/search?q=`) | **Free** | Returns an RSS feed → **reuses the existing `rss.ts` ingester almost as-is** | ✅ **Start here.** Near-zero build: a search query becomes a Google-News-RSS URL, ingested by code that already exists. |
| **GDELT 2.0 Doc API** | **Free** | Global news, JSON, very broad | ✅ Strong free second source for non-US / non-English breadth |
| **Brave Search API** | Free tier + paid | General web, privacy-first, JSON | 🟡 Power tier — when users need beyond-news web results |
| **SerpAPI** (Google/News/Scholar engines) | Paid per search | Most structured, Scholar for academics | 🟡 Paid power tier — gate by user (lessons-critical #98) |

**Recommended path (assumption — override if wrong):** Free-first. Phase A = Google News RSS + GDELT (both free, Google News reuses `rss.ts`). Paid providers (Brave/SerpAPI) become a later opt-in "power source" tier only if alpha users hit the free ceiling. This keeps per-user cost at $0 for the common case and respects the "single-shared-key burns quota" lesson.

## §3 — The one genuine design decision (for when this unparks)

**Per-user cost gating.** The moment a paid search provider enters, every user's cycle could trigger billable searches. Per lessons-critical #98, fetchers must fire **only for source types the user actually has**, and paid-search must additionally check a per-user monthly budget before calling. Free providers (Google News RSS, GDELT) sidestep this entirely — another reason to start free.

## §4 — Senior Council (abbreviated — full pass at unpark)

- **Architect:** A search-source is a new `sources.type = 'search'` row whose `config` holds the query + provider. Ingest dispatcher routes `search` rows to a new `ingest/search.ts` that (for Google News) builds an RSS URL and **delegates to existing `rss.ts`**. Minimal new surface.
- **Engineer:** Dedup via existing `content_hash` UNIQUE (already on `raw_articles`). Query → URL is pure + testable with a fixture (no live call in unit tests).
- **Security:** Search terms only to the API — never user identity (privacy.md). Validate returned URLs before they reach briefs (the HuntHive URL-validator pattern, hostile-architect §1.6 — shared with the Shopping integration logged in HuntHive's backlog).
- **Data Citizen:** Each article keeps `source_kind='search'` + the originating query as provenance, so "why is this in my brief?" → "matched your saved search 'X'."
- **Product:** In onboarding, when the AI agent finds no catalog source for a stated interest, it offers "track a live search for '<topic>'?" — turning a dead end into a runway (Rule 56).

## §5 — Why this is parked, not built

Building it now would violate the locked sprint (Phase 2 = prove the loop with existing sources, not add modules). It unparks at Phase 2.6 green-light, or earlier only with an explicit `DECISIONS.md` entry. Added to `IDEAS_BACKLOG.md` as a gated Phase-3 item.

---
*This is a design capture, not a build authorization. No code until the gate opens AND a founder "build approved".*
