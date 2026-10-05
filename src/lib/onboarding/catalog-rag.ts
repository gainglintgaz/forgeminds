/**
 * Catalog RAG — semantic search over `source_catalog` for the
 * onboarding agent.
 *
 * Two retrieval paths:
 *
 *   1. **Embedding similarity** (primary). User intent → embed via
 *      OpenAI text-embedding-3-small → cosine search against the
 *      catalog's `embedding` column → top-K candidates ordered by
 *      relevance. Used for "what catalog entries best match what the
 *      user said?".
 *
 *   2. **Filter-then-rank** (filter pass before #1). Apply the user's
 *      paywall_pref + geography + depth_pref to the catalog as a
 *      WHERE clause first. This narrows the search space so the
 *      vector ANN doesn't return paid-only sources to free-tier users
 *      or US-only sources to a user who said "I'm in Berlin."
 *
 * The agent (agent.ts) calls `retrieveCandidates(intent, k)` and gets
 * back a ranked list; it then asks the LLM to draft per-source
 * `reason` strings ("Because you mentioned biotech and want depth, I'm
 * suggesting Nature Medicine").
 *
 * Server-side only.
 */

import { embedText } from "@/lib/ai/providers/openai";
import { createServiceClient } from "@/lib/supabase/server";
import type { UserIntent, SourceProposal } from "./types";

/** Candidate row shape from the catalog query. */
interface CatalogRow {
  id: string;
  name: string;
  description: string;
  url: string;
  type: string;
  paywall_tier: "free" | "freemium" | "paid" | "byos";
  paywall_cost_usd_monthly: number | null;
  recommended_for_topics: string[] | null;
  geography: string[] | null;
  quality_score: number | null;
  similarity: number;
}

const DEFAULT_TOP_K = 25;

/** Map paywall_pref → set of paywall_tier values the user accepts. */
const PAYWALL_PREF_TO_TIERS: Record<UserIntent["paywallPref"], string[]> = {
  free_only: ["free"],
  freemium_ok: ["free", "freemium"],
  paid_ok: ["free", "freemium", "paid", "byos"],
  byos: ["free", "freemium", "byos"],
};

/**
 * Retrieve the top-K catalog candidates ranked by semantic similarity
 * to the user's intent, filtered by paywall + geography preferences.
 *
 * Returns rows in the order the LLM should consider them; the LLM
 * then drafts per-source `reason` strings and decides which to keep.
 */
export async function retrieveCandidates(
  intent: UserIntent,
  topK: number = DEFAULT_TOP_K
): Promise<SourceProposal[]> {
  // Build the embedding query string from intent. Concatenate topics
  // plus depth/cadence cues so the query embeds the full context, not
  // just keywords in isolation.
  const queryText = buildEmbedQuery(intent);
  const { embedding } = await embedText(queryText);

  const allowedTiers = PAYWALL_PREF_TO_TIERS[intent.paywallPref];

  // Use the postgres RPC pattern for vector similarity search. We
  // assume an RPC `match_source_catalog(query_embedding, match_count,
  // allowed_tiers, allowed_geographies)` exists on the DB side. If
  // not yet defined, this throws a clean "rpc not found" error and
  // the caller falls back to keyword-only search.
  //
  // The RPC SQL lives in supabase/seeds/source_catalog_rag_rpc.sql
  // (committed with the catalog seed for Phase 1.5 close).
  const supabase = await createServiceClient();
  const { data, error } = await supabase.rpc("match_source_catalog", {
    query_embedding: embedding,
    match_count: topK,
    allowed_tiers: allowedTiers,
    allowed_geographies:
      intent.geography.length > 0 && !intent.geography.includes("global")
        ? [...intent.geography, "global"] // "global" sources always allowed
        : null, // null = no geo filter
  });

  if (error) {
    // RPC missing or RLS blocked. Bubble a clean error — the agent
    // can decide to fall back to a keyword-only search.
    throw new RagSearchError(
      `match_source_catalog rpc failed: ${error.message}. Apply seeds/source_catalog_rag_rpc.sql.`,
      error
    );
  }

  const rows = (data ?? []) as CatalogRow[];
  return rows.map(rowToProposal);
}

function buildEmbedQuery(intent: UserIntent): string {
  const parts: string[] = [];
  parts.push(`Topics: ${intent.topics.join(", ")}.`);
  parts.push(`Depth: ${intent.depthPref}.`);
  parts.push(`Cadence: ${intent.cadencePref}.`);
  if (intent.geography.length > 0 && !intent.geography.includes("global")) {
    parts.push(`Geography: ${intent.geography.join(", ")}.`);
  }
  // Include the raw description so subtle context the structured
  // fields lost (e.g. "I'm a doctor specializing in oncology") still
  // influences the embedding.
  parts.push(`Original description: ${intent.rawDescription}`);
  return parts.join(" ");
}

function rowToProposal(row: CatalogRow): SourceProposal {
  return {
    catalogId: row.id,
    name: row.name,
    description: row.description,
    url: row.url,
    type: row.type,
    paywallTier: row.paywall_tier,
    paywallCostUsdMonthly: row.paywall_cost_usd_monthly,
    // Reason is filled in by the agent after this retrieval step.
    reason: "",
    rankScore: clamp01(row.similarity),
    enabled: true,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export class RagSearchError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RagSearchError";
  }
}
