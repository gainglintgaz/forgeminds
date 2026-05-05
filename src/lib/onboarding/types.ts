/**
 * Shared types for the Phase 1.5 AI-Assisted Source Discovery flow.
 *
 * The onboarding wizard has 3 stages — intake (free-form), refine
 * (agent proposes, user toggles), confirm (commit picks). All stages
 * share the same intent + proposal shapes defined here.
 *
 * Why a dedicated types file: the agent backend (server), the agent
 * orchestrator (server), the UI components (client), and the verify
 * scripts all consume these types. Declaring them once prevents
 * drift between client + server JSON shapes.
 */

/** What the intake stage extracts from the user's free-form description. */
export interface UserIntent {
  /** High-signal topic tokens. e.g. ['biotech', 'monetary_policy', 'F1']. */
  topics: string[];

  /** How much depth the user wants per article. */
  depthPref: "shallow" | "medium" | "deep";

  /** How often they want updates. */
  cadencePref: "realtime" | "daily" | "weekly";

  /** What they're willing to pay for. */
  paywallPref: "free_only" | "freemium_ok" | "paid_ok" | "byos";

  /** Geography filters; defaults to ['global'] if user didn't specify. */
  geography: string[];

  /** The raw text the user typed; preserved for the audit trail. */
  rawDescription: string;
}

/** A single source the agent proposes during /onboarding/refine. */
export interface SourceProposal {
  /** Catalog row id (null for user-submitted custom URLs not yet in catalog). */
  catalogId: string | null;
  name: string;
  description: string;
  url: string;
  /** One of the values in the source_type DB enum. */
  type: string;
  paywallTier: "free" | "freemium" | "paid" | "byos";
  paywallCostUsdMonthly: number | null;
  /** Plain-language reason the agent surfaced this source. */
  reason: string;
  /** 0-1, from semantic similarity score. */
  rankScore: number;
  /** Toggled-on by default; UI lets the user uncheck to skip on confirm. */
  enabled: boolean;
}

/** A single message in the conversation log. */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  /** ISO 8601 timestamp. */
  ts: string;
}

/** State the wizard layout passes between steps via Next.js search params. */
export interface OnboardingState {
  step: "intake" | "refine" | "confirm";
  intent?: UserIntent;
  proposals?: SourceProposal[];
  /** Server-generated id linking the wizard run to source_suggestions rows. */
  runId?: string;
}

/** Cost guardrail: any single onboarding run must stay under this budget. */
export const ONBOARDING_COST_CAP_USD = 0.10;
