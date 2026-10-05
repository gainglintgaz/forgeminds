/**
 * embed-source-catalog.ts — backfill source_catalog.embedding column
 *
 * Phase 1.5 close blocker P1.5-F. After the source-catalog-curator
 * subagent seeds rows into source_catalog (via SQL INSERTs from
 * supabase/seeds/source_catalog/<category>/<subcategory>.sql), the
 * `embedding` column on each row is null. Without embeddings the
 * onboarding agent's catalog RAG returns 0 candidates → onboarding
 * silently fails.
 *
 * This script:
 *   1. Connects via service-role.
 *   2. Selects every row where embedding is null + is_active = true.
 *   3. Builds a query string per row from name + description +
 *      recommended_for_topics + categories.
 *   4. Batches through embedBatch() (max 100/call to stay well below
 *      OpenAI's 2048 limit + give per-batch progress).
 *   5. Updates each row's embedding column with the vector(1536).
 *   6. Tracks total cost + emits progress per batch.
 *
 * Idempotent: re-running only embeds rows still null. Cheap to re-run
 * after each curator seed batch lands.
 *
 * Cost: text-embedding-3-small = $0.02 per 1M tokens. Each row ~150
 * tokens → ~$0.000003/row → 200-row catalog = $0.0006. Negligible.
 *
 * Usage:
 *   npm run embed:catalog                      # backfill missing embeddings
 *   npm run embed:catalog -- --dry-run         # count rows + estimate cost, no API calls
 *   npm run embed:catalog -- --force           # re-embed ALL active rows (use after model swap)
 *   npm run embed:catalog -- --batch-size=50   # smaller batches (default 100)
 *
 * Verification:
 *   - Re-run npm run verify:source-catalog after applying — embedding
 *     coverage gate (≥95%) should pass.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Reuse the openai provider's embedBatch. It already enforces
// shape/length/empty-input invariants and returns per-item cost.
import { embedBatch, EMBED_DIMENSIONS } from "../src/lib/ai/providers/openai";

// ── env loader (same pattern as verify-db.ts / verify-source-catalog.ts) ──
function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && value && !process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error("⚠ Could not read .env.local:", (err as Error).message);
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env.local");
  process.exit(2);
}
if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY not set in .env.local — required for embeddings");
  process.exit(2);
}

// ── CLI args ──────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const FORCE = argv.includes("--force");
const batchSizeArg = argv.find((a) => a.startsWith("--batch-size="));
const BATCH_SIZE = batchSizeArg
  ? Math.max(1, Math.min(2048, parseInt(batchSizeArg.split("=")[1], 10) || 100))
  : 100;

// ── data shape ────────────────────────────────────────────────────────
interface CatalogRow {
  id: string;
  name: string;
  description: string;
  categories: string[] | null;
  recommended_for_topics: string[] | null;
}

/**
 * Build the embedding query text for a row. The same shape the
 * onboarding agent's catalog-rag.ts uses for query construction so
 * embed-time and query-time vectors live in the same semantic space.
 */
function buildEmbedText(row: CatalogRow): string {
  const parts: string[] = [];
  parts.push(`Source: ${row.name}.`);
  parts.push(`Description: ${row.description}`);
  if (row.categories && row.categories.length > 0) {
    parts.push(`Categories: ${row.categories.join(", ")}.`);
  }
  if (row.recommended_for_topics && row.recommended_for_topics.length > 0) {
    parts.push(`Topics: ${row.recommended_for_topics.join(", ")}.`);
  }
  return parts.join(" ");
}

