/**
 * Analyze lenses are editable DATA in public.analysis_lenses (migration
 * 20260613000005), NOT JS constants (VIBE Rule 55 — lenses-as-data). The DB row is
 * the source of truth; the route reads it per Analyze call.
 *
 * FALLBACK_LENSES below is a deliberate minimal mirror so Analyze still functions if
 * the lens row is missing (e.g. before the seed migration is applied) — the sanctioned
 * structured fallback (Rule 56). It is intentionally terse; the DB seed carries the
 * richer skeletons and wins whenever present.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalyzeLens } from "./types";

export interface LensDefinition {
  slug: string;
  display_name: string;
  prompt_skeleton: string;
  hallucination_risk: string;
  grounding_rule: string;
}

/** User-facing lens options for the selector bar (display order matches the seed). */
export const LENS_OPTIONS: { slug: AnalyzeLens; label: string }[] = [
  { slug: "key_facts", label: "Key Facts" },
  { slug: "market_implications", label: "Market Implications" },
  { slug: "political_angle", label: "Political / Policy Angle" },
  { slug: "what_should_i_do", label: "What Should I Do?" },
  { slug: "risks", label: "Risks & Downsides" },
  { slug: "explain_simply", label: "Explain Simply" },
  { slug: "custom", label: "Custom Lens" },
];

const FALLBACK_LENSES: Record<string, LensDefinition> = {
  key_facts: {
    slug: "key_facts",
    display_name: "Key Facts",
    prompt_skeleton:
      "Extract the key verifiable facts from this article (who, what, when, where, and every concrete number). Use ONLY facts stated in the article.",
    hallucination_risk: "low",
    grounding_rule: "Every number or quote must appear in the article.",
  },
  market_implications: {
    slug: "market_implications",
    display_name: "Market Implications",
    prompt_skeleton:
      "Explain the market and financial implications of this article, grounded strictly in what it states. Separate stated facts from your reasoning.",
    hallucination_risk: "medium",
    grounding_rule: "Stated facts must trace to the article.",
  },
  political_angle: {
    slug: "political_angle",
    display_name: "Political / Policy Angle",
    prompt_skeleton:
      "Analyze the political, regulatory, and policy angle of this article. Identify actors, stakes, and stated positions, grounded strictly in the article.",
    hallucination_risk: "medium",
    grounding_rule: "Actors and positions must come from the article.",
  },
  what_should_i_do: {
    slug: "what_should_i_do",
    display_name: "What Should I Do?",
    prompt_skeleton:
      "Outline concrete options the reader could consider (NOT financial/legal advice). Tie each option to a specific fact in the article.",
    hallucination_risk: "high",
    grounding_rule: "Each option must reference a fact from the article.",
  },
  risks: {
    slug: "risks",
    display_name: "Risks & Downsides",
    prompt_skeleton:
      "Identify the risks, downsides, and failure modes implied by this article, grounded strictly in it. Label stated vs inferred risks.",
    hallucination_risk: "medium",
    grounding_rule: "Stated risks must trace to the article.",
  },
  explain_simply: {
    slug: "explain_simply",
    display_name: "Explain Simply",
    prompt_skeleton:
      "Explain this article in plain language a smart 15-year-old would understand, without losing accuracy. Use ONLY facts from the article.",
    hallucination_risk: "low",
    grounding_rule: "Use only facts present in the article.",
  },
  custom: {
    slug: "custom",
    display_name: "Custom Lens",
    prompt_skeleton:
      'Analyze this article through the following user-defined lens: "{{custom_lens}}". Stay strictly grounded in the article; if it does not cover something, say so.',
    hallucination_risk: "high",
    grounding_rule: "Answer only from the article.",
  },
};

/**
 * Resolve the chosen lens to a concrete prompt skeleton. DB row wins; falls back to
 * the in-code mirror if the row/table is missing. For "custom", interpolates the
 * user's free text into {{custom_lens}}.
 */
export async function getLensDefinition(
  supabase: SupabaseClient,
  slug: string,
  customLens: string | null
): Promise<LensDefinition> {
  let def: LensDefinition = FALLBACK_LENSES[slug] ?? FALLBACK_LENSES.key_facts;

  try {
    const { data } = await supabase
      .from("analysis_lenses")
      .select("slug, display_name, prompt_skeleton, hallucination_risk, grounding_rule")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (data && typeof data.prompt_skeleton === "string") {
      def = data as LensDefinition;
    }
  } catch {
    // Table not present yet (pre-seed) — fall back. Not a silent failure: the
    // fallback is a real, documented degrade path (Rule 56).
  }

  if (def.slug === "custom") {
    const lensText = (customLens ?? "").trim() || "general analysis of this article";
    return { ...def, prompt_skeleton: def.prompt_skeleton.replace(/\{\{custom_lens\}\}/g, lensText) };
  }
  return def;
}
