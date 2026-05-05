import type { AIRequest, AIResponse } from "@/lib/types/ai";

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
 * Pricing (2026-05): https://www.anthropic.com/pricing
 *   sonnet 3.5/4: $3.00 / $15.00 per 1M input/output
 *   haiku 3.5:    $0.80 / $4.00  per 1M input/output
 *   cached read:  10% of base input price
 *   cache write:  125% of base input price (one-time per cache miss)
 *
 * Costs below are sonnet 4 baseline; calculated cost reflects what
 * Anthropic actually billed (output of a non-streaming call returns
 * usage stats — we trust those, not our local guess).
 *
 * Why server-side only: Anthropic SDK + secret API key. Privacy rule
 * #38 (factory): never `dangerouslyAllowBrowser: true`.
 */

const SONNET_MODEL = "claude-sonnet-4-20250514";
const HAIKU_MODEL = "claude-haiku-4-5";
const SONNET_INPUT_PER_M = 3.0;
const SONNET_OUTPUT_PER_M = 15.0;
const HAIKU_INPUT_PER_M = 0.8;
const HAIKU_OUTPUT_PER_M = 4.0;

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

  // Cost reflects cache pricing: cache_read = 10% input, cache_creation = 125% input.
  const baseInputCost = (inputTokens * inputPerM) / 1_000_000;
  const cacheReadCost = (cacheReadTokens * inputPerM * 0.1) / 1_000_000;
  const cacheCreationCost = (cacheCreationTokens * inputPerM * 1.25) / 1_000_000;
  const outputCost = (outputTokens * outputPerM) / 1_000_000;

  return {
    content,
    model,
    inputTokens: inputTokens + cacheReadTokens + cacheCreationTokens,
    outputTokens,
    costEstimateUsd: baseInputCost + cacheReadCost + cacheCreationCost + outputCost,
  };
}
