/**
 * verify-db.ts — quick DB state verification for ForgeMinds
 *
 * Confirms each migration applied by querying its signature tables.
 * Uses service role key so RLS doesn't block.
 *
 * Usage:
 *   npx tsx scripts/verify-db.ts
 *
 * Reads .env.local from project root.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env.local manually ────────────────────────────────────────
function loadEnvLocal() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (key && value && !process.env[key]) process.env[key] = value;
    }
  } catch (err) {
    console.error("⚠ Could not read .env.local:", (err as Error).message);
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Migration signature tables ──────────────────────────────────────
const MIGRATIONS = [
  {
    n: 1,
    name: "initial_schema",
    expected_count: 31,
    signature_tables: [
      "profiles",
      "sources",
      "entities",
      "raw_articles",
      "scored_articles",
      "ticker_data",
      "user_preferences",
      "voice_profiles",
    ],
  },
  {
    n: 2,
    name: "action_templates",
    expected_count: 34,
    signature_tables: [
      "action_templates",
      "action_template_runs",
      "data_source_cache",
    ],
  },
  {
    n: 3,
    name: "geo_paywall_moat",
    expected_count: 42,
    signature_tables: [
      "geographies",
      "user_geographies",
      "paywall_sources",
      "external_subscriptions",
      "user_context_matrix",
      "outcome_aggregates",
    ],
  },
  {
    n: 4,
    name: "chains_noise_kickoff_capabilities",
    expected_count: 51,
    signature_tables: [
      "event_chain_patterns",
      "event_chains",
      "user_filter_preferences",
      "engagement_decay",
      "notification_preferences",
      "tool_capabilities",
      "tool_lessons_learned",
      "kickoff_templates",
      "build_kickoff_packages",
    ],
  },
  {
    n: 5,
    name: "shared_brains_and_community_brain",
    expected_count: 57,
    signature_tables: [
      "shared_brains",
      "brain_memberships",
      "community_data_settings",
      "community_embeddings",
      "community_trends",
      "community_brain_queries",
    ],
  },
  {
    n: 6,
    name: "behavioral_signals",
    expected_count: 60,
    signature_tables: [
      "behavioral_events",
      "session_summaries",
      "community_behavioral_aggregates",
    ],
  },
  {
    n: 7,
    name: "brain_stack",
    expected_count: 69,
    signature_tables: [
      "prompt_versions",
      "prompt_outcomes",
      "insight_distillations",
      "model_routing_rules",
      "profile_clusters",
      "user_profile_cluster",
      "topic_clusters",
      "improvement_proposals",
      "brain_stack_layers",
    ],
  },
  // Migration 8 (restore_role_grants, 2026-04-29) creates no tables; it
  // re-grants USAGE/SELECT/etc on public schema after a `drop schema cascade`
  // wipes default Supabase grants. Verified via the JS SDK being able to
  // query at all — if any earlier migration's signature tables work, grants
  // are in place. Skip from MIGRATIONS list since there are no signature tables.
  //
  // Migration 9 (pg_cron_schedules, 2026-05-01) creates no tables; schedules
  // cron jobs in cron.job. Verified by `select * from cron.job where jobname
  // like 'forgeminds_%'`. Phase 1 work — verify:cron-routes confirms reachability.
];

async function tableExists(name: string): Promise<boolean> {
  // Try a HEAD-only count query — fastest way to test existence
  const { error } = await supabase
    .from(name)
    .select("*", { count: "exact", head: true });
  if (error) {
    // PGRST205 = relation does not exist (table missing)
    if (error.code === "PGRST205" || error.code === "42P01") return false;
    // Other errors (like permission) bubble up
    throw error;
  }
  return true;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log("🔍 ForgeMinds DB Verification");
  console.log(`   ${SUPABASE_URL}`);
  console.log("");

  let appliedCount = 0;

  for (const mig of MIGRATIONS) {
    let allFound = true;
    const missing: string[] = [];

    for (const t of mig.signature_tables) {
      try {
        const exists = await tableExists(t);
        if (!exists) {
          allFound = false;
          missing.push(t);
        }
      } catch (err) {
        const msg = (err as Error).message ?? "unknown";
        if (msg.toLowerCase().includes("does not exist")) {
          allFound = false;
          missing.push(t);
        } else {
          console.error(`   ⚠ Error checking ${t}: ${msg}`);
          allFound = false;
        }
      }
    }

    if (allFound) {
      console.log(
        `✓ Migration ${mig.n} (${mig.name}) — all ${mig.signature_tables.length} signature tables exist`
      );
      appliedCount++;
    } else {
      console.log(
        `✗ Migration ${mig.n} (${mig.name}) — missing: ${missing.join(", ")}`
      );
    }
  }

  console.log("");
  console.log(
    `📊 ${appliedCount}/${MIGRATIONS.length} migrations confirmed applied`
  );

  if (appliedCount === MIGRATIONS.length) {
    console.log("✅ Schema fully migrated (all 7 migrations)");
  } else {
    const next = MIGRATIONS[appliedCount];
    console.log(
      `▶ Next migration to apply: #${next.n} (${next.name}) — ${next.expected_count} tables expected`
    );
  }
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
