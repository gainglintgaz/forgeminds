import type { AIRequest, AIResponse, ModelProvider, TaskType } from "@/lib/types/ai";
import { callGemini } from "./providers/gemini";
import { callGrok } from "./providers/grok";

// Task → preferred model mapping
const TASK_MODEL_MAP: Record<TaskType, ModelProvider> = {
  "score": "gemini-flash",
  "categorize": "gemini-flash",
  "generate-social": "grok",
  "generate-brief": "grok",
  "generate-blog": "grok",
  "deep-analysis": "grok",
  "embed": "openai-embeddings",
  "research": "perplexity",
};

// Fallback chain: if primary fails, try these in order
const FALLBACK_CHAIN: Record<ModelProvider, ModelProvider[]> = {
  "gemini-flash": ["grok"],
  "grok": ["gemini-flash"],
  "claude-haiku": ["grok", "gemini-flash"],
  "claude-sonnet": ["grok"],
  "openai-embeddings": [],
  "perplexity": ["grok"],
  "local": [],
};

const PROMPT_VERSION = "v1.0.0";

export async function routeAIRequest(request: AIRequest): Promise<AIResponse> {
  const preferredModel = TASK_MODEL_MAP[request.task];
  const fallbacks = FALLBACK_CHAIN[preferredModel] || [];
  const modelsToTry = [preferredModel, ...fallbacks];

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const startTime = Date.now();
      const response = await callModel(model, request);
      const latencyMs = Date.now() - startTime;

      return {
        ...response,
        promptVersion: PROMPT_VERSION,
        latencyMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[AI Router] ${model} failed for ${request.task}: ${lastError.message}`);
    }
  }

  throw new Error(`[AI Router] All models failed for task ${request.task}. Last error: ${lastError?.message}`);
}

async function callModel(provider: ModelProvider, request: AIRequest): Promise<Omit<AIResponse, "promptVersion" | "latencyMs">> {
  switch (provider) {
    case "gemini-flash":
      return callGemini(request);
    case "grok":
      return callGrok(request);
    default:
      throw new Error(`Provider ${provider} not yet implemented`);
  }
}

export { PROMPT_VERSION };
