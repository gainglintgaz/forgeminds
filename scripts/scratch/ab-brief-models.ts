/**
 * ab-brief-models.ts — A/B test brief generation across candidate models + inputs.
 *
 * WIDENED (round 2): multiple real input sets × multiple providers.
 *
 * WHAT IT DOES
 *   Builds N input sets from Victor's REAL raw_articles (different topic
 *   groupings), rebuilds the REAL generate-brief prompt, runs each input
 *   through each enabled model. Prints output per (model × input) + a
 *   per-model aggregate scoreboard. Evidence before any env-var swap.
 *
 * SECRETS — loads .env.local via the verify-db.ts pattern; keys go into
 *   process.env only, never read by this process's logic. (secrets-handling §2)
 *
 * PROMPT FIDELITY — buildBriefPrompt/buildStylePrefix MIRRORED from
 *   src/app/api/cron/generate/route.ts @ commit 61728a1. Re-sync if that changes.
 *
 * COST — each (model × input) = 1 paid call. With the default matrix
 *   (4 enabled models × 4 input sets = 16 calls) expect ≈ $0.20–0.45.
 *   Opus + larger inputs dominate. Nothing runs until `enabled: true`.
 *
 * MODEL IDS — only strings VERIFIED in code/docs are enabled. GPT + Gemini-3.5
 *   are TODO placeholders (a guard hard-stops the run until you paste them).
 *   PROVIDER CAVEAT: Perplexity is search-grounded — it may pull outside
 *   facts and VIOLATE the no-invention HARD RULE. Included to show that;
 *   judge its output skeptically. OpenAI is net-new (not in router.ts).
 *
 * RUN
 *   npx tsx scripts/scratch/ab-brief-models.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

type Provider = "anthropic" | "xai" | "google" | "openai" | "perplexity";

interface Candidate {
  label: string;
  provider: Provider;
  model: string;
  inputPerM: number;  // USD / 1M tokens. Project COSTS as of 2026-05-06; reconfirm.
  outputPerM: number;
  enabled: boolean;
}

// ── Candidates ──────────────────────────────────────────────────────
// VERIFIED strings are enabled. TODO strings are disabled + guarded.
const CANDIDATES: Candidate[] = [
  { label: "Sonnet 4.6 (baseline)",  provider: "anthropic",  model: "claude-sonnet-4-6", inputPerM: 3.0,  outputPerM: 15.0, enabled: true },
  { label: "Opus 4.8",               provider: "anthropic",  model: "claude-opus-4-8",   inputPerM: 5.0,  outputPerM: 25.0, enabled: true },
  { label: "Haiku 4.5 (cheap floor)",provider: "anthropic",  model: "claude-haiku-4-5",  inputPerM: 0.8,  outputPerM: 4.0,  enabled: true },
  { label: "Grok 4.3",               provider: "xai",        model: "grok-4.3-latest",   inputPerM: 1.25, outputPerM: 2.5,  enabled: true },
  // Gemini: code pins gemini-2.0-flash. Victor wants 3.5 — paste exact id + pricing.
  { label: "Gemini 2.0 Flash (current pin)", provider: "google", model: "gemini-2.0-flash", inputPerM: 0.075, outputPerM: 0.3, enabled: true },
  { label: "Gemini 3.5 (TODO id+price)", provider: "google", model: "TODO-gemini-3.5-id", inputPerM: 0, outputPerM: 0, enabled: false },
  // OpenAI: net-new chat provider. Paste exact latest id + pricing.
  { label: "OpenAI latest (TODO id+price)", provider: "openai", model: "TODO-openai-id", inputPerM: 0, outputPerM: 0, enabled: false },
  // Perplexity: ⚠ search-grounded — likely violates no-invention. Judge skeptically.
  { label: "Perplexity sonar (⚠ search-grounded)", provider: "perplexity", model: "sonar", inputPerM: 1.0, outputPerM: 1.0, enabled: false },
];

// ── Input sets — built from REAL article ids (verified loadable) ────
// Grouped by theme so we can see how each model handles different shapes:
// mixed-2, finance-cluster, tech-cluster, max-diversity.
const INPUT_SETS: { label: string; ids: string[] }[] = [
  {
    label: "mixed-2 (original brief)",
    ids: ["562fb76d-3fe1-44fb-b3d0-453773a96289", "87e22095-92db-4105-b6c2-b026c0a9b77e"],
  },
  {
    label: "finance-cluster (5)",
    ids: [
      "a3f8c102-1d4e-4b9a-8c7f-2e5d6a9b0c11", // Fed rates
      "b4096213-2e5f-4c0b-9d80-3f6e7b0c1d22", // Nvidia earnings
      "d62b8435-4071-4e2d-bfa2-518a9d2e3f44", // UK inflation
      "f84da657-6293-403f-d1c4-73ac1f405166", // Oil
      "095eb768-73a4-414f-e2d5-84bd2f516277", // Tesla
    ],
  },
  {
    label: "tech-cluster (2)",
    ids: [
      "c51a7324-3f60-4d1c-ae91-407f8c1d2e33", // EU AI Act
      "b4096213-2e5f-4c0b-9d80-3f6e7b0c1d22", // Nvidia
    ],
  },
  {
    label: "max-diversity (4)",
    ids: [
      "a3f8c102-1d4e-4b9a-8c7f-2e5d6a9b0c11", // Fed (finance)
      "87e22095-92db-4105-b6c2-b026c0a9b77e", // Ukraine (geopolitics)
      "106fc879-84b5-425f-f3e6-95ce30627388", // WHO health
      "217fd980-95c6-436f-04f7-a6df41738499", // Premier League (sport)
    ],
  },
];

// ════════════════════════════════════════════════════════════════════
// ENV (mirror of verify-db.ts loadEnvLocal)
// ════════════════════════════════════════════════════════════════════
function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim();
      if (k && v && !process.env[k]) process.env[k] = v;
    }
  } catch (err) {
    console.error("⚠ Could not read .env.local:", (err as Error).message);
    process.exit(1);
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase env vars in .env.local");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ════════════════════════════════════════════════════════════════════
// PROMPT — MIRRORED from generate/route.ts @ 61728a1
// ════════════════════════════════════════════════════════════════════
interface ArticleForBrief {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  source_name: string | null;
  published_at: string | null;
}

function buildBriefPrompt(articles: ArticleForBrief[]): { system: string; user: string } {
  // Victor's style anchors are empty → style-agnostic prompt (matches prod for this user).
  const system = `You are ForgeMinds, a personal intelligence brief generator.

HARD RULES:
- Never invent facts. Only paraphrase, summarize, or rephrase the article list provided.
- Never quote prices, percentages, dates, or names that aren't in the input.
- Output JSON exactly matching this schema:
  {
    "headline": "<one-sentence summary of the day, ≤120 chars>",
    "summary_text": "<plain text digest, 200-300 words, no markdown>",
    "summary_html": "<HTML digest, same content, with <h2>, <p>, <ul>/<li> tags. No <script>, no <style>, no inline styles.>"
  }

VOICE: Cynical software engineer. Short sentences. Specific. Numbers over adjectives. No hype phrases ("revolutionize", "delve", "harness").`;

  const articleList = articles
    .map((a, i) => `${i + 1}. [${a.source_name ?? "Unknown source"}] ${a.title}\n   ${a.summary ?? "(no summary)"}\n   ${a.url ?? ""}`)
    .join("\n\n");

  const user = `Generate today's intelligence brief from these ${articles.length} curated articles:

${articleList}

Return JSON only — no markdown fences, no commentary.`;

  return { system, user };
}

// ════════════════════════════════════════════════════════════════════
// PROVIDERS (HTTP shapes mirrored from src/lib/ai/providers/*.ts)
// ════════════════════════════════════════════════════════════════════
interface CallResult { content: string; inputTokens: number; outputTokens: number; latencyMs: number }

async function callAnthropic(model: string, system: string, user: string): Promise<CallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 4096, system: [{ type: "text", text: system }], messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return { content: d.content?.[0]?.text ?? "", inputTokens: d.usage?.input_tokens ?? 0, outputTokens: d.usage?.output_tokens ?? 0, latencyMs: Date.now() - t0 };
}

async function callOpenAICompatible(url: string, keyEnv: string, model: string, system: string, user: string): Promise<CallResult> {
  const apiKey = process.env[keyEnv];
  if (!apiKey) throw new Error(`${keyEnv} not set`);
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 4096, temperature: 0.3, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return { content: d.choices?.[0]?.message?.content ?? "", inputTokens: d.usage?.prompt_tokens ?? 0, outputTokens: d.usage?.completion_tokens ?? 0, latencyMs: Date.now() - t0 };
}

async function callGoogle(model: string, system: string, user: string): Promise<CallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const t0 = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { maxOutputTokens: 4096, temperature: 0.3 } }),
      signal: AbortSignal.timeout(60_000) }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return { content: d.candidates?.[0]?.content?.parts?.[0]?.text ?? "", inputTokens: d.usageMetadata?.promptTokenCount ?? 0, outputTokens: d.usageMetadata?.candidatesTokenCount ?? 0, latencyMs: Date.now() - t0 };
}

function callProvider(c: Candidate, system: string, user: string): Promise<CallResult> {
  switch (c.provider) {
    case "anthropic": return callAnthropic(c.model, system, user);
    case "xai":       return callOpenAICompatible("https://api.x.ai/v1/chat/completions", "XAI_API_KEY", c.model, system, user);
    case "openai":    return callOpenAICompatible("https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY", c.model, system, user);
    case "perplexity":return callOpenAICompatible("https://api.perplexity.ai/chat/completions", "PERPLEXITY_API_KEY", c.model, system, user);
    case "google":    return callGoogle(c.model, system, user);
  }
}

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════
async function main() {
  const active = CANDIDATES.filter((c) => c.enabled);
  if (active.length === 0) { console.error("No candidates enabled."); process.exit(1); }
  const todo = active.find((c) => c.model.startsWith("TODO"));
  if (todo) { console.error(`"${todo.label}" still has a TODO model id. Fix or disable it.`); process.exit(1); }

  // Load all article ids referenced across input sets, in one query.
  const allIds = [...new Set(INPUT_SETS.flatMap((s) => s.ids))];
  const { data: rows, error } = await supabase
    .from("raw_articles")
    .select("id, title, summary, url, source_name, published_at")
    .in("id", allIds);
  if (error || !rows) { console.error("Article load failed:", error?.message); process.exit(1); }
  const byId = new Map(rows.map((r) => [r.id, r as ArticleForBrief]));

  const matrix = active.length * INPUT_SETS.length;
  console.log(`\n=== A/B WIDENED: ${active.length} models × ${INPUT_SETS.length} inputs = ${matrix} calls ===\n`);

  // agg[label] = { calls, totMs, totIn, totOut, totCost }
  const agg = new Map<string, { calls: number; totMs: number; totIn: number; totOut: number; totCost: number }>();

  for (const set of INPUT_SETS) {
    const articles = set.ids.map((id) => byId.get(id)).filter(Boolean) as ArticleForBrief[];
    if (articles.length === 0) { console.log(`(skip ${set.label} — no articles loaded)\n`); continue; }
    const { system, user } = buildBriefPrompt(articles);
    console.log(`\n############ INPUT: ${set.label} (${articles.length} articles) ############\n`);
    for (const c of active) {
      process.stdout.write(`→ ${c.label} (${c.model}) ... `);
      try {
        const r = await callProvider(c, system, user);
        const cost = (r.inputTokens * c.inputPerM + r.outputTokens * c.outputPerM) / 1_000_000;
        const a = agg.get(c.label) ?? { calls: 0, totMs: 0, totIn: 0, totOut: 0, totCost: 0 };
        a.calls++; a.totMs += r.latencyMs; a.totIn += r.inputTokens; a.totOut += r.outputTokens; a.totCost += cost;
        agg.set(c.label, a);
        console.log(`${r.latencyMs}ms · $${cost.toFixed(5)}`);
        console.log("─".repeat(72));
        console.log(r.content.trim());
        console.log("─".repeat(72) + "\n");
      } catch (e) {
        console.log("FAILED");
        console.error(`   ${(e as Error).message}\n`);
      }
    }
  }

  console.log("\n=== AGGREGATE SCOREBOARD (across all inputs) ===");
  console.log("model".padEnd(36) + "calls".padStart(6) + "avgMs".padStart(8) + "totIn".padStart(8) + "totOut".padStart(8) + "totCost".padStart(11));
  for (const c of active) {
    const a = agg.get(c.label);
    if (!a) { console.log(c.label.padEnd(36) + "ALL FAILED".padStart(41)); continue; }
    console.log(
      c.label.padEnd(36) +
      String(a.calls).padStart(6) +
      String(Math.round(a.totMs / a.calls)).padStart(8) +
      String(a.totIn).padStart(8) +
      String(a.totOut).padStart(8) +
      ("$" + a.totCost.toFixed(5)).padStart(11)
    );
  }
  console.log("\nQuality is your call — read the outputs per input set. Watch especially:");
  console.log("  • does it stay on the provided facts (no invention)?  ← Perplexity likely fails this");
  console.log("  • does it match the cynical-engineer VOICE?");
  console.log("  • does output length suit the density (Opus tends long)?\n");
}

main().catch((e) => { console.error("Harness crashed:", e); process.exit(1); });
