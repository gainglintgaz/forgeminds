import type { ScoreResult } from "./scorer";

interface CurationConfig {
  targetCount: number;
  maxPerCategory: number;
  maxPerEntity: number;
  minCompositeScore: number;
}

const DEFAULT_CONFIG: CurationConfig = {
  targetCount: 15,
  maxPerCategory: 3,
  maxPerEntity: 2,
  minCompositeScore: 4.5,
};

export function curateStories(
  scores: ScoreResult[],
  config: Partial<CurationConfig> = {}
): ScoreResult[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Filter by minimum score
  const eligible = scores.filter((s) => s.compositeScore >= cfg.minCompositeScore);

  if (eligible.length === 0) return scores.slice(0, cfg.targetCount);

  // Sort by composite score descending
  eligible.sort((a, b) => b.compositeScore - a.compositeScore);

  const selected: ScoreResult[] = [];
  const categoryCounts = new Map<string, number>();

  // Pass 1: Best from each category
  const byCategory = new Map<string, ScoreResult[]>();
  for (const item of eligible) {
    const cat = (item.category || "general").toLowerCase();
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  }

  for (const [, catItems] of byCategory) {
    if (selected.length >= cfg.targetCount) break;
    const best = catItems[0];
    selected.push(best);
    categoryCounts.set(best.category.toLowerCase(), 1);
  }

  // Pass 2: Fill remaining with highest scored
  for (const item of eligible) {
    if (selected.length >= cfg.targetCount) break;
    if (selected.some((s) => s.articleId === item.articleId)) continue;

    const cat = (item.category || "general").toLowerCase();
    if ((categoryCounts.get(cat) || 0) >= cfg.maxPerCategory) continue;

    selected.push(item);
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }

  return selected;
}
