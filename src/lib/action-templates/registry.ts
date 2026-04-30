/**
 * ForgeMinds Action Template Registry — Phase 1 Stubs
 *
 * 10 templates covering the most-common event types. Each template is a
 * deterministic playbook with required Layer 1 data sources, profile
 * matching, output schema, and fact-check rules.
 *
 * Hallucination risk = 0 for all Phase 1 templates (every claim backed
 * by live API data).
 *
 * See types.ts for type definitions and CLAUDE.md for the 4-layer
 * architecture rules.
 */

import type { ActionTemplate } from "./types";

// ────────────────────────────────────────────────────────────────────
// 1. Domain Land-Grab — claim domains/handles when a brand launches
// ────────────────────────────────────────────────────────────────────
export const domainLandGrab: ActionTemplate = {
  slug: "domain_land_grab",
  vector: "land_grab",
  triggers: ["product_launch", "ipo_funding", "acquisition_merger"],
  display_name: "Domain & handle land-grab",
  description:
    "When a brand launches a new product or makes a big move, related domains, social handles, and trademark namespaces become valuable for 24-72 hours.",
  match: {
    applies_to_goals: ["build", "side_hustle", "audience"],
  },
  data_sources: [
    { source: "whois_api", purpose: "verify domain availability", required: true, cache_ttl_seconds: 3600 },
    { source: "uspto_tsdr", purpose: "trademark filings last 24h", required: true, cache_ttl_seconds: 21600 },
    { source: "github_org_check", purpose: "GitHub org name available", required: false },
    { source: "social_handle_check", purpose: "Bluesky/Threads/Reddit availability", required: false },
  ],
  output_template: `
    Available domains: {{available_domains}}
    Total cost first year: {{first_year_cost}}
    USPTO filings last 24h: {{uspto_filings}}
    Available handles: {{handles_available}}
    Recommended move: {{action_steps}}
  `.trim(),
  output_fields: {
    available_domains: "List of available domains with prices, max 5, sorted by quality",
    first_year_cost: "Total cost in cents to register all suggested domains for 1 year",
    uspto_filings: "Recent USPTO trademark filings related to the brand/term",
    handles_available: "Social handles still available across major platforms",
    action_steps: "1-3 specific concrete steps the user should take in next 24h",
  },
  fact_check_rules: [
    { field: "available_domains", validator: "whois_match", source_field: "whois_results", on_fail: "strip" },
    { field: "uspto_filings", validator: "uspto_match", source_field: "uspto_results", on_fail: "strip" },
    { field: "first_year_cost", validator: "sum_match", source_field: "domain_prices", on_fail: "warn" },
  ],
  hallucination_risk: 0,
  estimated_effort_minutes: 15,
  estimated_value_cents: 0,
  estimated_value_label: "low_$",
  time_sensitivity_hours: 72,
  status: "draft",
  version: 1,
  notes:
    "Phase 1: lock down the structure. Phase 2: add Cloudflare Registrar one-click registration.",
};

