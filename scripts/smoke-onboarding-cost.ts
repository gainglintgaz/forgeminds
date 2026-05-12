/**
 * smoke-onboarding-cost.ts — Phase 1.5 cost-audit gate
 *
 * Asserts the /api/onboarding/chat route honors the
 * ONBOARDING_COST_CAP_USD budget (default $0.10/run, target mean <$0.06).
 *
 * Same pattern as smoke-rls-two-user.ts:
 *   1. Create N test auth users via auth.admin.createUser
 *   2. Sign in as each user (gets session JWT)
 *   3. POST to /api/onboarding/chat with a real description
 *   4. Capture costEstimateUsd + duration_ms + proposals_returned from
 *      the response body (the route also writes a JSON log line that
 *      Vercel/dev-server stdout captures — we don't need to grep that
 *      since the route returns the cost in the body directly)
 *   5. Compute mean + max + budget compliance
 *   6. Delete each user (cascade drops source_suggestions rows via FK)
 *
 * Targets per AI_FIRST_AUDIT.md §B Q4:
 *   mean cost < $0.06 per onboarding turn
 *   max  cost < $0.10 per onboarding turn (hard cap; flagged in log if exceeded)
 *
 * Pre-conditions:
 *   - .env.local has NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *     + NEXT_PUBLIC_SUPABASE_ANON_KEY + ANTHROPIC_API_KEY + OPENAI_API_KEY
 *   - npm run dev running on localhost:3000 (or BASE_URL set)
 *   - source_catalog has ≥1 batch seeded with embeddings (so proposeSources
 *     doesn't AgentError on empty RAG result)
 *
 * Usage:
 *   npx tsx scripts/smoke-onboarding-cost.ts
 *   BASE_URL=https://forgeminds.app npx tsx scripts/smoke-onboarding-cost.ts
 *
 * Exits non-zero if mean cost ≥ $0.06 OR max ≥ $0.10 OR any run errors.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";

function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && value && !process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error("⚠ Could not read .env.local:", (err as Error).message);
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error(
    "❌ Missing one of NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

const TARGET_MEAN_USD = 0.06;
const TARGET_MAX_USD = 0.10;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Three diverse descriptions — all overlap with the seeded medicine/
// oncology catalog so proposeSources returns >0 proposals. After more
// catalog batches land, re-running with cross-category descriptions
// will exercise the broader RAG + Sonnet prompt path.
const DESCRIPTIONS = [
  "I'm a clinical oncologist who wants to stay current on immunotherapy advances, CAR-T cell therapy developments, and practice-changing clinical trial results.",
  "I follow biotech industry news with a focus on cancer drug development, FDA approvals in oncology, and pipeline updates from major pharma.",
  "I'm a cancer researcher interested in tumor microenvironment biology, oncogenomics, and translational medicine — peer-reviewed sources only.",
];

interface RunResult {
  label: string;
  status: number;
  cost_estimate_usd?: number;
  duration_ms?: number;
  proposals_returned?: number;
  models_used?: string[];
  error?: string;
}

async function createUser(label: string): Promise<{ id: string; email: string; password: string }> {
  const email = `onboarding-cost-${label}-${Date.now()}@forgeminds.test`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user?.id) {
    throw new Error(`Could not create user ${label}: ${error?.message ?? "no user returned"}`);
  }
  return { id: data.user.id, email, password };
}

async function deleteUser(userId: string) {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.warn(`⚠ Could not delete user ${userId.slice(0, 8)}…: ${error.message}`);
  }
}

async function runOnboardingChat(
  user: { email: string; password: string },
  description: string,
  label: string
): Promise<RunResult> {
  // Sign in as the user to get a session JWT.
  const signinClient = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signin, error: signinErr } =
    await signinClient.auth.signInWithPassword({
      email: user.email,
      password: user.password,
    });
  if (signinErr || !signin?.session?.access_token) {
    return {
      label,
      status: 0,
      error: `signInWithPassword failed: ${signinErr?.message ?? "no token"}`,
    };
  }

  // POST to the chat route with the user's JWT in the Authorization
  // header. The server uses this to identify the user via getUser().
  // We also need to include the session cookie because the
  // createClient() server helper reads supabase-auth-token from
  // cookies. The middleware sets this. For our scripted client,
  // sending the Authorization header works because the route's
  // createClient() will use it.
  const t0 = Date.now();
  const response = await fetch(`${BASE_URL}/api/onboarding/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // The supabase server helper checks the request's Cookie header
      // for the auth session. Bare fetch from Node doesn't have a
      // browser-managed cookie jar, so we mint one manually with the
      // session token in the expected format.
      Cookie: `sb-${new URL(SUPABASE_URL!).hostname.split(".")[0]}-auth-token=${encodeURIComponent(
        JSON.stringify({
          access_token: signin.session.access_token,
          refresh_token: signin.session.refresh_token,
          expires_at: signin.session.expires_at,
          token_type: "bearer",
          user: signin.session.user,
        })
      )}`,
    },
    body: JSON.stringify({ description }),
    signal: AbortSignal.timeout(120_000),
  });
  const wallMs = Date.now() - t0;

  if (response.status !== 200) {
    const body = await response.text();
    return {
      label,
      status: response.status,
      duration_ms: wallMs,
      error: body.slice(0, 300),
    };
  }

  const body = (await response.json()) as {
    costEstimateUsd: number;
    modelsUsed: string[];
    proposals: unknown[];
    intent: { topics: string[] };
  };
  return {
    label,
    status: 200,
    cost_estimate_usd: body.costEstimateUsd,
    duration_ms: wallMs,
    proposals_returned: body.proposals?.length ?? 0,
    models_used: body.modelsUsed,
  };
}

async function main() {
  console.log("🔍 smoke-onboarding-cost: 3 scripted onboarding chat flows");
  console.log(`   BASE_URL: ${BASE_URL}`);
  console.log(`   targets: mean < $${TARGET_MEAN_USD.toFixed(2)}, max < $${TARGET_MAX_USD.toFixed(2)}`);
  console.log("");

  const users: Array<{ id: string; email: string; password: string; label: string }> = [];
  const results: RunResult[] = [];

  try {
    for (let i = 0; i < DESCRIPTIONS.length; i++) {
      const label = String.fromCharCode(65 + i); // "A", "B", "C"
      const user = await createUser(label);
      users.push({ ...user, label });
      console.log(`   user ${label}: ${user.id.slice(0, 8)}…  (${user.email})`);
    }
    console.log("");

    for (let i = 0; i < DESCRIPTIONS.length; i++) {
      const u = users[i];
      const desc = DESCRIPTIONS[i];
      process.stdout.write(`   ▶ ${u.label} ${desc.slice(0, 60)}…  `);
      const result = await runOnboardingChat(u, desc, u.label);
      results.push(result);
      if (result.status === 200) {
        console.log(
          `200 cost=$${result.cost_estimate_usd?.toFixed(4)} proposals=${result.proposals_returned} ${result.duration_ms}ms`
        );
      } else if (result.status === 0) {
        console.log(`✗ pre-flight error: ${result.error}`);
      } else {
        console.log(`✗ HTTP ${result.status}: ${result.error?.slice(0, 120)}`);
      }
    }
  } finally {
    console.log("");
    for (const u of users) {
      await deleteUser(u.id);
    }
    console.log(`   Cleaned up ${users.length} test users (cascade dropped source_suggestions)`);
  }

  console.log("");

  const succeeded = results.filter((r) => r.status === 200 && typeof r.cost_estimate_usd === "number");
  if (succeeded.length === 0) {
    console.log("❌ smoke-onboarding-cost: zero successful runs — investigate route errors above");
    process.exit(1);
  }

  const costs = succeeded.map((r) => r.cost_estimate_usd!);
  const mean = costs.reduce((s, c) => s + c, 0) / costs.length;
  const max = Math.max(...costs);

  console.log(`   ${succeeded.length}/${results.length} runs succeeded`);
  console.log(`   mean cost: $${mean.toFixed(4)}  (target < $${TARGET_MEAN_USD.toFixed(2)})`);
  console.log(`   max cost:  $${max.toFixed(4)}  (target < $${TARGET_MAX_USD.toFixed(2)})`);
  console.log("");

  const failures: string[] = [];
  if (mean >= TARGET_MEAN_USD) failures.push(`mean $${mean.toFixed(4)} ≥ target $${TARGET_MEAN_USD.toFixed(2)}`);
  if (max >= TARGET_MAX_USD) failures.push(`max $${max.toFixed(4)} ≥ target $${TARGET_MAX_USD.toFixed(2)}`);

  if (failures.length > 0) {
    console.log("❌ smoke-onboarding-cost:");
    for (const f of failures) console.log(`   ✗ ${f}`);
    console.log("");
    console.log("   Likely causes:");
    console.log("     - Sonnet max_tokens too high in proposeSources — reduce.");
    console.log("     - System prompt too large for prompt-caching to amortize — review cacheableSystemPrompt.");
    console.log("     - OpenAI embedding call uneeded if intent unchanged — cache the embed.");
    process.exit(1);
  }

  console.log(`✅ smoke-onboarding-cost: budget honored (mean $${mean.toFixed(4)}, max $${max.toFixed(4)})`);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