async function main() {
  console.log("🔍 embed-source-catalog: connecting…");
  const supabase: SupabaseClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // 1. Fetch rows needing embedding.
  let query = supabase
    .from("source_catalog")
    .select("id, name, description, categories, recommended_for_topics")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(5000);
  if (!FORCE) {
    query = query.is("embedding", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error(`❌ Could not load source_catalog rows: ${error.message}`);
    if (error.message.toLowerCase().includes("does not exist")) {
      console.error("   The source_catalog table doesn't exist yet.");
      console.error("   Apply migration 20260510000000_source_catalog.sql first.");
    }
    process.exit(1);
  }

  const rows = (data ?? []) as CatalogRow[];
  if (rows.length === 0) {
    console.log(
      FORCE
        ? "✅ No active rows in source_catalog — nothing to (re-)embed."
        : "✅ Every active row already has an embedding — nothing to do."
    );
    return;
  }

  // 2. Cost estimate up front so the user sees what they're about to spend.
  const totalChars = rows.reduce(
    (sum, r) => sum + buildEmbedText(r).length,
    0
  );
  // Rough heuristic: ~4 chars/token for English. Cost = $0.02 / 1M tokens.
  const estimatedTokens = Math.ceil(totalChars / 4);
  const estimatedCostUsd = (estimatedTokens * 0.02) / 1_000_000;

  console.log(
    `   ${rows.length} row${rows.length === 1 ? "" : "s"} ${
      FORCE ? "to (re-)embed" : "missing embedding"
    }`
  );
  console.log(
    `   ~${estimatedTokens.toLocaleString()} input tokens estimated → ~$${estimatedCostUsd.toFixed(
      6
    )} total`
  );
  console.log(`   batch size: ${BATCH_SIZE}`);

  if (DRY_RUN) {
    console.log("\n🔒 DRY RUN — no API calls made. Re-run without --dry-run to embed.");
    return;
  }

  // 3. Batch through embedBatch.
  let updated = 0;
  let failed = 0;
  let totalCostUsd = 0;
  const startMs = Date.now();

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbedText);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    process.stdout.write(
      `   batch ${batchNum}/${totalBatches} (${batch.length} rows)… `
    );

    let results;
    try {
      results = await embedBatch(texts);
    } catch (e) {
      console.log(`❌ embedBatch failed: ${(e as Error).message}`);
      failed += batch.length;
      continue;
    }

    // Sanity-check the dimension. embedBatch already validates per-call
    // shape but defense-in-depth never hurt anyone.
    const wrongDim = results.find((r) => r.embedding.length !== EMBED_DIMENSIONS);
    if (wrongDim) {
      console.log(
        `❌ unexpected embedding dimension ${wrongDim.embedding.length} (expected ${EMBED_DIMENSIONS})`
      );
      failed += batch.length;
      continue;
    }

    // 4. Persist embeddings — one UPDATE per row. supabase-js JSON-
    // encodes number arrays; PostgREST passes them to PostgreSQL where
    // pgvector implicitly casts JSON-array-of-numbers → vector(1536).
    let batchUpdated = 0;
    let batchFailed = 0;
    let batchCost = 0;
    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const result = results[j];
      const { error: upErr } = await supabase
        .from("source_catalog")
        .update({ embedding: result.embedding, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (upErr) {
        batchFailed += 1;
        console.error(
          `\n      ✗ failed to UPDATE id=${row.id} (${row.name}): ${upErr.message}`
        );
        continue;
      }
      batchUpdated += 1;
      batchCost += result.costEstimateUsd;
    }

    updated += batchUpdated;
    failed += batchFailed;
    totalCostUsd += batchCost;
    console.log(
      `✓ ${batchUpdated} updated${batchFailed > 0 ? `, ${batchFailed} failed` : ""}, $${batchCost.toFixed(6)}`
    );
  }

  // 5. Summary.
  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  embed-source-catalog complete in ${elapsedSec}s`);
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  Updated:    ${updated}`);
  console.log(`  Failed:     ${failed}`);
  console.log(`  Total cost: $${totalCostUsd.toFixed(6)}`);
  console.log("");

  if (failed > 0) {
    console.log("⚠ Some rows failed. Re-run to retry only the still-null ones.");
    process.exit(1);
  }

  console.log("✓ Run `npm run verify:source-catalog` to confirm coverage gate (≥95%) passes.");
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