// ────────────────────────────────────────────────────────────────────
// 2. Position Trade Setup — full investment analysis (Tier 2)
// ────────────────────────────────────────────────────────────────────
export const positionTradeSetup: ActionTemplate = {
  slug: "position_trade_setup",
  vector: "investment",
  triggers: ["earnings_report", "product_launch", "regulatory_event", "market_movement"],
  display_name: "Trade setup with options strategy",
  description:
    "Full deep-dive: technicals, options flow, insider activity, sentiment layers, position sizing matched to user risk profile and time horizon.",
  match: {
    applies_to_goals: ["investing", "income", "wealth"],
  },
  data_sources: [
    { source: "finnhub_quote", purpose: "current price + fundamentals", required: true, cache_ttl_seconds: 300 },
    { source: "finnhub_metric", purpose: "P/E, market cap, 52w range", required: true },
    { source: "alpha_vantage_indicators", purpose: "RSI, MACD, EMA, Bollinger", required: true },
    { source: "tradier_options_chain", purpose: "options chain + IV", required: false },
    { source: "sec_form4", purpose: "insider transactions 90d", required: false },
    { source: "sec_13f", purpose: "13F changes last quarter", required: false },
  ],
  output_template: "Multi-section markdown report (see investment depth tier in spec)",
  output_fields: {
    direction: "long | short | neutral with conviction %",
    time_horizon: "day_trade | swing | position | long_term",
    best_vehicle: "stock | call | put | spread | etf | none",
    technical_setup: "pattern + indicators + key levels + stop",
    options_strategy: "specific strikes/expiry/structure if vehicle is options",
    insider_signal: "cluster_buy | cluster_sell | scheduled | none",
    catalysts_30d: "list of upcoming events that could move the price",
    sentiment_layers: "news/social/analyst/options-implied scores",
    position_sizing: "% of portfolio matched to user risk class",
    avoid_if: "trigger that invalidates the thesis",
    double_down_if: "trigger that strengthens the thesis",
  },
  fact_check_rules: [
    { field: "direction", validator: "ticker_exists", source_field: "ticker", on_fail: "block" },
    { field: "best_vehicle", validator: "options_strike_exists", source_field: "tradier_chain", on_fail: "strip" },
    { field: "insider_signal", validator: "form4_match", source_field: "sec_form4_data", on_fail: "strip" },
  ],
  hallucination_risk: 0,
  estimated_effort_minutes: 60,
  estimated_value_label: "med_$$",
  time_sensitivity_hours: 168,
  status: "draft",
  version: 1,
};

// ────────────────────────────────────────────────────────────────────
// 3. Voice-Matched Content Draft — blog post in user's voice
// ────────────────────────────────────────────────────────────────────
export const contentDraftBlog: ActionTemplate = {
  slug: "content_draft_blog",
  vector: "content",
  triggers: [
    "product_launch", "earnings_report", "study_research",
    "regulatory_event", "open_source_release", "cultural_moment",
  ],
  display_name: "Voice-matched blog draft",
  description:
    "Generate a blog post draft in the user's voice (Voice DNA) with hook, structure, and word count matching their existing content.",
  match: {
    applies_to_goals: ["audience", "content", "thought_leadership"],
  },
  data_sources: [
    { source: "voice_profile", purpose: "user's writing style vector", required: true },
    { source: "article_facts", purpose: "the source article's verified claims", required: true },
    { source: "saved_items_related", purpose: "user's prior writing on related topic", required: false },
  ],
  output_template: "Markdown blog post: title, hook, body, conclusion, CTA",
  output_fields: {
    title: "Headline matching user's title patterns from voice profile",
    hook: "Opening 2-3 sentences using user's typical hook style",
    body: "Main body in user's voice — sentence length, vocabulary, structural patterns",
    conclusion: "Closing in user's voice",
    cta: "Call-to-action matching user's typical CTAs",
    estimated_read_time: "Minutes",
    word_count: "Total words",
    voice_match_score: "0-1 score of how well output matches user's voice profile",
  },
  fact_check_rules: [
    { field: "body", validator: "no_invented_facts", source_field: "article_facts", on_fail: "warn" },
    { field: "body", validator: "no_invented_quotes", source_field: "article_facts", on_fail: "strip" },
  ],
  hallucination_risk: 1, // body is paraphrased; we flag it
  estimated_effort_minutes: 30,
  estimated_value_label: "low_$",
  status: "draft",
  version: 1,
  notes: "Phase 4 will add the Draftpad editor for in-place editing + diff capture.",
};

