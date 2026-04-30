/**
 * verify-pipeline-flow.ts — confirm end-to-end pipeline data exists
 *
 * Phase 1 gate: queries the DB and asserts at least one row exists in each
 * of `raw_articles`, `scored_articles`, `briefs` from the last 24 hours.
 * This proves the cron pipeline ran end-to-end with real data, not just
 * that the routes exist.
 *
 * What this catches that other gates miss:
 *   - Routes return 200 but write nothing (broken DB write paths)
 *   - pg_cron schedules not firing
 *   - Empty source list (no RSS feeds seeded)
 *   - Auth misconfigured between cron and API (401 silently swallowed)
 *
 * Skip this gate (`--skip-pipeline-flow`) only during early Phase 1 dev
 * before the first real cron run. Once Phase 1 ships, it's mandatory.
 *
 * Usage:
 *   npx tsx scripts/verify-pipeline-flow.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

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
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function countRecent(table: string, hoursBack: number): Promise<number> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);
  if (error) {
    console.error(`   ✗ ${table}: query failed (${error.message})`);
    return -1;
  }
  return count ?? 0;
}

async function main() {
  console.log("🔍 verify-pipeline-flow: checking for end-to-end pipeline data (last 24h)…");
  console.log("");

  const checks = [
    { table: "raw_articles", hoursBack: 24, minimum: 1, label: "ingest wrote articles" },
    { table: "scored_articles", hoursBack: 24, minimum: 1, label: "score wrote rows" },
    { table: "briefs", hoursBack: 24, minimum: 1, label: "curate wrote a brief" },
  ];

  const failures: string[] = [];
  for (const c of checks) {
    const n = await countRecent(c.table, c.hoursBack);
    if (n < 0) {
      failures.push(`${c.table}: query error`);
      continue;
    }
    if (n < c.minimum) {
      console.log(`   ✗ ${c.table.padEnd(20)} ${n} rows in last ${c.hoursBack}h (need ≥${c.minimum})`);
      failures.push(`${c.table}: ${n} rows < ${c.minimum} required`);
      continue;
    }
    console.log(`   ✓ ${c.table.padEnd(20)} ${n} rows in last ${c.hoursBack}h (${c.label})`);
  }

  console.log("");
  if (failures.length > 0) {
    console.log(`❌ verify-pipeline-flow: ${failures.length} stage(s) empty:`);
    for (const f of failures) console.log(`   ${f}`);
    console.log("");
    console.log("   Trigger the pipeline manually to populate:");
    console.log(`     curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ingest`);
    console.log(`     curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/score`);
    console.log(`     curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/curate`);
    console.log("");
    console.log("   Or wait for pg_cron to fire (configured in supabase/migrations/20260501000000_pg_cron_schedules.sql).");
    process.exit(1);
  }

  console.log("✅ verify-pipeline-flow: all 3 pipeline stages have data from last 24h");
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
