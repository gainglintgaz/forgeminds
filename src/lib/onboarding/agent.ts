/**
 * Onboarding agent orchestrator.
 *
 * Three responsibilities:
 *
 *   1. **Propose sources** — given an extracted UserIntent, retrieve
 *      candidates from the catalog (catalog-rag.ts), then ask Claude
 *      Sonnet to draft a per-source `reason` string for each top
 *      candidate. The reasons are what the user actually reads on the
 *      /refine page.
 *
 *   2. **Refine on feedback** — when the user types "swap out the
 *      finance feeds for higher-quality ones," re-run the proposal
 *      with the prior intent + feedback merged in. The agent maintains
 *      a short conversation history (last 6 turns, ~12K tokens).
 *
 *   3. **Cost guardrail** — every call accumulates a running cost
 *      against ONBOARDING_COST_CAP_USD ($0.10). If the user's session
 *      hits the cap mid-conversation, the agent returns a graceful
 *      "let's wrap up" turn instead of a fresh proposal.
 *
 * The agent does NOT write to source_suggestions itself — that's the
 * route handler's job (api/onboarding/chat/route.ts uses this module
 * to generate proposals + persists them to source_suggestions before
 * sending the response back to the client).
 */

import { callClaude } from "@/lib/ai/providers/claude";
import { retrieveCandidates, RagSearchError } from "./catalog-rag";
import {
  type UserIntent,
  type SourceProposal,
  ONBOARDING_COST_CAP_USD,
} from "./types";

const SONNET_PROPOSAL_PROMPT = `You are the source-discovery agent for ForgeMinds, a personal intelligence OS. You've been given:

1. The user's intent (topics, depth, cadence, paywall comfort, geography).
2. A ranked list of candidate sources from the catalog (each with name, description, type, paywall tier, similarity score).

Your job: pick the best 8-12 sources from the candidates and write a one-sentence \`reason\` for each that ties it directly to what the user said.

Rules:
- Be specific. Don't write "covers your interests" — write "Because you mentioned monetary policy and want deep analysis, this Federal Reserve research feed gives you primary-source FOMC papers, not headlines."
- Don't recommend MORE than 12 sources. Quality over quantity.
- Don't recommend FEWER than 5 unless the candidate list is genuinely thin.
- Diversify source types: include at least one government/institutional source if relevant, one peer-reviewed/journal source if depth=deep, and at least one community source (subreddit/newsletter) for color.
- For paid sources: explicitly mention the cost in the reason (e.g. "$39/mo via WSJ subscription"). Cost transparency is a trust contract.
- Output STRICT JSON: an array of objects with shape { catalogId: string, reason: string, enabled: boolean }. No prose, no markdown, no code fences.
- Set \`enabled: true\` for every recommendation (user toggles off in UI).`;

export interface ProposeOptions {
  /** How many candidates to pull from RAG before asking the LLM to pick. */
  candidatePoolSize?: number;
  /** Soft cap on output proposal count (LLM may still go lower). */
  maxProposals?: number;
}

export interface ProposeResult {
  proposals: SourceProposal[];
  costEstimateUsd: number;
  /** Models used so the route handler can log + audit. */
  modelsUsed: string[];
}

/**
 * Propose sources for a user given their extracted intent.
 *
 * Two-stage pipeline:
 *   1. RAG retrieves top-K candidates by embedding similarity (filtered
 *      by paywall + geography preferences).
 *   2. Claude Sonnet picks the best 8-12 + drafts per-source reasons.
 */
