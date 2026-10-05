import type { ScoreResult } from "./scorer";
import { CANONICAL_CATEGORIES } from "./scorer";

interface CurationConfig {
  targetCount: number;
  maxPerCategory: number;
  maxPerEntity: number;
  minCompositeScore: number;
  /**
   * Hard floor on relevanceScore (1-10 scale), independent of
   * minCompositeScore. E1 audit fix 2: relevance is only 45% of the
   * composite weight, so a high-impact/high-viral but off-interest article
   * (e.g. "FBI raid on an Ohio voting group" for a finance reader) can clear
   * the composite floor while scoring 1-2 on relevance. Without this floor,
   * Pass 1 below hands that article a guaranteed category-diversity seat
   * regardless of how irrelevant it is to the reader — the root cause of the
   * Antarctica/lupus/Epstein leak in the 2026-06-14 brief.
   */
  minRelevanceScore: number;
  /**
   * Canonical category slugs (see scorer.ts CANONICAL_CATEGORIES) to
   * hard-exclude entirely — resolved from the user's excluded_topics via
   * resolveExcludedCategories(). Empty = no category-level exclusion (the
   * relevance floor above is still the primary defense either way).
   */
  excludedCategories: string[];
}

const DEFAULT_CONFIG: CurationConfig = {
  targetCount: 15,
  maxPerCategory: 3,
  maxPerEntity: 2,
  minCompositeScore: 4.5,
  minRelevanceScore: 5,
  excludedCategories: [],
};

/**
 * Resolve a user's freeform excluded_topics strings (e.g. "sports scores",
 * "lifestyle fluff") to canonical category slugs by token overlap against
 * the known taxonomy. Generic (Layer-1) — works against any project's
 * canonical category list, not finance-specific (per ARCHITECTURE §1 layer
 * boundary / Global Constraint 2). A miss simply isn't excluded at the
 * category level; the minRelevanceScore floor is the primary, always-on
 * defense regardless of whether a given excluded_topic happens to name a
 * whole category.
 */
export function resolveExcludedCategories(
  excludedTopics: string[],
  canonicalCategories: readonly string[] = CANONICAL_CATEGORIES
): string[] {
  const excluded = new Set<string>();
  for (const topic of excludedTopics) {
    const normalized = topic.toLowerCase();
    for (const cat of canonicalCategories) {
      if (normalized.includes(cat)) excluded.add(cat);
    }
  }
  return Array.from(excluded);
}

export interface CurationResult {
  selected: ScoreResult[];
  /**
   * Count of eligible items that were skipped SOLELY because every one of
   * their tickers had already reached maxPerEntity in this run (H1 fix 1 —
   * the entity cap used to be read from config and never actually enforced
   * anywhere in this function, letting one hot stock crowd a brief even
   * across categories). Forensic-only aggregate — excluded stories are never
   * user-visible, so we count them, not log them individually (architecture
   * §7 assumption 1). Written to pipeline_runs.metadata by the caller.
   */
  entityCapExclusions: number;
}

export function curateStories(
  scores: ScoreResult[],
  config: Partial<CurationConfig> = {}
): CurationResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const excludedSet = new Set(cfg.excludedCategories.map((c) => c.toLowerCase()));

  // Filter by minimum composite score, minimum relevance (fix 2), and
  // excluded categories (fix 1) — all three gate BEFORE any category can
  // earn a diversity seat in Pass 1, so "best from every category" below
  // only ever draws from articles that are both good AND actually relevant
  // to this reader's interest graph.
  const eligible = scores.filter(
    (s) =>
      s.compositeScore >= cfg.minCompositeScore &&
      s.relevanceScore >= cfg.minRelevanceScore &&
      !excludedSet.has((s.category || "general").toLowerCase())
  );

  // Honest "quiet day" state (ARCHITECTURE.md §3 edge case 5 / VIBE Rule 44:
  // Incomplete > Inaccurate) — a thin day with nothing genuinely relevant
  // produces an empty brief, never a fabricated one padded with whatever
  // cleared only the (looser) composite floor. This replaces the old
  // "fall back to top N regardless of relevance" behavior, which is exactly
  // what let Antarctica/lupus/Epstein-class stories through on a slow
  // finance-news day.
  if (eligible.length === 0) return { selected: [], entityCapExclusions: 0 };

  // Sort by composite score descending
  eligible.sort((a, b) => b.compositeScore - a.compositeScore);

  const selected: ScoreResult[] = [];
  const categoryCounts = new Map<string, number>();
  // Per-ticker seat count, shared across BOTH passes below (H1 fix 1). A
  // ticker counts against its cap the moment ANY selected item lists it —
  // multi-ticker articles count against EVERY listed ticker, not just a
  // "primary" one (the conservative, intentional choice — see architecture
  // §7 assumption 1: this prevents an article that's simultaneously the top
  // pick in two categories from seating the same hot ticker twice before any
  // entity check ever ran, which was the original bug).
  const entityCounts = new Map<string, number>();
  let entityCapExclusions = 0;

  function isOverEntityCap(item: ScoreResult): boolean {
    return item.tickers.some((t) => (entityCounts.get(t) || 0) >= cfg.maxPerEntity);
  }
  function bumpEntityCounts(item: ScoreResult): void {
    for (const t of item.tickers) {
      entityCounts.set(t, (entityCounts.get(t) || 0) + 1);
    }
  }

  // Pass 1: Best from each (relevant, non-excluded) category — but skip any
  // candidate that would blow the entity cap and fall through to the next-best
  // in that category (catItems is already sorted, since it was built by
  // iterating the sorted `eligible` list below). If every candidate in a
  // category is over-cap, that category simply gets no seat this round —
  // honest under-fill (ARCHITECTURE.md §3 edge case 4), never a forced pick.
  const byCategory = new Map<string, ScoreResult[]>();
  for (const item of eligible) {
    const cat = (item.category || "general").toLowerCase();
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  }

  for (const [, catItems] of byCategory) {
    if (selected.length >= cfg.targetCount) break;
    let picked: ScoreResult | undefined;
    for (const candidate of catItems) {
      if (isOverEntityCap(candidate)) {
        entityCapExclusions++;
        continue;
      }
      picked = candidate;
      break;
    }
    if (!picked) continue;
    selected.push(picked);
    categoryCounts.set(picked.category.toLowerCase(), 1);
    bumpEntityCounts(picked);
  }

  // Pass 2: Fill remaining with highest scored — same entity-cap check applies
  // here (this was the ONLY pass that had any cap awareness before H1, and
  // even then it read maxPerEntity from config without ever checking it).
  for (const item of eligible) {
    if (selected.length >= cfg.targetCount) break;
    if (selected.some((s) => s.articleId === item.articleId)) continue;

    const cat = (item.category || "general").toLowerCase();
    if ((categoryCounts.get(cat) || 0) >= cfg.maxPerCategory) continue;
    if (isOverEntityCap(item)) {
      entityCapExclusions++;
      continue;
    }

    selected.push(item);
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
    bumpEntityCounts(item);
  }

  return { selected, entityCapExclusions };
}
