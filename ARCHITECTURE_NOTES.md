# ForgeMinds — Architecture Notes

Living document for design decisions, patterns, and gotchas. Updated as we learn.

---

## The 4-Layer No-Hallucination Architecture

```
Layer 1: REAL DATA SOURCES (no AI)
    Wikidata, Finnhub, SEC EDGAR, WHOIS, USPTO, LinkedIn, county records, etc.
    Cached in data_source_cache. Single-source-of-truth for facts.

           ↓

Layer 2: ACTION TEMPLATES (human-authored)
    ~80 templates declaring: triggers, required data sources, profile match,
    output schema, fact-check rules. AI never invents templates.

           ↓

Layer 3: PROFILE MATCHING (deterministic scoring)
    Match user's User Profile + Context Matrix + Voice DNA + past behavior
    against template's `applies_to_*` rules. Output: ranked template list.

           ↓

Layer 4: AI SYNTHESIS (paraphrasing only)
    Claude/Gemini reads facts from Layers 1-3 and composes user-facing text.
    Post-generation fact-check verifies every claim against Layer 1 sources.
    Unverifiable claims STRIPPED before display.
```

Hard rules:
- AI NEVER invents prices, dates, names, jobs, domains, people, events
- Every claim has a source citation in `action_template_runs.resolved_data`
- `fact_check_passed = false` → output not shown
- `hallucination_risk` ≤ 2 to ship a template

---

## Pipeline State Machine

```
raw_articles.pipeline_status:
    fetched → scored → curated → enriched → generated → delivered
                     ↘ rejected
                     ↘ archived
```

Each cron function reads articles at expected input status, processes, advances. Crash-safe by design — restart picks up where it left off.

---

## Cost Routing Tiers

| Layer | Default Model | Cost (per 1M tokens) | When |
|-------|---------------|---------------------|------|
| Score (bulk) | Gemini 2.0 Flash | $0.075 | Every article, every fetch |
| Curate (light) | Local heuristics + Gemini Flash fallback | ~$0 / $0.075 | Every batch |
| Enrich (data) | Direct API calls (Finnhub, etc.) | $0 | Every article |
| Generate (content) | Claude Haiku | $0.80 | Daily briefs |
| Generate (deep) | Claude Sonnet | $3.00 | User-triggered Tier 2 |
| Research (live) | Perplexity Sonar | $3.00 | User-triggered Tier 2 |
| Embed (semantic) | OpenAI text-embedding-3-small | $0.02 | Per new Brain item |

Per-user monthly cost (target): <$2 for Builder, <$8 for Architect.

---

## Multi-Vector Action Engine — 14 Vectors

| Vector | Purpose |
|--------|---------|
| investment | Stock/crypto/options/ETF positioning |
| build | SaaS, app, plugin, library opportunities |
| content | Blog, social, video, podcast, newsletter |
| network | LinkedIn, communities, conferences |
| learn | Courses, certs, content gaps |
| consulting | Client outreach, workshops, speaking |
| land_grab | Domains, trademarks, social handles |
| local_civic | Property, zoning, council, real estate |
| family | Education, scholarships, kids |
| travel | Routes, prices, family trips |
| health | Studies, doctor visits, family medical |
| career | Hiring signals, comp, talent flow |
| sports_fantasy | DFS, fantasy, betting, hot takes |
| legal_tax | Deadlines, advisory, regulatory |

Each user sees only vectors that match their profile + goals. A consultant sees consulting + content + investment. A parent sees family + education. A day trader sees options + technicals.

---

## Multi-Tenant SaaS Architecture

- Every table has `user_id UUID REFERENCES auth.users(id)` and RLS policy `USING (user_id = auth.uid())`
- `service_role_key` bypasses RLS for cron jobs and admin operations
- Reference data (entities, paywall_sources, action_templates, geographies) is `public read` for authenticated users
- Collective tables (collective_signals, outcome_aggregates) are `authenticated read` only — anonymized

---

## Geographic Intelligence — Multi-Scale

Hierarchy: zip → city → county → metro → state → country → continent → global
Stored in `geographies` table with parent_id for tree traversal.

User declares anchors in `user_geographies`:
- 'home' — primary residence
- 'business' — workplace / company HQ
- 'investment' — properties or watchlists elsewhere
- 'family' — relatives, in-laws
- 'travel' — destinations of interest

Articles tagged in `article_geographies` with relevance scores.

Action templates with `geographic_anchors` match: only fire for users whose anchors overlap.

---

## Paywall Strategy — Three Tiers

1. **BYOS (Bring Your Own Subscription)**
    - User stores credentials in `external_subscriptions` (pgcrypto-encrypted)
    - Article fetcher uses user's session cookies / OAuth
    - Cost to platform: $0
    - Legal: user uses own licensed access

