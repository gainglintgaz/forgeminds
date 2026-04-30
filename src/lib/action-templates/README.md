# Action Templates — Phase 1 Stubs

Phase 1 ships 10 templates covering ~70% of common news event types. Each template is a deterministic playbook that:

1. **Declares its triggers** (which event types invoke it)
2. **Declares its data sources** (Layer 1 APIs that ground every claim)
3. **Declares its profile match** (which users are eligible)
4. **Declares its output schema** (what fields AI may populate)
5. **Declares its fact-check rules** (post-generation verification)

## The 10 Phase 1 templates

| # | Slug | Vector | Triggers |
|---|------|--------|----------|
| 1 | `domain_land_grab` | land_grab | product_launch, ipo_funding, acquisition_merger |
| 2 | `position_trade_setup` | investment | earnings_report, product_launch, regulatory_event, market_movement |
| 3 | `content_draft_blog` | content | product_launch, study_research, regulatory_event, ... |
| 4 | `local_real_estate_impact` | local_civic | local_civic_action, regulatory_event |
| 5 | `travel_deal_capture` | travel | route_launch, price_drop |
| 6 | `scholarship_match` | family | scholarship_program, tax_legal_change |
| 7 | `niche_build_opportunity` | build | product_launch, open_source_release, patent_filing |
| 8 | `network_warm_reconnect` | network | executive_change, ipo_funding, acquisition_merger, ... |
| 9 | `consulting_outreach_angle` | consulting | regulatory_event, tax_legal_change, product_launch, ... |
| 10 | `tax_legal_deadline` | legal_tax | tax_legal_change, regulatory_event |

## Implementation status

All 10 are **stubs** as of Phase 0. They define the structure (types, fields, fact-check rules) but the runtime resolvers (Layer 1 API integrations, Layer 4 AI prompts) come in Phase 1.

## Phase 1 build order

1. Build the `runTemplate(template, article, user)` orchestrator
2. Implement Layer 1 API connectors (WHOIS, USPTO, Finnhub, Skyscanner, etc.) one by one
3. Implement Layer 3 profile matching scorer
4. Implement Layer 4 AI synthesis with fact-check verification pass
5. Light up templates one at a time, easiest first (`domain_land_grab` → fewest dependencies)
6. Sync templates to DB on app boot via `seedActionTemplates()`

## Phase 2+ template expansion

Reach ~30 templates by Phase 2, ~80 by Phase 3. Templates can be authored without code changes (DB-only) once the runtime is solid.

## No-hallucination guarantees

Every template MUST have:
- `hallucination_risk` ≤ 2 to ship
- At least one `fact_check_rule` with `on_fail: "block"` for any claim that could mislead a user financially or legally
- `data_sources` with at least one `required: true` source
- `output_fields` schema that AI must conform to (no free-form generation)
