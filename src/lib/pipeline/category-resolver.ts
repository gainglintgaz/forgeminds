/**
 * Strict category resolution (ERR-021, lessons.md #105, VIBE Rule 24).
 *
 * The AI may only emit a category that resolves to an EXISTING row in the
 * `categories` table. The scorer is now asked to output one of the 13 canonical
 * slugs directly; this resolver validates that against the live table, applies a
 * small alias safety-net for free-text drift, and on a MISS parks the article in
 * the 'uncategorized' review bucket — it NEVER invents or blind-inserts a
 * category. A good article is never lost; only its label is flagged for review.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface CategoryResolution {
  categoryId: string;
  slug: string;
  resolution: "resolved" | "flagged_for_review";
}

export interface CategoryResolver {
  /** Resolve a model-emitted category string to a canonical category UUID. */
  resolve: (aiCategory: string | null | undefined) => CategoryResolution;
}

// Free-text → canonical-slug safety net. The scorer prompts for canonical slugs,
// but models drift ("stock market", "AI/ML", "world news"); map common variants
// so a real article isn't needlessly flagged. Anything not here AND not a direct
// slug → uncategorized (review). Keys are normalized (lowercase, spaces).
const ALIASES: Record<string, string> = {
  // finance family
  "stock market": "finance", stocks: "finance", equities: "finance", crypto: "finance",
  cryptocurrency: "finance", treasuries: "finance", bonds: "finance", "treasuries bonds": "finance",
  commodities: "finance", forex: "finance", "commodities forex": "finance", macro: "finance",
  "economic data": "finance", "economic data macro": "finance", macroeconomics: "finance",
  economy: "finance", economics: "finance", markets: "finance", investing: "finance",
  earnings: "finance", "earnings report": "finance", "earnings analysis": "finance",
  "corporate news": "finance", etf: "finance", "etf fund news": "finance", "fund news": "finance",
  "sector analysis": "finance", "general finance": "finance", banking: "finance",
  "monetary policy": "finance",
  // tech
  technology: "tech", ai: "tech", "ai ml": "tech", ml: "tech", "artificial intelligence": "tech",
  software: "tech", hardware: "tech", "machine learning": "tech",
  // sciences
  science: "sciences", climate: "sciences", environment: "sciences", space: "sciences",
  research: "sciences", "climate science": "sciences",
  // medicine / health
  medical: "medicine", pharma: "medicine", pharmaceutical: "medicine", biotech: "medicine",
  wellness: "health", fitness: "health", "public health": "health", nutrition: "health",
  // geopolitics
  world: "geopolitics", "world news": "geopolitics", politics: "geopolitics",
  international: "geopolitics", war: "geopolitics", conflict: "geopolitics",
  "foreign policy": "geopolitics", "national security": "geopolitics",
  // civic
  government: "civic", "public policy": "civic", policy: "civic", "local civic": "civic",
  // legal_tax
  legal: "legal_tax", tax: "legal_tax", taxes: "legal_tax", law: "legal_tax",
  regulatory: "legal_tax", "regulatory policy": "legal_tax", regulation: "legal_tax",
  // career / education / arts / lifestyle / sports
  jobs: "career", employment: "career", career: "career",
  education: "education", arts: "arts", culture: "arts", entertainment: "arts",
  lifestyle: "lifestyle", sports: "sports",
};

const normalize = (s: string): string =>
  s.trim().toLowerCase().replace(/[_\-/]+/g, " ").replace(/\s+/g, " ");

export async function loadCategoryResolver(
  supabase: SupabaseClient
): Promise<CategoryResolver> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug")
    .eq("is_active", true);
  if (error) throw new Error(`[category-resolver] load failed: ${error.message}`);

  const slugToId = new Map<string, string>();
  for (const row of data ?? []) slugToId.set(row.slug as string, row.id as string);

  const uncategorizedId = slugToId.get("uncategorized");
  if (!uncategorizedId) {
    throw new Error(
      "[category-resolver] 'uncategorized' sentinel missing — run 20260614000000_categories_strict_resolution"
    );
  }

  return {
    resolve(aiCategory) {
      const n = normalize((aiCategory ?? "").toString());
      if (n) {
        // 1. direct canonical slug (e.g. "finance", "legal tax" → "legal_tax")
        const directSlug = n.replace(/\s+/g, "_");
        if (slugToId.has(directSlug)) {
          return { categoryId: slugToId.get(directSlug)!, slug: directSlug, resolution: "resolved" };
        }
        // 2. alias safety-net
        const aliasSlug = ALIASES[n];
        if (aliasSlug && slugToId.has(aliasSlug)) {
          return { categoryId: slugToId.get(aliasSlug)!, slug: aliasSlug, resolution: "resolved" };
        }
      }
      // 3. MISS → uncategorized review bucket. NEVER invent / blind-insert.
      return { categoryId: uncategorizedId, slug: "uncategorized", resolution: "flagged_for_review" };
    },
  };
}