// ────────────────────────────────────────────────────────────────────
// 4. Local Real Estate Impact — bond/zoning/policy → property
// ────────────────────────────────────────────────────────────────────
export const localRealEstateImpact: ActionTemplate = {
  slug: "local_real_estate_impact",
  vector: "local_civic",
  triggers: ["local_civic_action", "regulatory_event"],
  display_name: "Local real estate impact analysis",
  description:
    "Council vote, bond approval, zoning change, infrastructure spending → which user-tracked properties or geographies are affected.",
  match: {
    applies_to_goals: ["real_estate", "local_business", "wealth"],
    geographic_anchors: ["any"], // template runs only when user has this geography in their anchors
  },
  data_sources: [
    { source: "user_property_watchlist", purpose: "user's tracked addresses/zipcodes", required: true },
    { source: "geocode_event", purpose: "extract geo coordinates from article", required: true },
    { source: "zoning_data_api", purpose: "current zoning + planned changes", required: false },
    { source: "comparable_sales_api", purpose: "recent sales in affected area", required: false },
  ],
  output_template:
    "Affected properties + estimated impact + comparable historical patterns + suggested action",
  output_fields: {
    affected_properties: "Properties from user watchlist within event radius",
    geographic_radius_meters: "Distance threshold used",
    historical_pattern: "Similar past events and outcomes",
    estimated_impact_pct: "Range of expected value impact (low/median/high)",
    timeline_months: "When impact typically materializes",
    action_steps: "Specific next steps for user (research, contact agent, etc)",
  },
  fact_check_rules: [
    { field: "affected_properties", validator: "address_match", source_field: "user_watchlist", on_fail: "strip" },
    { field: "estimated_impact_pct", validator: "range_within_historical", source_field: "comparable_events", on_fail: "warn" },
  ],
  hallucination_risk: 0,
  estimated_effort_minutes: 45,
  estimated_value_label: "high_$$$",
  status: "draft",
  version: 1,
};

// ────────────────────────────────────────────────────────────────────
// 5. Travel Deal Capture — route launches, price drops
// ────────────────────────────────────────────────────────────────────
export const travelDealCapture: ActionTemplate = {
  slug: "travel_deal_capture",
  vector: "travel",
  triggers: ["route_launch", "price_drop"],
  display_name: "Travel deal capture",
  description:
    "New direct route, price-drop alert → match against user's saved trip ideas, family calendar, business travel needs.",
  match: {
    applies_to_goals: ["travel", "lifestyle", "family"],
  },
  data_sources: [
    { source: "user_travel_brain", purpose: "user's saved trip-related items", required: false },
    { source: "user_calendar", purpose: "school breaks, business windows", required: false },
    { source: "skyscanner_api", purpose: "verify current price + historical avg", required: true },
    { source: "passport_expiry", purpose: "user's stored expiry dates", required: false },
  ],
  output_template: "Deal summary + Brain match + family/business alignment + booking deadline",
  output_fields: {
    current_price_cents: "Current price (verified)",
    historical_avg_cents: "Historical average for the route",
    savings_cents: "Difference",
    booking_deadline: "When intro pricing ends",
    brain_match: "Saved items related to the destination",
    calendar_alignment: "School breaks or business windows that fit",
    action_steps: "Book by date, passport check, hotel research from Brain",
  },
  fact_check_rules: [
    { field: "current_price_cents", validator: "skyscanner_match", source_field: "skyscanner_quote", on_fail: "block" },
    { field: "savings_cents", validator: "subtraction_match", source_field: "prices", on_fail: "warn" },
  ],
  hallucination_risk: 0,
  estimated_effort_minutes: 20,
  estimated_value_label: "med_$$",
  time_sensitivity_hours: 168,
  status: "draft",
  version: 1,
};

// ────────────────────────────────────────────────────────────────────
// 6. Scholarship Match — education programs → user's family
// ────────────────────────────────────────────────────────────────────
export const scholarshipMatch: ActionTemplate = {
  slug: "scholarship_match",
  vector: "family",
  triggers: ["scholarship_program", "tax_legal_change"],
  display_name: "Scholarship eligibility match",
  description:
    "Education programs (scholarships, grants, fellowships) matched against user's family profile (kids, ages, GPA, status).",
  match: {
    applies_to_profiles: ["parent"],
  },
  data_sources: [
    { source: "user_family_profile", purpose: "kids age, GPA, status (anonymized)", required: true },
    { source: "program_eligibility_data", purpose: "criteria from official source", required: true },
    { source: "deadline_calendar", purpose: "application timeline", required: true },
  ],
  output_template: "Eligibility verdict + action plan + deadline + similar programs",
  output_fields: {
    eligible: "boolean with reason",
    gap_analysis: "What's missing if not eligible",
    deadline: "Hard deadline date",
    action_plan: "Step-by-step plan with timeline",
    financial_value: "Estimated savings if awarded",
    similar_programs: "3-5 similar programs with deadlines",
  },
  fact_check_rules: [
    { field: "eligible", validator: "criteria_match", source_field: "official_eligibility", on_fail: "block" },
    { field: "deadline", validator: "official_source_match", source_field: "program_data", on_fail: "block" },
  ],
  hallucination_risk: 0,
  estimated_effort_minutes: 30,
  estimated_value_label: "high_$$$",
  status: "draft",
  version: 1,
};