2. **Platform-Licensed (bundled in tier)**
    - ForgeMinds licenses Reuters, AP, etc. at company tier
    - Architect tier gets access to bundled premium content

3. **Pro Research Add-On (Bloomberg-grade)**
    - $99-199/mo add-on for power users needing Bloomberg/Refinitiv
    - Optional, rarely needed at $14.99 Builder tier

---

## Event Chain Detection

Real-world action sequences detected from real data sources only.

Pattern definition (`event_chain_patterns`):
- trigger_event_type (e.g., `local_civic_action`)
- consequence_event_types (e.g., `[real_estate_transaction]`)
- time_window_days
- geographic_scope (`same_county`, `5mi_radius`, etc.)
- verification_sources (must include real data feeds)
- min_signal_strength

Detected chain (`event_chains`):
- trigger_article_id → consequence_article_ids
- verified_data: actual numbers (homes purchased, total $ value, etc.)
- data_sources_used: which APIs backed each claim
- visible_to_users: precomputed from geography overlap

CRITICAL: Never fabricate the consequence. Only show chains where consequence events are real and verifiable.

---

## Noise Control — Three Layers

1. **`notification_preferences`** — explicit user settings (cadence, density, quiet hours, channels, tone)
2. **`user_filter_preferences`** — explicit mute/boost/snooze rules (per topic/source/entity)
3. **`engagement_decay`** — auto-learned from dismiss patterns (5 dismissals → suppression score)

Onboarding ramp:
- Week 1: 1 brief/week, 5 stories
- Week 2-3: 3x/week, 7 stories (if engagement is healthy)
- Week 4+: User's chosen cadence

---

## Build Kick-Off Package — Anatomy

When user clicks "I want to build this":

1. Pick or auto-suggest a `kickoff_template` (e.g., `nextjs_supabase_vercel`)
2. Generate personalized artifacts:
   - `claude_md` — project instructions for Claude Code
   - `feature_backlog` — V1 backlog with priorities
   - `current_sprint` — what to build first
   - `master_prompt` — paste-into-Claude-Code single prompt
   - `env_example` — required env vars with comments
   - `setup_commands` — ordered list of CLI commands
3. Pull tool selections + cost estimates from `tool_capabilities`
4. Pull capability warnings ("can't scrape Amazon") from `tool_lessons_learned`
5. Export as ZIP / GitHub gist / GitHub repo template

Output: user has a complete starter kit they can hand off to Claude Code, Cursor, Lovable, or any AI tool — and the receiving tool has full context.

---

## Tool Capability Registry — Honest Reality

`tool_capabilities` is the honest source of truth for what works:
- `fully_supported`, `partially_supported`, `workaround_required`, `not_supported`, `forbidden`

`tool_lessons_learned` captures battle scars from VictorForge projects:
- HuntHive: Amazon scraping (forbidden), Lovable v1+ complexity (workaround)
- FinKeel: OAuth fresh-tab test, verify_jwt=true on destructive endpoints
- Pipedream: 256MB ceiling on complex flows

Every Build Kick-Off Package includes warnings and workarounds sourced from this registry.

---

## Collective Intelligence Moat

```
User action → outcome reported → action_template_runs.realized_value_cents
                                              ↓
                                     anonymized + clustered
                                              ↓
                              outcome_aggregates (precomputed monthly)
                                              ↓
                       template_effectiveness (per profile cluster)
                                              ↓
                  shown to next user: "73% of similar users took this,
                                       avg $147 outcome over 90d"
```

Moat layers:
- Outcome dataset: 12+ months to replicate
- Event-action pairings
- Local intelligence aggregate (per-geography network effect)
- Voice DNA aggregate (anonymized engagement patterns)
- Trend lead-time signal (clusters save weeks before mainstream)
- Template effectiveness (continuous A/B refinement)

---

## What ForgeMinds Will NOT Do (Hard Lines)

- Execute trades, transfers, or payments without per-action user approval
- Post to social platforms without user approval (until Trust Escalation explicitly allows)
- Scrape sites that ban scraping (Amazon, Walmart, LinkedIn without OAuth)
- Generate content with unverifiable claims
- Promise outcomes ("you WILL make $X")
- Train external LLMs on user data without explicit opt-in
- Sell user data
- Build hardware, manufacture physical goods, ship rockets

---

## Schema Canonical Names Reference

**Why this section exists:** Phase 0 audit (2026-04-29) found 6 broken API routes because auto-scaffolded code referenced column names from an earlier mock schema. Supabase queries are stringly-typed — TypeScript can't catch column drift. This table is the canonical source of truth. **Use these names by reflex.** When in doubt, run `npm run verify:columns` against live `information_schema`.

### `sources` (RSS/API source registry)

