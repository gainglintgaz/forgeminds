# ForgeMinds — 14 Vectors + Subcategories

> **Purpose:** locks in the canonical taxonomy of action vectors used across the source catalog, action templates, user preferences, and Architect+ licensed-data integrations. Future sessions read this; do not re-derive.
> **Last updated:** 2026-05-05.
> **Pairs with:** `AI_FIRST_AUDIT.md`, `DATA_FLYWHEEL.md`, the roadmap plan file (`~/.claude/plans/sparkling-waddling-pinwheel.md`).

---

## Why 14 vectors

The 14 are a curated list — not magic. The constraint for inclusion: every vector must be a domain where

1. Substantial real data flows publicly (so the AI has receipts; data-flywheel.md §1)
2. Deterministic action templates can be authored (4-layer no-hallucination architecture)
3. The user has decision authority — they can vote with money, time, or attention
4. Outcomes are measurable and worth-it can be captured (article_outcomes / template_outcome_reviews)

Could grow to 18-20 over time. Adding a new vector is a config change (a string tag), not a refactor — every Phase 0+ schema is vector-agnostic. Candidates for future addition: philanthropy, creative_arts, spirituality, agriculture, crafts, automotive.

---

## The 14 vectors

| # | Vector | One-line description | Top-3 user goals |
|---|---|---|---|
| 1 | `investment` | Personal capital allocation across asset classes | Find opportunities, manage portfolio, tax-aware exits |
| 2 | `build` | Starting + scaling products / startups / side projects | Find a market, prototype, ship V1 |
| 3 | `content` | Public-facing writing, video, audio, social presence | Build audience, monetize attention, distribute ideas |
| 4 | `network` | Relationship building with peers / mentors / collaborators | Find people, deepen relationships, ask for help well |
| 5 | `learn` | Skill acquisition, formal study, deep-dive interests | Learn faster, retain better, apply learning |
| 6 | `consulting` | Selling expertise as services | Find clients, scope engagements, deliver outcomes |
| 7 | `land_grab` | Real estate, land, scarce-asset acquisition | Spot underpriced inventory, finance, manage |
| 8 | `local_civic` | School boards, zoning, county / state legislative engagement | Track relevant decisions, participate effectively |
| 9 | `family` | Household operations, child + elder care, family finance | Coordinate care, plan for transitions, build traditions |
| 10 | `travel` | Trips: business, family, adventure, learning | Plan well, optimize cost / time, capture experiences |
| 11 | `health` | Preventive + chronic + mental + longevity | Improve outcomes, navigate care system, track interventions |
| 12 | `career` | Job moves, salary, side income, encore careers | Position well, negotiate, transition deliberately |
| 13 | `sports_fantasy` | Sports interest + DFS + betting + fan engagement | Win in fantasy / DFS, follow teams meaningfully |
| 14 | `legal_tax` | Personal legal + tax planning + compliance | Avoid mistakes, optimize structure, file correctly |

---

## Subcategories per vector (~140 total interest tuples)

The source catalog tags each row with `categories: [vector]` + `subcategories: [sub1, sub2, ...]`. Action templates declare `applies_to_vector` + `applies_to_subcategories[]`. User intent extraction (Phase 1.5 onboarding agent) returns `topics[]` that map to these tuples.

### 1. investment
`stocks` · `ETFs` · `crypto` · `commodities` · `forex` · `options` · `real_estate` · `alternatives_pe_vc` · `retirement_401k_IRA` · `fixed_income_bonds` · `derivatives_futures` · `IPO_SPAC`

### 2. build
`SaaS` · `marketplace` · `content_business` · `hardware` · `mobile_app` · `AI_tooling` · `consumer_brand` · `enterprise_software` · `vertical_SaaS` · `dev_tools_devx`

### 3. content
`blog_longform` · `social_X` · `social_LinkedIn` · `podcast_audio` · `video_YouTube` · `video_TikTok_Reels` · `newsletter_email` · `online_course` · `book_print_or_ebook` · `keynote_presentation` · `threads_meta`

### 4. network
`industry_meetups` · `conferences` · `alumni_networks` · `affinity_groups` · `professional_orgs` · `mentor_match` · `board_seats` · `cofounder_search` · `advisor_circles` · `slack_discord_communities`

### 5. learn
`skill_acquisition_practical` · `certifications` · `formal_degree` · `language` · `instrument_music` · `athletic_skill` · `academic_research_deep` · `side_topic_curiosity` · `software_skill` · `soft_skill_communication`

### 6. consulting
`small_biz_advisory` · `fractional_exec` · `vertical_specialist` · `ML_AI_advisor` · `GTM_advisor` · `ops_advisor` · `M_and_A_advisor` · `brand_strategy` · `fundraising_advisor` · `interim_leadership`

