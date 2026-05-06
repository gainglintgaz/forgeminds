import type { AIRequest, AIResponse } from "@/lib/types/ai";
import { MODELS, COSTS } from "../models";

/**
 * Perplexity Sonar provider — live web research with citations.
 *
 * What we use it for:
 *   - "research" task: ground a brief / action plan in fresh web data
 *   - Source-validator subagent fallback: when WebFetch can't tell us
 *     "is this RSS feed actually live?", Sonar's web-grounded answer
 *     can fill in (e.g., "the feed last updated 2 weeks ago per its
 *     XML metadata visible at <url>")
 *   - Multi-step agent (Phase 9.B): the "research" step that pulls
 *     real-time info before draft + schedule
 *
 * Phase 3+: Finance Search tool — the Agent API supports a
 * `tools: [{type: 'finance_search'}]` flag that returns structured
 * licensed financial data ($5/1k invocations + token usage). Direct
 * fit for VECTORS.md vector #1 investment as a Layer-1 source. See
 * IDEAS.md "Perplexity Finance Search as Layer-1 source for
 * investment-vector action templates".
 *
 * Model pins + cost constants live in @/lib/ai/models.
 *
 * We default to sonar (the cheap one) — sonar-pro is reserved for
 * high-stakes deep-research turns where citation count and reasoning
 * depth matter.
 *
 * Server-side only.
 */

const SONAR_MODEL = MODELS.PERPLEXITY;
const SONAR_PRO_MODEL = MODELS.PERPLEXITY_PRO;
const SONAR_INPUT_PER_M = COSTS.PERPLEXITY_INPUT_PER_M;
const SONAR_OUTPUT_PER_M = COSTS.PERPLEXITY_OUTPUT_PER_M;
const SONAR_SEARCH_PER_K = COSTS.PERPLEXITY_SEARCH_PER_K;
const SONAR_PRO_INPUT_PER_M = COSTS.PERPLEXITY_PRO_INPUT_PER_M;
const SONAR_PRO_OUTPUT_PER_M = COSTS.PERPLEXITY_PRO_OUTPUT_PER_M;
const SONAR_PRO_SEARCH_PER_K = COSTS.PERPLEXITY_PRO_SEARCH_PER_K;

export interface PerplexityRequest extends AIRequest {
  /** Use sonar-pro for deeper research; default sonar. */
  pro?: boolean;
  /** Restrict search to specific domains (e.g. ['nature.com', 'nih.gov']). */
  domainFilter?: string[];
}

export interface PerplexityResponse
  extends Omit<AIResponse, "promptVersion" | "latencyMs"> {
  /** Sources Perplexity cited; pass-through to UI for transparency. */
  citations: string[];
}

export async function callPerplexity(
  request: PerplexityRequest
): Promise<PerplexityResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not set");

  const model = request.pro ? SONAR_PRO_MODEL : SONAR_MODEL;
  const inputPerM = request.pro ? SONAR_PRO_INPUT_PER_M : SONAR_INPUT_PER_M;
  const outputPerM = request.pro ? SONAR_PRO_OUTPUT_PER_M : SONAR_OUTPUT_PER_M;
  const searchPerK = request.pro ? SONAR_PRO_SEARCH_PER_K : SONAR_SEARCH_PER_K;

  const messages: Array<{ role: string; content: string }> = [];
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  messages.push({ role: "user", content: request.prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: request.maxTokens || 2048,
    temperature: 0.2,
    return_citations: true,
  };

  if (request.domainFilter && request.domainFilter.length > 0) {
    body.search_domain_filter = request.domainFilter;
  }

  if (request.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Perplexity API error ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const usage = data.usage || {};
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;

  // Citations are returned at the top level of the response, not on
  // the message. Defensive: handle absent / non-array.
  const rawCitations = data.citations;
  const citations: string[] = Array.isArray(rawCitations)
    ? rawCitations.filter((c): c is string => typeof c === "string")
    : [];

  // Cost = token cost + per-search charge. Each call counts as 1 search.
  const tokenCost =
    (inputTokens * inputPerM + outputTokens * outputPerM) / 1_000_000;
  const searchCost = searchPerK / 1000;

  return {
    content,
    model,
    inputTokens,
    outputTokens,
    costEstimateUsd: tokenCost + searchCost,
    citations,
  };
}
