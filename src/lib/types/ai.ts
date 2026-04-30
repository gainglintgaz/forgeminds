export type ModelProvider = "gemini-flash" | "grok" | "claude-haiku" | "claude-sonnet" | "openai-embeddings" | "perplexity" | "local";

export type TaskType = "score" | "categorize" | "generate-social" | "generate-brief" | "generate-blog" | "deep-analysis" | "embed" | "research";

export interface AIRequest {
  task: TaskType;
  prompt: string;
  systemPrompt?: string;
  jsonMode?: boolean;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  costEstimateUsd: number;
  latencyMs: number;
}

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  apiKeyEnv: string;
  endpoint: string;
  costPerMInputTokens: number;
  costPerMOutputTokens: number;
  maxTokens: number;
  timeout: number;
}
