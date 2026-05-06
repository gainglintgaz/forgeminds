/**
 * verify-source-catalog.ts — Phase 1.5 catalog readiness gate
 *
 * Verifies the source_catalog table is populated to the threshold
 * required for the conversational onboarding agent to do real work.
 * Catalog is what the RAG layer queries; if it's empty or thin, every
 * onboarding run produces a useless empty proposal set.
 *
 * Thresholds (from plan §1.5 + supabase/seeds/source_catalog/README.md):
 *   • ≥200 active rows
 *   • ≥10 distinct top-level categories represented
 *   • Median quality_score ≥ 0.65
 *   • Paywall mix sanity: ≥50% free or freemium (not 100% paid)
 *   • Embedding coverage: ≥95% of rows have a non-null embedding
 *
 * Exit non-zero if any threshold fails. Print which.
 *
 * Usage:
 *   npx tsx scripts/verify-source-catalog.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && value && !process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error("⚠ Could not read .env.local:", (err as Error).message);
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(2);
}

const MIN_ROWS = 200;
const MIN_CATEGORIES = 10;
const MIN_MEDIAN_QUALITY = 0.65;
const MIN_FREE_FREEMIUM_PCT = 0.5;
const MIN_EMBEDDING_COVERAGE = 0.95;

interface CatalogRow {
  id: string;
  is_active: boolean;
  categories: string[] | null;
  quality_score: number | null;
  paywall_tier: string;
}

async function main() {
  console.log("🔍 verify-source-catalog: querying source_catalog…");
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

  // First check the table exists (Phase 1.5 close prerequisite).
  const { error: tableError } = await supabase
    .from("source_catalog")
    .select("id", { count: "exact", head: true });

  if (tableError) {
    console.error(
      `❌ source_catalog table missing or unreachable: ${tableError.message}`
    );
    console.error(
      "   Apply migrations 20260510000000_source_catalog.sql + 20260510000001_source_suggestions.sql first."
    );
    process.exit(1);
  }

  // Pull all active rows for non-vector gates. Excluding `embedding`
  // here is intentional: pgvector serializes through PostgREST as a
  // string ("[0.1,0.2,...]"), not a real number[], so an
  // `Array.isArray(row.embedding)` check on the JS side always returns
  // false and silently fails the embedding-coverage gate even when
  // every row is correctly embedded. Use a server-side `count` for
  // embedding presence instead (below).
  const { data, error } = await supabase
    .from("source_catalog")
    .select("id, is_active, categories, quality_score, paywall_tier")
    .eq("is_active", true)
    .limit(2000);

  if (error) {
    console.error(`❌ Could not read source_catalog: ${error.message}`);
    process.exit(1);
  }

  const rows = (data ?? []) as CatalogRow[];
  console.log(`   ${rows.length} active rows loaded`);

  // Server-side count of rows that actually have an embedding. Using
  // .not("embedding", "is", null) keeps the comparison in Postgres
  // where the column type is real, not in JS where it's a string.
  const { count: embeddedCount, error: embedErr } = await supabase
    .from("source_catalog")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .not("embedding", "is", null);

  if (embedErr) {
    console.error(
      `❌ Could not count embedded rows: ${embedErr.message}`
    );
    process.exit(1);
  }
  const withEmbeddingCount = embeddedCount ?? 0;

  const failures: string[] = [];

  // ─── Gate 1: row count ───
  if (rows.length < MIN_ROWS) {
    failures.push(
      `Row count: ${rows.length} active rows (need ≥${MIN_ROWS}). ` +
        `Dispatch source-catalog-curator subagent for more (category, subcategory) pairs.`
    );
  } else {
    console.log(`   ✓ row count: ${rows.length} ≥ ${MIN_ROWS}`);
  }

  // ─── Gate 2: category breadth ───
  const allCategories = new Set<string>();
  for (const r of rows) {
    for (const c of r.categories ?? []) {
      if (typeof c === "string" && c.trim().length > 0) allCategories.add(c.trim());
    }
  }
  if (allCategories.size < MIN_CATEGORIES) {
    failures.push(
      `Category breadth: ${allCategories.size} distinct categories ` +
        `(need ≥${MIN_CATEGORIES}). Found: ${Array.from(allCategories).sort().join(", ")}`
    );
  } else {
    console.log(`   ✓ categories: ${allCategories.size} distinct ≥ ${MIN_CATEGORIES}`);
  }

  // ─── Gate 3: median quality ───
  const scores = rows
    .map((r) => r.quality_score)
    .filter((q): q is number => typeof q === "number")
    .sort((a, b) => a - b);
  if (scores.length === 0) {
    failures.push("No rows have a numeric quality_score — curator failed to score.");
  } else {
    const median =
      scores.length % 2 === 0
        ? (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
        : scores[Math.floor(scores.length / 2)];
    if (median < MIN_MEDIAN_QUALITY) {
      failures.push(
        `Median quality_score: ${median.toFixed(3)} (need ≥${MIN_MEDIAN_QUALITY}). ` +
          `Curator may be admitting too many low-quality sources.`
      );
    } else {
      console.log(`   ✓ median quality: ${median.toFixed(3)} ≥ ${MIN_MEDIAN_QUALITY}`);
    }
  }

  // ─── Gate 4: paywall mix ───
  const freeFreemium = rows.filter(
    (r) => r.paywall_tier === "free" || r.paywall_tier === "freemium"
  ).length;
  const freePct = rows.length === 0 ? 0 : freeFreemium / rows.length;
  if (freePct < MIN_FREE_FREEMIUM_PCT) {
    failures.push(
      `Paywall mix: ${(freePct * 100).toFixed(1)}% free/freemium ` +
        `(need ≥${(MIN_FREE_FREEMIUM_PCT * 100).toFixed(0)}%). Catalog skews paid; ` +
        `free-tier users would have nothing to pick.`
    );
  } else {
    console.log(
      `   ✓ paywall mix: ${(freePct * 100).toFixed(1)}% free/freemium ≥ ${(
        MIN_FREE_FREEMIUM_PCT * 100
      ).toFixed(0)}%`
    );
  }

  // ─── Gate 5: embedding coverage ───
  // Counts come from the server-side `head: true` count above, which
  // queries `embedding IS NOT NULL` directly in Postgres rather than
  // round-tripping the vector through PostgREST.
  const embedPct = rows.length === 0 ? 0 : withEmbeddingCount / rows.length;
  if (embedPct < MIN_EMBEDDING_COVERAGE) {
    failures.push(
      `Embedding coverage: ${(embedPct * 100).toFixed(1)}% rows have embeddings ` +
        `(need ≥${(MIN_EMBEDDING_COVERAGE * 100).toFixed(0)}%). Run the embed backfill: ` +
        `npx tsx scripts/embed-source-catalog.ts (Phase 1.5 close task).`
    );
  } else {
    console.log(
      `   ✓ embedding coverage: ${(embedPct * 100).toFixed(1)}% ≥ ${(
        MIN_EMBEDDING_COVERAGE * 100
      ).toFixed(0)}%`
    );
  }

  if (failures.length > 0) {
    console.log("");
    console.log("❌ verify-source-catalog: gate failures:");
    for (const f of failures) console.log(`   ✗ ${f}`);
    process.exit(1);
  }

  console.log("");
  console.log("✅ verify-source-catalog: all gates passed");
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
