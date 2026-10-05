/**
 * Shared types for the Phase 1 feed actions (Save / Analyze / Draft / Act).
 *
 * Configs are per-user-configurable (VIBE Rule 55): a hardcoded safe default ←
 * per-user saved default (user_preferences) ← per-click override (button payload).
 * The RESOLVED config is persisted on the run/draft/plan row as the audit trait
 * "what settings produced this" (two-way-traceability.md).
 */

export type ActionName = "save" | "analyze" | "draft" | "act";

/** A single traceable source behind an AI output. Persisted in sources[] arrays. */
export interface SourceRef {
  type: "article";
  id: string;
  label: string; // article title
  url: string | null;
  published_at: string | null;
  outlet: string | null; // raw_articles.source_name (NOT "source")
}

/**
 * The article row the routes fetch server-side (RLS-scoped) for grounding +
 * provenance. The model is fed ONLY this one article (single-source confinement).
 */
export interface ActionArticle {
  id: string;
  title: string;
  url: string | null;
  summary: string | null;
  full_text: string | null;
  source_name: string | null;
  published_at: string | null;
}

// ── Analyze ──────────────────────────────────────────────────────────────
export type AnalyzeLens =
  | "key_facts"
  | "market_implications"
  | "political_angle"
  | "what_should_i_do"
  | "risks"
  | "explain_simply"
  | "custom";
export type AnalyzeDepth = "brief" | "standard" | "deep";
export type AnalyzeStance = "facts_only" | "facts_plus_opinion";
export interface AnalyzeConfig {
  lens: AnalyzeLens;
  depth: AnalyzeDepth;
  stance: AnalyzeStance;
  custom_lens: string | null;
}

// ── Draft ────────────────────────────────────────────────────────────────
export type DraftPlatform = "x" | "reddit" | "facebook" | "linkedin" | "generic";
export type DraftLength = "short" | "standard" | "long";
export type DraftStance = "facts_only" | "facts_plus_analysis" | "facts_plus_opinion";
export interface PlatformCap {
  max_chars: number;
  hashtags_default: boolean;
}
export interface DraftConfig {
  platform: DraftPlatform;
  tone: string; // reuses user_preferences.social_tone — NOT a duplicate column (Rule 59)
  length: DraftLength;
  stance: DraftStance;
  hashtags: boolean;
  platform_caps: Record<string, PlatformCap>;
}

// ── Act / Hand to AI ─────────────────────────────────────────────────────
export type ActFlavor = "research" | "plan" | "draft_brief" | "code_kickoff";
export type ActDepth = "brief" | "standard" | "deep";
export interface ActConfig {
  flavor: ActFlavor;
  target: string; // free text or preset: "Claude Code session" | "generic LLM" | "research agent"
  depth: ActDepth;
}

// ── Save ─────────────────────────────────────────────────────────────────
export interface SaveConfig {
  tags: string[];
  note: string | null;
}

// ── Grounding + AI output meta (what AiOutputDisclaimer renders) ──────────
export interface GroundingResult {
  passed: boolean;
  warnings: string[];
}

export interface AiOutputMeta {
  model: string;
  promptVersion: string;
  source: SourceRef;
  grounding: GroundingResult;
}
