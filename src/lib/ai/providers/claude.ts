import type { AIRequest, AIResponse } from "@/lib/types/ai";
import { MODELS, COSTS } from "../models";

/**
 * Anthropic Claude provider — text generation via Messages API.
 *
 * Routing:
 *   - claude-sonnet  → onboarding conversation, deep analysis, voice DNA
 *   - claude-haiku   → fast/cheap synthesis (action plans, drafts pre-approval)
 *
 * Prompt caching is critical for the onboarding agent: the source
 * catalog (~50K tokens of JSON) is sent on every turn; Anthropic
 * prompt caching amortizes that cost across the conversation. To
 * enable caching, pass `cacheableSystemPrompt` instead of `systemPrompt`.
 *
 * Model pins + cost constants live in @/lib/ai/models — single source
 * of truth for all five providers. Bumping versions or adjusting
 * pricing happens there, not here.
 *
 * Why server-side only: Anthropic SDK + secret API key. Privacy rule
 * #38 (factory): never `dangerouslyAllowBrowser: true`.
 */

const SONNET_MODEL = MODELS.CLAUDE_SONNET;
const HAIKU_MODEL = MODELS.CLAUDE_HAIKU;
const SONNET_INPUT_PER_M = COSTS.SONNET_INPUT_PER_M;
const SONNET_OUTPUT_PER_M = COSTS.SONNET_OUTPUT_PER_M;
const HAIKU_INPUT_PER_M = COSTS.HAIKU_INPUT_PER_M;
const HAIKU_OUTPUT_PER_M = COSTS.HAIKU_OUTPUT_PER_M;

export interface ClaudeRequest extends AIRequest {
  /**
   * Variant of `systemPrompt` that opts into Anthropic prompt caching.
   * Use for: source catalog JSON, brand-voice exemplars, action template
   * libraries — anything that doesn't change between turns of the same
   * conversation. Cache TTL is 5 minutes; subsequent reads are 10% of
   * base input price.
   */
  cacheableSystemPrompt?: string;
  /** Use Haiku instead of Sonnet (cheaper / faster). */
  useHaiku?: boolean;
}

export async function callClaude(
  request: ClaudeRequest
): Promise<Omit<AIResponse, "promptVersion" | "latencyMs">> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const model = request.useHaiku ? HAIKU_MODEL : SONNET_MODEL;
  const inputPerM = request.useHaiku ? HAIKU_INPUT_PER_M : SONNET_INPUT_PER_M;
  const outputPerM = request.useHaiku ? HAIKU_OUTPUT_PER_M : SONNET_OUTPUT_PER_M;

  // Build system message: array form with optional cache_control on the
  // cacheable block. Anthropic recognizes the cache marker and treats
  // every input ≥ that block as a cache key.
  type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
  const systemBlocks: SystemBlock[] = [];
  if (request.systemPrompt) {
    systemBlocks.push({ type: "text", text: request.systemPrompt });
  }
  if (request.cacheableSystemPrompt) {
    systemBlocks.push({
      type: "text",
      text: request.cacheableSystemPrompt,
      cache_control: { type: "ephemeral" },
    });
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: request.maxTokens || 4096,
    messages: [{ role: "user", content: request.prompt }],
  };

  if (systemBlocks.length > 0) body.system = systemBlocks;

  // JSON mode: Anthropic doesn't have a strict JSON-mode toggle like
  // OpenAI/Gemini. Best practice is to set the system prompt to instruct
  // JSON output and let the model produce it. We append a directive when
  // jsonMode is true.
  if (request.jsonMode) {
    const jsonDirective = "\n\nRespond ONLY with valid JSON. No prose, no markdown, no code fences.";
    if (systemBlocks.length > 0) {
      systemBlocks[systemBlocks.length - 1].text += jsonDirective;
    } else {
      body.system = [{ type: "text", text: jsonDirective.trimStart() }];
    }
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || "";
  const usage = data.usage || {};
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens || 0;

  // Cost reflects cache pricing per the registry's CACHE_*_MULTIPLIER
  // constants (10% read, 125% write — Anthropic standard).
  const baseInputCost = (inputTokens * inputPerM) / 1_000_000;
  const cacheReadCost =
    (cacheReadTokens * inputPerM * COSTS.CACHE_READ_MULTIPLIER) / 1_000_000;
  const cacheCreationCost =
    (cacheCreationTokens * inputPerM * COSTS.CACHE_WRITE_MULTIPLIER) / 1_000_000;
  const outputCost = (outputTokens * outputPerM) / 1_000_000;

  return {
    content,
    model,
    inputTokens: inputTokens + cacheReadTokens + cacheCreationTokens,
    outputTokens,
    costEstimateUsd: baseInputCost + cacheReadCost + cacheCreationCost + outputCost,
  };
}