### 7. land_grab
`residential_RE` · `commercial_RE` · `raw_land` · `foreclosure_tax_distressed` · `tax_lien` · `zoning_arbitrage` · `opportunity_zones` · `REIT_passive` · `short_term_vacation_rental` · `farmland_timberland`

### 8. local_civic
`school_board` · `zoning_planning` · `county_council` · `state_legislature` · `ballot_initiatives` · `HOA` · `transit_authority` · `public_safety` · `public_health_local` · `environmental_review`

### 9. family
`childcare` · `education_K12` · `college_prep_admissions` · `eldercare` · `healthcare_navigation_family` · `family_finance` · `household_ops` · `kids_activities_extracurricular` · `family_travel` · `traditions_rituals`

### 10. travel
`business_travel` · `family_vacation` · `adventure_outdoor` · `food_tourism` · `cultural_arts` · `spiritual_pilgrimage` · `medical_tourism` · `language_immersion` · `nomad_remote_work` · `reunion_event`

### 11. health
`preventive_screening` · `fitness_strength_cardio` · `nutrition` · `sleep` · `mental_psych_psychiatry` · `longevity_aging` · `chronic_disease_management` · `womens_health` · `mens_health` · `pediatric` · `geriatric` · `dental` · `vision` · `sexual_reproductive`

### 12. career
`job_search_external` · `internal_promotion` · `salary_negotiation` · `side_income_moonlight` · `freelance_independent` · `encore_career` · `entrepreneurship_transition` · `sabbatical` · `retirement_transition` · `executive_coaching`

### 13. sports_fantasy
`NFL` · `NBA` · `MLB` · `NHL` · `soccer_global` · `college_football` · `college_basketball` · `golf` · `tennis` · `F1_motorsport` · `fantasy_DFS` · `sports_betting_legal` · `fan_clubs_supporter_groups`

### 14. legal_tax
`estate_planning` · `business_formation_LLC_corp` · `contracts_negotiation` · `IP_trademark_patent` · `employment_law` · `tax_planning_personal` · `tax_filing` · `audit_defense` · `immigration` · `family_law_custody_divorce`

---

## Status by vector (V1 readiness)

Audit run 2026-05-05.

| Vector | Schema-ready | Catalog seeded | Action templates | Licensed-data layer | V1 ship target |
|---|---|---|---|---|---|
| investment | ✅ | ⏳ Phase 1.5 close | ⏳ Phase 3 (3-5 templates) | 🔜 Phase 7 BYOS / Architect+ | ✅ in V1 |
| build | ✅ | ⏳ Phase 1.5 close | ⏳ Phase 3 (3-5) | 🔜 Phase 7 | ✅ in V1 |
| content | ✅ | ⏳ Phase 1.5 close | ⏳ Phase 3 (3-5) + Phase 5 Voice DNA | 🔜 Phase 7 | ✅ in V1 |
| network | ✅ | ⏳ Phase 1.5+1 | ⏳ Phase 3 (2-3) | 🔜 Phase 7 | partial V1 |
| learn | ✅ | ⏳ Phase 1.5+1 | ⏳ Phase 3 (2-3) | 🔜 Phase 7 | partial V1 |
| consulting | ✅ | ⏳ Phase 1.5+1 | ⏳ Phase 3 (2-3) | 🔜 Phase 7 | partial V1 |
| land_grab | ✅ | ⏳ Phase 2 (state-specific data sources) | ⏳ Phase 3 (1-2) | 🔜 Phase 7 (CoStar / Reonomy) | partial V1 |
| local_civic | ✅ | ⏳ Phase 1.5+1 (state-specific) | ⏳ Phase 3 (1-2) | 🔜 Phase 7 (FiscalNote) | partial V1 |
| family | ✅ | ⏳ Phase 1.5+1 | ⏳ Phase 3 (2-3) | 🔜 Phase 7 (Ancestry / GreatSchools) | partial V1 |
| travel | ✅ | ⏳ Phase 1.5+1 | ⏳ Phase 3 (2-3) | 🔜 Phase 7 (GDS) | partial V1 |
| health | ✅ | ⏳ Phase 1.5+1 (clinician-aware sources) | ⏳ Phase 3 (3-5) | 🔜 Phase 7 (UpToDate / Lexicomp) | partial V1 |
| career | ✅ | ⏳ Phase 1.5+1 | ⏳ Phase 3 (2-3) | 🔜 Phase 7 (LinkedIn Recruiter) | partial V1 |
| sports_fantasy | ✅ | ⏳ Phase 1.5+1 | ⏳ Phase 3 (1-2) | 🔜 Phase 7 (RotoWire) | optional V1 |
| legal_tax | ✅ | ⏳ Phase 1.5+1 | ⏳ Phase 3 (2-3) | 🔜 Phase 7 (Westlaw / Bloomberg Tax) | partial V1 |

