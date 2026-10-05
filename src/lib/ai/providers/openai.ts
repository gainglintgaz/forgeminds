/**
 * OpenAI provider — embeddings only (text generation routes through
 * Claude / Gemini / Grok).
 *
 * Why a dedicated module: the AIRequest/AIResponse interface in
 * `@/lib/types/ai` assumes text-in / text-out. Embeddings are a
 * different shape (text in, vector out), so they get their own
 * function and live outside the router.
 *
 * Pricing (2026-05): https://platform.openai.com/docs/pricing
 *   text-embedding-3-small: $0.02 per 1M tokens
 *   text-embedding-3-large: $0.13 per 1M tokens
 *
 * We default to 3-small for source-catalog embeddings — 1536 dims,
 * good enough for top-K semantic recall over a few hundred catalog
 * entries, and ~6× cheaper than 3-large. If recall quality becomes
 * the bottleneck post-Phase-1.5, swap to 3-large (3072 dims) — the
 * column type `vector(1536)` would need to be re-declared.
 *
 * Server-side only. Privacy rule §13 (factory): never send full
 * names, full addresses, SSN/EIN, account numbers to AI APIs. Catalog
 * entries are public information; user intent strings should be
 * scrubbed of PII before reaching this function.
 */

import { MODELS, COSTS, EMBED_DIMENSIONS as REGISTRY_EMBED_DIMENSIONS } from "../models";

const EMBED_MODEL = MODELS.OPENAI_EMBED;
const EMBED_DIMENSIONS = REGISTRY_EMBED_DIMENSIONS;
const COST_PER_M_TOKENS = COSTS.OPENAI_EMBED_PER_M;

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
  inputTokens: number;
  costEstimateUsd: number;
}

/**
 * Embed a single text string. Returns a 1536-dimension vector matching
 * the column type `source_catalog.embedding` (and any other vector
 * column in the schema using the same model).
 */
export async function embedText(text: string): Promise<EmbeddingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  if (!text || text.trim().length === 0) {
    throw new Error("[embedText] empty text — refuse to embed (would waste an API call)");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: text,
      dimensions: EMBED_DIMENSIONS,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI embeddings error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const vec: number[] = data.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== EMBED_DIMENSIONS) {
    throw new Error(
      `[embedText] unexpected response shape: expected number[${EMBED_DIMENSIONS}], got ${
        Array.isArray(vec) ? `number[${vec.length}]` : typeof vec
      }`
    );
  }

  const inputTokens = data.usage?.prompt_tokens || 0;

  return {
    embedding: vec,
    model: EMBED_MODEL,
    dimensions: EMBED_DIMENSIONS,
    inputTokens,
    costEstimateUsd: (inputTokens * COST_PER_M_TOKENS) / 1_000_000,
  };
}

/**
 * Embed multiple texts in one batch call. OpenAI accepts up to 2048
 * inputs per request; this helper does NOT chunk that — caller must
 * keep batches ≤ 2048. Use for catalog backfills + onboarding RAG
 * pre-computation.
 */
export async function embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  if (texts.length === 0) return [];
  if (texts.length > 2048) {
    throw new Error(`[embedBatch] batch size ${texts.length} exceeds OpenAI limit of 2048`);
  }
  if (texts.some((t) => !t || t.trim().length === 0)) {
    throw new Error("[embedBatch] one or more texts empty — refuse to embed");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
      dimensions: EMBED_DIMENSIONS,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI embeddings batch error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const items = data.data;
  if (!Array.isArray(items) || items.length !== texts.length) {
    throw new Error(
      `[embedBatch] response length mismatch: sent ${texts.length}, received ${
        Array.isArray(items) ? items.length : "non-array"
      }`
    );
  }

  // OpenAI returns per-call usage, not per-item. Distribute proportionally
  // by character count for fairness in cost attribution.
  const totalInputTokens: number = data.usage?.prompt_tokens || 0;
  const totalChars = texts.reduce((sum, t) => sum + t.length, 0) || 1;

  return texts.map((text, i) => {
    const item = items[i];
    const vec: number[] = item.embedding;
    const itemTokens = Math.round((text.length / totalChars) * totalInputTokens);
    return {
      embedding: vec,
      model: EMBED_MODEL,
      dimensions: EMBED_DIMENSIONS,
      inputTokens: itemTokens,
      costEstimateUsd: (itemTokens * COST_PER_M_TOKENS) / 1_000_000,
    };
  });
}

export { EMBED_MODEL, EMBED_DIMENSIONS };