| ✅ Use | ❌ Don't use |
|---|---|
| `is_active` | `enabled`, `active` |
| `type` (rss/api/social) | `kind`, `source_type` |
| `name` | `title`, `display_name` |
| `url` | `feed_url`, `endpoint` |
| `user_id` (NOT NULL) | — |

### `raw_articles` (ingested articles, pre-scoring)

| ✅ Use | ❌ Don't use |
|---|---|
| `summary` | `description`, `excerpt` |
| `raw_metadata` (jsonb) | `metadata`, `meta`, `extra` |
| `pipeline_status` (enum) | `status`, `state` |
| `published_at` | `pub_date`, `published` |
| `user_id` (NOT NULL — system UUID `00000000-0000-0000-0000-000000000000` for shared pipeline) | — |

### `scored_articles` (post-scoring output)

| ✅ Use | ❌ Don't use |
|---|---|
| `article_id` | `raw_article_id` |
| `created_at` (for time filtering) | `scored_at`, `fetched_at` |
| `relevance_score`, `impact_score`, `novelty_score`, `credibility_score`, `composite_score` | `depth_score`, `viral_score` |
| upsert onConflict: `"article_id,user_id"` | `"raw_article_id,user_id"` |

### `briefs` (curated daily briefs)

| ✅ Use | ❌ Don't use |
|---|---|
| `summary_html`, `summary_text` | `body`, `content`, `html`, `text` |
| `article_ids` (UUID[]) | `articles`, `article_list` |
| `ticker_symbols` (text[]) | `tickers`, `symbols` |
| `article_count` | `count`, `num_articles` |
| `categories_covered` | `categories`, `topics` |
| `generation_model` | `model`, `ai_model` |
| `prompt_version` | `version`, `prompt_v` |

### `entities` (canonical entity registry, Wikidata-backed)

| ✅ Use | ❌ Don't use |
|---|---|
| `ticker_symbol` | `symbol`, `ticker` |
| `wikidata_id` (Q-number) | `wiki_id`, `qid` |
| `canonical_name` | `name`, `title` |
| `aliases` (text[]) | `alternate_names`, `synonyms` |

### `pipeline_runs` (cron execution audit log)

| ✅ Use | ❌ Don't use |
|---|---|
| `step_name` | `step`, `phase`, `stage` |
| `run_status` enum: `running`/`completed`/`failed`/`skipped` | `started`, `success`, `error` |
| `items_processed` | `items_in`, `processed` |
| `items_created` | `items_out`, `created` |
| `items_failed` | `errors`, `failed_count` |
| `duration_ms` | `execution_time_ms`, `elapsed` |

### `ticker_data` (Finnhub/market data per day)

| ✅ Use | ❌ Don't use |
|---|---|
| `fetched_date` (generated column from `fetched_at AT TIME ZONE 'UTC'::date`) | `date`, `day` |
| Unique on `(user_id, symbol, fetched_date)` | unique on expression `(fetched_at::date)` (Postgres rejects expressions in table-level UNIQUE) |

### Enum gotchas

- **`news_event_type`** (NOT `event_trigger`) — the original name `event_trigger` collides with PostgreSQL's built-in `event_trigger` type. Renamed across all migrations.
- **`run_status`** values are `running`/`completed`/`failed`/`skipped` — not `started`/`success`/`error`.
- **`pipeline_status`** advances `fetched → scored → curated → enriched → generated → delivered`. Every cron reads expected input status, never invents new values.

### Function namespace gotchas

- `extensions.gen_random_bytes(16)` — NOT `gen_random_bytes(16)`. Newer Supabase moved pgcrypto into `extensions` schema.
- `extensions.uuid_generate_v4()` likewise (or use the SQL standard `gen_random_uuid()` directly).

### Role grants gotcha

After any `drop schema public cascade`, all GRANTs on `anon`/`authenticated`/`service_role` are wiped. Every JS SDK query returns 42501 "permission denied" until role grants are restored. Migration `20260429000000_restore_role_grants.sql` is the canonical fix — re-run after any schema reset.

### Verification

`scripts/verify-columns.ts` greps every `.from("table").select("col,col,...")` call across `src/` and validates each table+column pair against the live schema (queried via service role from Supabase). Runs as part of `npm run verify:phase-0`. Pre-commit hook also runs it on staged files in `src/app/api/` or `src/lib/pipeline/`.

---

## Update protocol

When you make an architectural decision:
1. Add it to `DECISIONS.md` with rationale
2. Update this file's relevant section
3. If it spawns work, add to `IDEAS.md` or `CURRENT_SPRINT.md`
4. If it's a learned lesson, add to `tool_lessons_learned` table once schema is live
5. **If it changes a column name or schema convention**, update the Schema Canonical Names Reference table above — it is the source of truth for future code generation.
