import type { AIRequest, AIResponse } from "@/lib/types/ai";

const GEMINI_MODEL = "gemini-2.0-flash";
const COST_PER_M_INPUT = 0.075;
const COST_PER_M_OUTPUT = 0.30;

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
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