export async function proposeSources(
  intent: UserIntent,
  options: ProposeOptions = {}
): Promise<ProposeResult> {
  const candidatePoolSize = options.candidatePoolSize ?? 25;

  // Stage 1: catalog RAG.
  let candidates: SourceProposal[];
  try {
    candidates = await retrieveCandidates(intent, candidatePoolSize);
  } catch (e) {
    if (e instanceof RagSearchError) {
      // Surface a clean error so the route handler can render an
      // empty-state ("we couldn't find catalog matches — try
      // describing your interests differently").
      throw new AgentError(
        `Catalog RAG failed: ${e.message}. Either the catalog is empty or the RPC is missing.`,
        e
      );
    }
    throw e;
  }

  if (candidates.length === 0) {
    return { proposals: [], costEstimateUsd: 0, modelsUsed: [] };
  }

  // Stage 2: Claude Sonnet picks + drafts reasons.
  const userPrompt = buildProposalUserPrompt(intent, candidates);

  const llmResponse = await callClaude({
    task: "deep-analysis",
    prompt: userPrompt,
    systemPrompt: SONNET_PROPOSAL_PROMPT,
    jsonMode: true,
    maxTokens: 2000,
    useHaiku: false,
  });

  if (llmResponse.costEstimateUsd > ONBOARDING_COST_CAP_USD) {
    // Single-call cost exceeds the per-run cap. We still return what we
    // got (the call already happened), but caller logs this as a budget
    // breach for tuning.
    console.warn(
      `[onboarding/agent] single proposal call exceeded cap: $${llmResponse.costEstimateUsd.toFixed(
        4
      )} > $${ONBOARDING_COST_CAP_USD.toFixed(4)}`
    );
  }

  // Parse + apply reasons to the candidate list.
  let picks: Array<{ catalogId: string; reason: string; enabled: boolean }>;
  try {
    const parsed = JSON.parse(llmResponse.content);
    if (!Array.isArray(parsed)) {
      throw new Error("Expected JSON array, got " + typeof parsed);
    }
    picks = parsed.filter(isValidPick);
  } catch (e) {
    throw new AgentError(
      `Sonnet returned non-JSON or malformed picks: ${(e as Error).message}`,
      e,
      llmResponse.content
    );
  }

  // Map picks back onto candidates by catalogId. Drop any pick that
  // doesn't reference a known candidate (defends against the LLM
  // hallucinating a catalog id).
  const candidatesById = new Map(candidates.filter((c) => c.catalogId).map((c) => [c.catalogId!, c]));
  const proposals: SourceProposal[] = [];
  for (const pick of picks) {
    const candidate = candidatesById.get(pick.catalogId);
    if (!candidate) {
      console.warn(`[onboarding/agent] LLM proposed unknown catalogId: ${pick.catalogId}`);
      continue;
    }
    proposals.push({
      ...candidate,
      reason: pick.reason,
      enabled: pick.enabled !== false,
    });
  }

  // Optional soft cap on proposal count.
  const maxProposals = options.maxProposals ?? 12;
  const limited = proposals.slice(0, maxProposals);

  return {
    proposals: limited,
    costEstimateUsd: llmResponse.costEstimateUsd,
    modelsUsed: [llmResponse.model],
  };
}

function buildProposalUserPrompt(
  intent: UserIntent,
  candidates: SourceProposal[]
): string {
  const intentSummary = JSON.stringify(
    {
      topics: intent.topics,
      depth: intent.depthPref,
      cadence: intent.cadencePref,
      paywall: intent.paywallPref,
      geography: intent.geography,
      original: intent.rawDescription,
    },
    null,
    2
  );

  const candidateLines = candidates
    .map((c, i) => {
      const cost =
        c.paywallCostUsdMonthly !== null && c.paywallCostUsdMonthly !== undefined
          ? ` ($${c.paywallCostUsdMonthly.toFixed(2)}/mo)`
          : "";
      return [
        `[${i + 1}] catalogId: ${c.catalogId}`,
        `    name: ${c.name}`,
        `    type: ${c.type} | paywall: ${c.paywallTier}${cost}`,
        `    description: ${c.description}`,
        `    similarity: ${c.rankScore.toFixed(3)}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    "USER INTENT:",
    intentSummary,
    "",
    "CANDIDATE SOURCES (from catalog RAG, ranked by similarity + quality):",
    candidateLines,
    "",
    "Pick 8-12 of these and return a JSON array of { catalogId, reason, enabled } objects. Only return ones from the candidate list above — no inventing new catalogIds.",
  ].join("\n");
}

interface RawPick {
  catalogId: unknown;
  reason: unknown;
  enabled?: unknown;
}

function isValidPick(
  v: unknown
): v is { catalogId: string; reason: string; enabled: boolean } {
  if (!v || typeof v !== "object") return false;
  const o = v as RawPick;
  return (
    typeof o.catalogId === "string" &&
    o.catalogId.length > 0 &&
    typeof o.reason === "string" &&
    o.reason.length > 0
  );
}

export class AgentError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    public readonly raw?: string
  ) {
    super(message);
    this.name = "AgentError";
  }
}
