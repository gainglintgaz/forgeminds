import type { AIRequest, AIResponse } from "@/lib/types/ai";
import { MODELS, COSTS } from "../models";

const GEMINI_MODEL = MODELS.GEMINI_FAST;
const COST_PER_M_INPUT = COSTS.GEMINI_INPUT_PER_M;
const COST_PER_M_OUTPUT = COSTS.GEMINI_OUTPUT_PER_M;

export async function callGemini(
  request: AIRequest
): Promise<Omit<AIResponse, "promptVersion" | "latencyMs">> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: request.prompt }] }],
    generationConfig: {
      maxOutputTokens: request.maxTokens || 2048,
      temperature: 0.3,
      // gemini-2.5-flash is a thinking model: by default reasoning tokens eat
      // the output budget and can leave the JSON answer empty/truncated
      // ("Unexpected end of JSON input"). Gemini is our triage/scoring model —
      // it needs reliable structured output, not chain-of-thought — so disable
      // thinking (full budget → the answer). Big quality reasoning is Claude's job.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  if (request.systemPrompt) {
    body.systemInstruction = { parts: [{ text: request.systemPrompt }] };
  }

  if (request.jsonMode) {
    (body.generationConfig as Record<string, unknown>).responseMimeType = "application/json";
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  // Join all NON-thought text parts (a thinking model can split the answer
  // across parts and/or prepend a thought part with no usable text). Reading
  // only parts[0].text loses the answer when the first part is a thought.
  const parts: Array<{ text?: string; thought?: boolean }> =
    data.candidates?.[0]?.content?.parts ?? [];
  const content = parts
    .filter((p) => !p?.thought)
    .map((p) => p?.text ?? "")
    .join("")
    .trim();
  const usage = data.usageMetadata || {};
  const inputTokens = usage.promptTokenCount || 0;
  const outputTokens = usage.candidatesTokenCount || 0;

  return {
    content,
    model: GEMINI_MODEL,
    inputTokens,
    outputTokens,
    costEstimateUsd: (inputTokens * COST_PER_M_INPUT + outputTokens * COST_PER_M_OUTPUT) / 1_000_000,
  };
}