// ────────────────────────────────────────────────────────────────────
// 7. Niche Build Opportunity — gaps in product launches
// ────────────────────────────────────────────────────────────────────
export const nicheBuildOpportunity: ActionTemplate = {
  slug: "niche_build_opportunity",
  vector: "build",
  triggers: ["product_launch", "open_source_release", "patent_filing"],
  display_name: "Niche build opportunity",
  description:
    "Identify gaps in a product launch (missing features, underserved use cases) where user could ship a complementary tool.",
  match: {
    applies_to_goals: ["build", "side_hustle", "saas"],
  },
  data_sources: [
    { source: "product_release_notes", purpose: "extract feature list", required: true },
    { source: "developer_docs", purpose: "API/SDK surface area", required: false },
    { source: "user_tech_stack", purpose: "what user can build with", required: true },
    { source: "competitive_landscape", purpose: "existing similar tools", required: false },
  ],
  output_template: "Identified gap + build idea + effort/payoff + 30-day MVP plan",
  output_fields: {
    gap_identified: "What's missing in the launch",
    build_idea: "Specific product description (1-2 sentences)",
    user_match_reason: "Why user is uniquely positioned to build this",
    estimated_effort_hours: "Range: low/median/high",
    estimated_payoff: "MRR range, audience growth, or strategic value",
    mvp_plan_30d: "Week-by-week plan for a 30-day MVP",
    competitive_check: "Existing tools in this space",
  },
  fact_check_rules: [
    { field: "gap_identified", validator: "release_notes_match", source_field: "release_notes", on_fail: "warn" },
    { field: "competitive_check", validator: "real_products_only", source_field: "competitive_data", on_fail: "strip" },
  ],
  hallucination_risk: 1,
  estimated_effort_minutes: 40,
  estimated_value_label: "high_$$$",
  status: "draft",
  version: 1,
};

// ────────────────────────────────────────────────────────────────────
// 8. Network Warm Reconnect — 2nd-degree opportunities
// ────────────────────────────────────────────────────────────────────
export const networkWarmReconnect: ActionTemplate = {
  slug: "network_warm_reconnect",
  vector: "network",
  triggers: [
    "executive_change", "product_launch", "ipo_funding",
    "acquisition_merger", "local_civic_action",
  ],
  display_name: "Warm reconnect opportunity",
  description:
    "When something happens at a company, surface 2nd-degree LinkedIn connections + suggest warm reachout.",
  match: {
    applies_to_goals: ["network", "consulting", "career"],
    required_connections: ["linkedin"],
  },
  data_sources: [
    { source: "linkedin_2nd_degree", purpose: "connections at affected company", required: true },
    { source: "past_messages", purpose: "history with these connections", required: false },
    { source: "recent_activity", purpose: "their recent posts/updates", required: false },
  ],
  output_template: "Connections list + suggested message in user's voice + timing",
  output_fields: {
    connections: "People at the company within 2nd-degree",
    last_contact: "When user last messaged them",
    suggested_messages: "Voice-matched warm reachout drafts",
    timing: "Best time to send (right now, after launch settles, etc)",
    follow_up_plan: "If no response, what next",
  },
  fact_check_rules: [
    { field: "connections", validator: "linkedin_api_match", source_field: "linkedin_data", on_fail: "block" },
    { field: "last_contact", validator: "message_history_match", source_field: "messages", on_fail: "warn" },
  ],
  hallucination_risk: 0,
  estimated_effort_minutes: 15,
  estimated_value_label: "med_$$",
  status: "draft",
  version: 1,
};

