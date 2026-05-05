import type { AIRequest, AIResponse, ModelProvider, TaskType } from "@/lib/types/ai";
import { callGemini } from "./providers/gemini";
import { callGrok } from "./providers/grok";
import { callClaude } from "./providers/claude";
import { callPerplexity } from "./providers/perplexity";

// Task → preferred model mapping.
// `embed` is intentionally NOT routed here — embeddings have a
// vector-shaped response that doesn't fit AIResponse. Call
// `embedText()` from `./providers/openai` directly instead.
const TASK_MODEL_MAP: Record<TaskType, ModelProvider> = {
  "score": "gemini-flash",
  "categorize": "gemini-flash",
  "generate-social": "grok",
  "generate-brief": "claude-sonnet",     // brief synthesis: writing quality matters
  "generate-blog": "claude-sonnet",      // long-form content: voice + structure
  "deep-analysis": "claude-sonnet",      // multi-step reasoning, complex prompts
  "embed": "openai-embeddings",          // not routed — see embedText() in openai.ts
  "research": "perplexity",              // live-web grounded research
};

// Fallback chain: if primary fails, try these in order. Skip routing
// to providers that produce a fundamentally different response shape
// (embeddings, citations) — those are explicit-call APIs.
const FALLBACK_CHAIN: Record<ModelProvider, ModelProvider[]> = {
  "gemini-flash": ["grok", "claude-haiku"],
  "grok": ["gemini-flash", "claude-haiku"],
  "claude-haiku": ["grok", "gemini-flash"],
  "claude-sonnet": ["claude-haiku", "grok"],
  "openai-embeddings": [],
  "perplexity": ["claude-sonnet"],       // research → fall back to a smart text model
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
    case "claude-haiku":
      return callClaude({ ...request, useHaiku: true });
    case "claude-sonnet":
      return callClaude({ ...request, useHaiku: false });
    case "perplexity": {
      // Drop citations from the routed response so the shape matches
      // AIResponse. Callers that need citations should call
      // callPerplexity directly instead of going through the router.
      const { citations: _citations, ...rest } = await callPerplexity(request);
      void _citations;
      return rest;
    }
    case "openai-embeddings":
      throw new Error(
        "[AI Router] openai-embeddings cannot be routed through routeAIRequest — embeddings return a vector, not text. Call embedText() from @/lib/ai/providers/openai directly."
      );
    case "local":
      throw new Error("[AI Router] 'local' provider not yet implemented (Phase 6+: Ollama / on-device).");
    default: {
      // Exhaustive switch: TypeScript will error here if a new provider
      // is added to the ModelProvider type without a case above.
      const _exhaustive: never = provider;
      void _exhaustive;
      throw new Error(`Provider ${provider} not yet implemented`);
    }
  }
}

export { PROMPT_VERSION };