**Realistic V1 ship:** investment + build + content + (3 of 4 user-chosen) + 1-2 of remaining 7 active. Architect+ licensed-data layer post-V1.

---

## Architect+ tier — licensed-data integration model

Pricing tier above Architect ($34.99/mo). Per-user-per-vector opt-in. The user only pays for the vectors they actually want professional-grade data for.

### Three modes per provider

| Mode | What it means | When enabled | ForgeMinds margin |
|---|---|---|---|
| **BYOS** | User has their own subscription. ForgeMinds proxies queries via the user's auth. | Whenever user adds credentials — opt-in toggle in Settings. | $0 cost. Charge ~$10/mo per BYOS connection on Architect+ for the integration layer (encryption, rate-limiting, query-log audit). |
| **Resold seat** | ForgeMinds bulk-buys a multi-seat deal; user pays retail + 10-15% markup. | Only after ≥N users have waitlisted AND we've negotiated wholesale ≥30% below retail. | Margin = (retail × 1.10-1.15) − wholesale, after volume discount. Target ≥30% gross margin per seat. |
| **Off** (default) | Provider isn't enabled for this user. Action templates that require it render LOCKED with cost-transparent CTA: *"Connect [provider] (BYOS, $X/mo via your own seat) or join waitlist for Resold ($Y/mo)"*. | Always — until user opts in via either path above. | $0. |

### The non-negotiable rule

ForgeMinds **NEVER pre-pays for any provider** before users have committed money. Every provider goes through these gates before Resold mode opens:

1. ≥10 paying Architect+ users have explicitly toggled "I want this provider" in Settings (creates `user_data_subscription` rows in `auth_mode='resold_waitlist'` state)
2. Cost model worked out: bulk_seat_price × seat_count vs. user_payment × demand → ≥30% projected gross margin
3. THEN we sign the bulk deal

Until those gates fire, Architect+ users with their own subscriptions get immediate value (BYOS path); waitlisted users see honest "23 of 50 needed" copy on their Settings page.

This is the tiered-cohort design rule (factory CLAUDE.md §8) applied to commerce: don't ship aggregate / shared / volume products until enough demand exists for honest pricing.

### Architectural surface (Phase 7+)

Tables (all Phase 7 work — none yet built):

| Table | Purpose |
|---|---|
| `data_providers` | Registry: name, auth_method (oauth/api_key/cookie/scraping), retail_cost_usd_monthly, our_wholesale_cost_usd_monthly, applicable_vectors[], applicable_subcategories[], supported_queries[], status (`available_byos`, `available_resold`, `waitlist_only`, `disabled`) |
| `user_data_subscriptions` | Per-user-per-provider with `auth_mode` enum (`byos`, `resold`, `resold_waitlist`, `off`), encrypted credentials (reuses Phase 0 `external_subscriptions` table for storage), opted_in_at, last_query_at |
| `data_provider_query_log` | Every API call against a licensed source: user_id, provider_id, query_type, cost_usd_imputed, response_size_bytes, ts. Drives BYOS-premium billing + Resold consumption tracking. |

Code (Phase 7+):

| File | Purpose |
|---|---|
| `src/lib/data-providers/types.ts` | Common interface: `getCompanyTearsheet(ticker)`, `getOwnership(ticker)`, `getResearch(query)`, `getCharts(ticker, events)`. Each provider implements the methods it supports. |
| `src/lib/data-providers/{morningstar,pitchbook,bloomberg,...}.ts` | Per-provider clients. Stateless. Take an injected credential bundle (BYOS) or the ForgeMinds resold-seat token. |
| `src/lib/data-providers/dispatcher.ts` | `executeQuery(user, provider, query)` — checks `user_data_subscriptions.auth_mode`, fetches credentials, calls provider client, logs to `data_provider_query_log`, returns result. |

Action template `requires_data_provider[]` field: when a template needs a licensed source, the user's subscription state is checked at run-time. If `off` → render LOCKED state with the cost-transparent CTA above.

---

## Reference

- Architect+ tier idea + cost-recovery model first articulated 2026-05-05 in conversation. Captured in DECISIONS.md.
- Status table re-audited at every phase close (cadence per `AI_FIRST_AUDIT.md` §G).
- Subcategory list is canonical — adding a subcategory anywhere requires editing this file. Source catalog tags must stay aligned.
