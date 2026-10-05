/**
 * Action Template Types — ForgeMinds Multi-Vector Action Engine
 *
 * Templates are deterministic, human-authored playbooks that turn news
 * events into ranked, actionable suggestions. Layer 2 of the
 * no-hallucination 4-layer architecture.
 *
 * See .claude/CLAUDE.md "NO-HALLUCINATION 4-LAYER ARCHITECTURE" for full spec.
 */

export type ActionVector =
  | "investment"
  | "build"
  | "content"
  | "network"
  | "learn"
  | "consulting"
  | "land_grab"
  | "local_civic"
  | "family"
  | "travel"
  | "health"
  | "career"
  | "sports_fantasy"
  | "legal_tax";

export type EventTrigger =
  | "product_launch"
  | "earnings_report"
  | "executive_change"
  | "ipo_funding"
  | "acquisition_merger"
  | "regulatory_event"
  | "partnership"
  | "patent_filing"
  | "study_research"
  | "price_drop"
  | "route_launch"
  | "local_civic_action"
  | "scholarship_program"
  | "tax_legal_change"
  | "sports_event"
  | "comp_data"
  | "cultural_moment"
  | "security_breach"
  | "open_source_release"
  | "market_movement";

/**
 * Layer 1 data sources required by a template.
 * Every claim in template output MUST be grounded in one of these.
 */
export interface DataSourceRequirement {
  source: string;          // 'whois_api' | 'uspto_api' | 'finnhub' | 'wikidata' | ...
  purpose: string;         // human-readable description
  required: boolean;       // if false, template degrades gracefully when source is missing
  cache_ttl_seconds?: number;
}

/**
 * Post-generation validators that catch hallucinated facts.
 * Each rule re-checks an output claim against its source.
 */
export interface FactCheckRule {
  field: string;           // 'available_domains'
  validator: string;       // 'whois_match' | 'price_match' | 'date_within_range'
  source_field: string;    // path to ground-truth value in resolved_data
  on_fail: "strip" | "warn" | "block";
}

/**
 * Profile/goal matching criteria.
 * All conditions must match for a template to be considered.
 */
export interface ProfileMatch {
  applies_to_profiles?: string[];   // ['consultant', 'creator', 'investor']
  applies_to_goals?: string[];      // ['build', 'audience', 'income']
  excludes_profiles?: string[];
  min_capital_cents?: number;
  max_capital_cents?: number;
  geographic_anchors?: string[];    // ['us-sc', 'us-ca'] — empty means global
  required_connections?: string[];  // ['linkedin', 'github']
}

/**
 * The full template definition. Stored in `action_templates` table.
 */
export interface ActionTemplate {
  slug: string;                          // 'domain_land_grab'
  vector: ActionVector;
  triggers: EventTrigger[];
  display_name: string;
  description: string;
  match: ProfileMatch;
  data_sources: DataSourceRequirement[];
  output_template: string;               // mustache-style with {{fields}}
  output_fields: Record<string, string>; // field_name → description for AI
  fact_check_rules: FactCheckRule[];
  hallucination_risk: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  estimated_effort_minutes?: number;
  estimated_value_cents?: number;
  estimated_value_label?: "low_$" | "med_$$" | "high_$$$";
  time_sensitivity_hours?: number;       // hot zone for time-bound opportunities
  status: "draft" | "active" | "deprecated";
  version: number;
  notes?: string;
}

/**
 * A run of a template against a specific article + user.
 * Stored in `action_template_runs` table.
 */
export interface ActionTemplateRun {
  id?: string;
  user_id: string;
  template_slug: string;
  article_id?: string;
  brief_id?: string;
  resolved_data: Record<string, unknown>;
  match_score: number;
  match_reason: string;
  output_text?: string;
  output_html?: string;
  generation_model?: string;
  prompt_version?: string;
  fact_check_passed: boolean;
  fact_check_warnings: string[];
  outcome:
    | "suggested"
    | "dismissed"
    | "accepted"
    | "completed"
    | "value_realized";
  realized_value_cents?: number;
  user_feedback?: string;
}
