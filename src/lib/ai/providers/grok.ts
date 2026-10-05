import type { AIRequest, AIResponse } from "@/lib/types/ai";
import { MODELS, COSTS } from "../models";

const GROK_MODEL = MODELS.GROK;
const COST_PER_M_INPUT = COSTS.GROK_INPUT_PER_M;
const COST_PER_M_OUTPUT = COSTS.GROK_OUTPUT_PER_M;

export async function callGrok(
  request: AIRequest
): Promise<Omit<AIResponse, "promptVersion" | "latencyMs">> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY not set");

  const messages: Array<{ role: string; content: string }> = [];

  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }

  messages.push({ role: "user", content: request.prompt });

  const body: Record<string, unknown> = {
    model: GROK_MODEL,
    messages,
    max_tokens: request.maxTokens || 2048,
    temperature: 0.3,
  };

  if (request.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Grok API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  const usage = data.usage || {};
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;

  return {
    content,
    model: GROK_MODEL,
    inputTokens,
    outputTokens,
    costEstimateUsd: (inputTokens * COST_PER_M_INPUT + outputTokens * COST_PER_M_OUTPUT) / 1_000_000,
  };
}
