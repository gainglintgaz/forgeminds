/**
 * ab-smoke-test.ts — verify each provider's API key + model string BEFORE
 * spending on the full A/B. One tiny call per provider (max ~5 tokens out).
 *
 * Checks THREE things per provider:
 *   1. key present in .env.local (existence only — value never printed)
 *   2. auth works (not 401/403)
 *   3. the exact model string resolves (not 404 "model not found")
 *
 * A valid key can still fail (3) if the model id is wrong for your account —
 * that's the main thing this catches before the 32-call run.
 *
 * Cost: ~$0.001 total. Reads .env.local via verify-db.ts pattern.
 * RUN: npx tsx scripts/scratch/ab-smoke-test.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

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

const PING_SYSTEM = "You are a test. Reply with exactly: OK";
const PING_USER = "ping";
// Perplexity requires max_tokens >= 16; use 16 globally (harmless for others).
const PING_MAX_TOKENS = 16;

interface Probe {
  label: string;
  keyEnv: string;
  model: string;
  run: () => Promise<{ ok: boolean; reply: string }>;
}

async function anthropic(model: string) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: PING_MAX_TOKENS, system: PING_SYSTEM, messages: [{ role: "user", content: PING_USER }] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return { ok: true, reply: (d.content?.[0]?.text ?? "").trim() };
}

async function openaiCompat(url: string, keyEnv: string, model: string, tokenParam: "max_tokens" | "max_completion_tokens" = "max_tokens") {
  const body: Record<string, unknown> = {
    model,
    [tokenParam]: PING_MAX_TOKENS,
    messages: [{ role: "system", content: PING_SYSTEM }, { role: "user", content: PING_USER }],
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env[keyEnv] ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return { ok: true, reply: (d.choices?.[0]?.message?.content ?? "").trim() };
}

async function google(model: string) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY ?? ""}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: PING_SYSTEM }] }, contents: [{ parts: [{ text: PING_USER }] }], generationConfig: { maxOutputTokens: PING_MAX_TOKENS } }),
      signal: AbortSignal.timeout(30_000) }
  );
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return { ok: true, reply: (d.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim() };
}

const PROBES: Probe[] = [
  { label: "Anthropic Sonnet 4.6",   keyEnv: "ANTHROPIC_API_KEY",  model: "claude-sonnet-4-6", run: () => anthropic("claude-sonnet-4-6") },
  { label: "Anthropic Opus 4.8",     keyEnv: "ANTHROPIC_API_KEY",  model: "claude-opus-4-8",   run: () => anthropic("claude-opus-4-8") },
  { label: "Anthropic Haiku 4.5",    keyEnv: "ANTHROPIC_API_KEY",  model: "claude-haiku-4-5",  run: () => anthropic("claude-haiku-4-5") },
  { label: "xAI Grok 4.3",           keyEnv: "XAI_API_KEY",        model: "grok-4.3-latest",   run: () => openaiCompat("https://api.x.ai/v1/chat/completions", "XAI_API_KEY", "grok-4.3-latest") },
  { label: "OpenAI GPT-5.5",         keyEnv: "OPENAI_API_KEY",     model: "gpt-5.5",           run: () => openaiCompat("https://api.openai.com/v1/chat/completions", "OPENAI_API_KEY", "gpt-5.5", "max_completion_tokens") },
  { label: "Perplexity sonar",       keyEnv: "PERPLEXITY_API_KEY", model: "sonar",             run: () => openaiCompat("https://api.perplexity.ai/chat/completions", "PERPLEXITY_API_KEY", "sonar") },
  { label: "Google Gemini 2.5 Flash",keyEnv: "GEMINI_API_KEY",     model: "gemini-2.5-flash",  run: () => google("gemini-2.5-flash") },
  { label: "Google Gemini 3.5 Flash",keyEnv: "GEMINI_API_KEY",     model: "gemini-3.5-flash",  run: () => google("gemini-3.5-flash") },
  { label: "Google Gemini 3.1 Pro",  keyEnv: "GEMINI_API_KEY",     model: "gemini-3.1-pro-preview", run: () => google("gemini-3.1-pro-preview") },
];

async function main() {
  console.log("\n=== PROVIDER SMOKE TEST (key + auth + model-string) ===\n");
  const results: { label: string; status: string; detail: string }[] = [];
  for (const p of PROBES) {
    const keyPresent = !!process.env[p.keyEnv];
    if (!keyPresent) {
      results.push({ label: p.label, status: "NO KEY", detail: `${p.keyEnv} not in .env.local` });
      console.log(`✗ ${p.label.padEnd(28)} NO KEY (${p.keyEnv})`);
      continue;
    }
    process.stdout.write(`… ${p.label.padEnd(28)} `);
    try {
      const r = await p.run();
      results.push({ label: p.label, status: "OK", detail: `reply: ${JSON.stringify(r.reply).slice(0, 40)}` });
      console.log(`OK   reply=${JSON.stringify(r.reply).slice(0, 30)}`);
    } catch (e) {
      const msg = (e as Error).message;
      const kind = msg.startsWith("401") || msg.startsWith("403") ? "AUTH FAIL"
        : msg.startsWith("404") ? "MODEL 404"
        : "ERROR";
      results.push({ label: p.label, status: kind, detail: msg });
      console.log(`${kind}  ${msg.slice(0, 80)}`);
    }
  }

  console.log("\n=== SUMMARY ===");
  for (const r of results) console.log(`${r.status.padEnd(10)} ${r.label}`);
  const okCount = results.filter((r) => r.status === "OK").length;
  console.log(`\n${okCount}/${PROBES.length} providers ready.`);
  const bad = results.filter((r) => r.status !== "OK");
  if (bad.length) {
    console.log("\nFix or disable these in ab-brief-models-v2.ts before the full run:");
    for (const b of bad) console.log(`  • ${b.label} — ${b.status}: ${b.detail}`);
  } else {
    console.log("All providers green. Safe to run ab-brief-models-v2.ts.");
  }
  console.log("");
}

main().catch((e) => { console.error("Smoke test crashed:", e); process.exit(1); });