// ────────────────────────────────────────────────────────────────────
// 9. Consulting Outreach Angle — relevant client opportunities
// ────────────────────────────────────────────────────────────────────
export const consultingOutreachAngle: ActionTemplate = {
  slug: "consulting_outreach_angle",
  vector: "consulting",
  triggers: [
    "regulatory_event", "tax_legal_change", "product_launch",
    "study_research", "local_civic_action",
  ],
  display_name: "Consulting outreach angle",
  description:
    "Find specific clients in user's portfolio for whom this news matters; suggest exact outreach messaging.",
  match: {
    applies_to_profiles: ["consultant", "advisor"],
    applies_to_goals: ["consulting", "client_growth"],
  },
  data_sources: [
    { source: "user_client_list", purpose: "current/past clients with industry tags", required: true },
    { source: "industry_relevance_match", purpose: "which industries does this affect", required: true },
    { source: "voice_profile", purpose: "user's outreach tone", required: true },
  ],
  output_template: "Client matches + relevance reason + outreach draft + service offering",
  output_fields: {
    matched_clients: "Clients in industries affected by the event",
    relevance_per_client: "Why this matters specifically to each",
    outreach_drafts: "Voice-matched email/message per client",
    service_offering: "Specific service to pitch (audit, workshop, retainer)",
    estimated_revenue: "Range based on user's typical engagement size",
  },
  fact_check_rules: [
    { field: "matched_clients", validator: "client_list_match", source_field: "user_clients", on_fail: "strip" },
    { field: "outreach_drafts", validator: "no_invented_facts", source_field: "article_facts", on_fail: "warn" },
  ],
  hallucination_risk: 1,
  estimated_effort_minutes: 30,
  estimated_value_label: "high_$$$",
  status: "draft",
  version: 1,
};

// ────────────────────────────────────────────────────────────────────
// 10. Tax/Legal Deadline Capture — deduction & compliance signals
// ────────────────────────────────────────────────────────────────────
export const taxLegalDeadline: ActionTemplate = {
  slug: "tax_legal_deadline",
  vector: "legal_tax",
  triggers: ["tax_legal_change", "regulatory_event"],
  display_name: "Tax/legal deadline capture",
  description:
    "New rule, deduction, deadline → personalized impact based on user's situation (business type, geography, family).",
  match: {
    applies_to_profiles: ["business_owner", "freelancer", "consultant", "investor"],
  },
  data_sources: [
    { source: "regulatory_text", purpose: "official rule text", required: true },
    { source: "user_business_profile", purpose: "user's biz structure, state", required: true },
    { source: "user_calendar", purpose: "for deadline injection", required: false },
  ],
  output_template: "Affects-you verdict + estimated impact + action steps + deadline calendar",
  output_fields: {
    applies_to_user: "boolean with reason",
    financial_impact: "Estimated $ impact (savings or cost)",
    action_steps: "Specific actions user must take",
    deadline_dates: "Hard deadlines",
    calendar_event_proposed: "Proposed calendar event for deadlines",
    professional_help: "When to consult CPA/attorney",
  },
  fact_check_rules: [
    { field: "deadline_dates", validator: "official_source_match", source_field: "regulatory_text", on_fail: "block" },
    { field: "financial_impact", validator: "calculation_audit", source_field: "calc_inputs", on_fail: "warn" },
  ],
  hallucination_risk: 0,
  estimated_effort_minutes: 20,
  estimated_value_label: "high_$$$",
  status: "draft",
  version: 1,
};

// ────────────────────────────────────────────────────────────────────
// Registry — exported list of all Phase 1 templates
// ────────────────────────────────────────────────────────────────────
export const phase1Templates: ActionTemplate[] = [
  domainLandGrab,
  positionTradeSetup,
  contentDraftBlog,
  localRealEstateImpact,
  travelDealCapture,
  scholarshipMatch,
  nicheBuildOpportunity,
  networkWarmReconnect,
  consultingOutreachAngle,
  taxLegalDeadline,
];

export const templatesBySlug: Record<string, ActionTemplate> = Object.fromEntries(
  phase1Templates.map((t) => [t.slug, t])
);
