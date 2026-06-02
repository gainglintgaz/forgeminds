/**
 * ab-brief-models-v2.ts — WIDENED A/B: multiple real inputs × multiple providers.
 *
 * v2 adds: Haiku, Grok, Gemini, OpenAI, Perplexity providers + 4 real input
 * sets built from Victor's raw_articles. v1 (ab-brief-models.ts) stays as the
 * working 2-candidate version — this is additive, not a replacement.
 *
 * SECRETS — loads .env.local via verify-db.ts pattern; keys → process.env only.
 * PROMPT — buildBriefPrompt mirrored from generate/route.ts @ 61728a1.
 * COST — each (model × input) = 1 paid call. Default matrix ≈ $0.20–0.45.
 *
 * MODEL IDS — only code/doc-VERIFIED strings are enabled. GPT + Gemini-3.5 are
 *   guarded TODOs (run hard-stops until pasted). ⚠ Perplexity is search-grounded
 *   and may VIOLATE the no-invention HARD RULE — included to show that.
 *
 * RUN: npx tsx scripts/scratch/ab-brief-models-v2.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

type Provider = "anthropic" | "xai" | "google" | "openai" | "perplexity";
interface Candidate {
  label: string;
  provider: Provider;
  model: string;
  inputPerM: number; // USD/1M — project COSTS as of 2026-05-06; reconfirm
  outputPerM: number;
  enabled: boolean;
}

// Pricing verified via WebSearch 2026-05-30 (sources in the chat log).
const CANDIDATES: Candidate[] = [
  { label: "Sonnet 4.6 (baseline)",   provider: "anthropic",  model: "claude-sonnet-4-6", inputPerM: 3.0,  outputPerM: 15.0, enabled: true },
  { label: "Opus 4.8",                provider: "anthropic",  model: "claude-opus-4-8",   inputPerM: 5.0,  outputPerM: 25.0, enabled: true },
  { label: "Haiku 4.5 (cheap floor)", provider: "anthropic",  model: "claude-haiku-4-5",  inputPerM: 0.8,  outputPerM: 4.0,  enabled: true },
  { label: "Grok 4.3",                provider: "xai",        model: "grok-4.3-latest",   inputPerM: 1.25, outputPerM: 2.5,  enabled: true },
  // NOTE: gemini-2.0-flash (the code's current GEMINI_FAST pin) returns 404
  // "no longer available to new users" — a production bug to fix in models.ts.
  // Swapped to 2.5-flash here. Pricing approx; reconfirm if adopting.
  { label: "Gemini 2.5 Flash", provider: "google", model: "gemini-2.5-flash", inputPerM: 0.30, outputPerM: 2.5, enabled: true },
  // Gemini 3.5 Flash — released 2026-05-19, $1.50/$9 per WebSearch.
  { label: "Gemini 3.5 Flash", provider: "google", model: "gemini-3.5-flash", inputPerM: 1.5, outputPerM: 9.0, enabled: true },
  // GPT-5.5 — model id gpt-5.5, $5/$30 per WebSearch. Disabled by default
  // after round-2 (4x cost, slow, gimmicky); flip on to re-compare.
  { label: "GPT-5.5", provider: "openai", model: "gpt-5.5", inputPerM: 5.0, outputPerM: 30.0, enabled: false },
  // Gemini 3.1 Pro — replaced deprecated 3.0; $2/$12 per WebSearch 2026-06-01.
  // The mid-tier Gemini candidate Victor asked to test (has more headroom than Flash).
  { label: "Gemini 3.1 Pro", provider: "google", model: "gemini-3.1-pro-preview", inputPerM: 2.0, outputPerM: 12.0, enabled: true },
  // ⚠ search-grounded; may pull OUTSIDE facts → likely violates no-invention. Judge skeptically.
  { label: "Perplexity sonar (search-grounded)", provider: "perplexity", model: "sonar", inputPerM: 1.0, outputPerM: 1.0, enabled: true },
];

// Input sets built from REAL raw_articles — ids VERIFIED present 2026-05-30.
// Victor's 11 articles are all UK-news / health / geopolitics (no finance/tech),
// so groupings reflect what actually exists, not invented clusters.
const INPUT_SETS: { label: string; ids: string[] }[] = [
  { label: "mixed-2 (original brief)", ids: [
    "562fb76d-3fe1-44fb-b3d0-453773a96289", // Thames Water
    "87e22095-92db-4105-b6c2-b026c0a9b77e", // Ukraine drone
  ]},
  { label: "health-cluster (4)", ids: [
    "b61ef1bf-bd30-4a47-9fef-a4a6815ed8d9", // WHO Ebola
    "a96295ac-e3e3-4594-adae-c49f8b2a4196", // hantavirus cruise
    "b5fcd04a-a816-4e4b-b35e-d3746f40d9ea", // hantavirus BC
    "60d7d552-1ff6-4691-8393-f4d88579729f", // bees swarm
  ]},
  { label: "uk-politics-cluster (3)", ids: [
    "562fb76d-3fe1-44fb-b3d0-453773a96289", // Thames Water
    "b9c037d4-b761-4284-829b-3d95d6eaa12f", // Labour leadership
    "a60d0bf8-34d7-47dc-ab83-c67d12f18cb6", // small boats pilot
  ]},
  { label: "max-diversity (5)", ids: [
    "b61ef1bf-bd30-4a47-9fef-a4a6815ed8d9", // WHO Ebola (health)
    "87e22095-92db-4105-b6c2-b026c0a9b77e", // Ukraine (geopolitics)
    "562fb76d-3fe1-44fb-b3d0-453773a96289", // Thames Water (UK biz)
    "664a796f-5a74-4086-a5af-752084cbc62d", // London car crash (UK local)
    "1fc9be26-a5c4-43eb-9f59-d99db6d0b6e2", // Italy car (intl)
  ]},
];

// ── ENV (mirror verify-db.ts) ──────────────────────────────────────
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
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── PROMPT (mirrored from generate/route.ts @ 61728a1; style-agnostic, Victor has no anchors) ──
interface ArticleForBrief {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  source_name: string | null;
  published_at: string | null;
}

function buildBriefPrompt(articles: ArticleForBrief[]): { system: string; user: string } {
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

// ── PROVIDERS (shapes mirrored from src/lib/ai/providers/*.ts) ──
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
  // OpenAI's newer models (GPT-5.x) require max_completion_tokens and reject a
  // custom temperature. xAI + Perplexity still use the classic chat params.
  const isOpenAI = url.includes("openai.com");
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  };
  if (isOpenAI) {
    body.max_completion_tokens = 4096;
  } else {
    body.max_tokens = 4096;
    body.temperature = 0.3;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
    case "anthropic":  return callAnthropic(c.model, system, user);
    case "xai":        return callOpenAICompatible("https://api.x.ai/v1/chat/completions", "XAI_API_KEY", c.model, system, user);
    case "openai":     return callOpenAICompatible("https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY", c.model, system, user);
    case "perplexity": return callOpenAICompatible("https://api.perplexity.ai/chat/completions", "PERPLEXITY_API_KEY", c.model, system, user);
    case "google":     return callGoogle(c.model, system, user);
  }
}

// ── MAIN ──
async function main() {
  const active = CANDIDATES.filter((c) => c.enabled);
  if (active.length === 0) { console.error("No candidates enabled."); process.exit(1); }
  const todo = active.find((c) => c.model.startsWith("TODO"));
  if (todo) { console.error(`"${todo.label}" still has a TODO model id. Fix or disable it.`); process.exit(1); }

  const allIds = [...new Set(INPUT_SETS.flatMap((s) => s.ids))];
  const { data: rows, error } = await supabase
    .from("raw_articles")
    .select("id, title, summary, url, source_name, published_at")
    .in("id", allIds);
  if (error || !rows) { console.error("Article load failed:", error?.message); process.exit(1); }
  const byId = new Map(rows.map((r) => [r.id, r as ArticleForBrief]));

  const matrix = active.length * INPUT_SETS.length;
  console.log(`\n=== A/B WIDENED: ${active.length} models × ${INPUT_SETS.length} inputs = ${matrix} calls ===\n`);

  const agg = new Map<string, { calls: number; totMs: number; totIn: number; totOut: number; totCost: number }>();

  for (const set of INPUT_SETS) {
    const articles = set.ids.map((id) => byId.get(id)).filter(Boolean) as ArticleForBrief[];
    if (articles.length === 0) { console.log(`(skip ${set.label} — no articles)\n`); continue; }
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

  console.log("\n=== AGGREGATE SCOREBOARD (all inputs) ===");
  console.log("model".padEnd(38) + "calls".padStart(6) + "avgMs".padStart(8) + "totIn".padStart(8) + "totOut".padStart(8) + "totCost".padStart(11));
  for (const c of active) {
    const a = agg.get(c.label);
    if (!a) { console.log(c.label.padEnd(38) + "ALL FAILED".padStart(41)); continue; }
    console.log(
      c.label.padEnd(38) +
      String(a.calls).padStart(6) +
      String(Math.round(a.totMs / a.calls)).padStart(8) +
      String(a.totIn).padStart(8) +
      String(a.totOut).padStart(8) +
      ("$" + a.totCost.toFixed(5)).padStart(11)
    );
  }
  console.log("\nJudge quality per input set. Watch for:");
  console.log("  • stays on provided facts (no invention)?  ← Perplexity likely fails");
  console.log("  • matches cynical-engineer VOICE?");
  console.log("  • output length suits density (Opus runs long)?\n");
}

main().catch((e) => { console.error("Harness crashed:", e); process.exit(1); });
