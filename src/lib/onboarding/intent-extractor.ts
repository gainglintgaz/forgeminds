/**
 * Intent extractor — turns the user's free-form intake message into a
 * structured UserIntent that the rest of the onboarding flow consumes.
 *
 * Strategy: send the message to Claude Haiku with a JSON-mode system
 * prompt, parse the response, validate it against UserIntent. Haiku
 * because the task is straightforward (~1K input + ~500 output tokens),
 * Sonnet would be overkill at 4× the cost.
 *
 * Failure modes handled:
 *   - Model returns invalid JSON         → throw IntentExtractionError
 *   - Model returns missing required keys → fill defaults, log warn
 *   - Model returns unknown enum values   → map to closest valid, log warn
 *
 * NEVER returns silently with empty topics. If the user typed
 * gibberish, we'd rather throw + show a "could you say more?" prompt
 * than commit a useless intent shape.
 */

import { callClaude } from "@/lib/ai/providers/claude";
import type { UserIntent } from "./types";

const SYSTEM_PROMPT = `You are an intent-extraction assistant for ForgeMinds, a personal intelligence OS. Given a user's plain-language description of what they want their personal news pipeline to cover, return a strict JSON object with this exact shape:

{
  "topics": [string],            // high-signal topic tokens (snake_case or hyphen-case). examples: ["biotech", "monetary_policy", "f1_racing", "ai_ml", "climate_tech"]
  "depthPref": "shallow" | "medium" | "deep",   // shallow=quick takes/headlines, medium=summaries+context, deep=long-form analysis/journals
  "cadencePref": "realtime" | "daily" | "weekly",  // how often they want updates
  "paywallPref": "free_only" | "freemium_ok" | "paid_ok" | "byos",  // what they'll pay; byos=Bring Your Own Subscription (already pay for sources elsewhere)
  "geography": [string]          // e.g. ["global"], ["us"], ["us","eu"], ["cn"]. default ["global"] if not specified.
}

Rules:
- Output ONLY the JSON object. No prose, no markdown, no code fences.
- topics: 3-10 items, no duplicates, lowercase + underscore-or-hyphen format only.
- If user is vague, infer the most likely values from context — don't ask.
- Default depthPref to "medium" if unclear, cadencePref to "daily", paywallPref to "free_only", geography to ["global"].
- If user mentions a specific paid subscription they already have (e.g. "I have WSJ"), set paywallPref to "byos".`;

export class IntentExtractionError extends Error {
  constructor(message: string, public readonly raw?: string) {
    super(message);
    this.name = "IntentExtractionError";
  }
}

const VALID_DEPTH = new Set(["shallow", "medium", "deep"] as const);
const VALID_CADENCE = new Set(["realtime", "daily", "weekly"] as const);
const VALID_PAYWALL = new Set(["free_only", "freemium_ok", "paid_ok", "byos"] as const);

export async function extractIntent(rawDescription: string): Promise<UserIntent> {
  if (!rawDescription || rawDescription.trim().length < 10) {
    throw new IntentExtractionError(
      "Description too short — need at least 10 characters of context to extract intent."
    );
  }

  const response = await callClaude({
    task: "categorize",
    prompt: rawDescription,
    systemPrompt: SYSTEM_PROMPT,
    jsonMode: true,
    maxTokens: 800,
    useHaiku: true,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.content);
  } catch (e) {
    throw new IntentExtractionError(
      `Model returned non-JSON output: ${(e as Error).message}`,
      response.content
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new IntentExtractionError("Model returned non-object", response.content);
  }
  const obj = parsed as Record<string, unknown>;

  // Topics: required, ≥1 item, all strings.
  const rawTopics = obj.topics;
  if (!Array.isArray(rawTopics) || rawTopics.length === 0) {
    throw new IntentExtractionError(
      "No topics extracted — user input was likely too vague to act on.",
      response.content
    );
  }
  const topics = rawTopics
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "_"));

  if (topics.length === 0) {
    throw new IntentExtractionError("All topics were non-string or empty", response.content);
  }

  // Coerce + default the enum fields.
  const depthPref = coerceEnum(obj.depthPref, VALID_DEPTH, "medium" as const);
  const cadencePref = coerceEnum(obj.cadencePref, VALID_CADENCE, "daily" as const);
  const paywallPref = coerceEnum(obj.paywallPref, VALID_PAYWALL, "free_only" as const);

  // Geography: default ["global"] if missing/empty.
  const rawGeo = obj.geography;
  const geography =
    Array.isArray(rawGeo) && rawGeo.length > 0
      ? rawGeo.filter((g): g is string => typeof g === "string").map((g) => g.toLowerCase().trim())
      : ["global"];

  return {
    topics: Array.from(new Set(topics)).slice(0, 10),
    depthPref,
    cadencePref,
    paywallPref,
    geography: Array.from(new Set(geography)),
    rawDescription,
  };
}

function coerceEnum<T extends string>(value: unknown, valid: ReadonlySet<T>, fallback: T): T {
  if (typeof value === "string" && (valid as ReadonlySet<string>).has(value)) {
    return value as T;
  }
  return fallback;
}
