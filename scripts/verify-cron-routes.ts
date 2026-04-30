/**
 * verify-cron-routes.ts — confirm every /api/cron/* route responds 200
 *
 * Phase 1 gate: hits each cron endpoint with the CRON_SECRET bearer token
 * and asserts a 2xx JSON response. This catches:
 *   - missing route files (404)
 *   - broken route handlers (500)
 *   - misconfigured CRON_SECRET (401)
 *   - middleware misrouting cron paths through auth (302/401)
 *
 * Pre-condition: `npm run dev` is running on localhost:3000. The verifier
 * skips routes that are not yet implemented (Phase 1 work in progress) by
 * tagging them as PENDING — but exits non-zero if a route returns a non-2xx
 * AND non-404 (i.e. broken, not just not-yet-built).
 *
 * Usage:
 *   npx tsx scripts/verify-cron-routes.ts
 *   BASE_URL=https://forgeminds.app npx tsx scripts/verify-cron-routes.ts  # prod
 */

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

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error("❌ CRON_SECRET missing from .env.local");
  process.exit(1);
}

// Phase 1 cron route inventory. PENDING means we expect 404 until the route
// ships — those don't fail the gate, they just print a warning.
const ROUTES: Array<{ path: string; phase: 0 | 1; required: boolean }> = [
  { path: "/api/cron/ingest", phase: 0, required: true },
  { path: "/api/cron/score", phase: 0, required: true },
  { path: "/api/cron/curate", phase: 0, required: true },
  { path: "/api/cron/enrich", phase: 1, required: true },
  { path: "/api/cron/generate", phase: 1, required: true },
  { path: "/api/cron/deliver", phase: 1, required: true },
];

async function checkRoute(path: string): Promise<{ status: number; ok: boolean; body: string }> {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    const body = await res.text();
    return { status: res.status, ok: res.ok, body: body.slice(0, 200) };
  } catch (err) {
    return { status: 0, ok: false, body: (err as Error).message };
  }
}

async function main() {
  console.log(`🔍 verify-cron-routes: probing ${ROUTES.length} routes against ${BASE_URL}`);
  console.log("");

  const failures: string[] = [];
  const pending: string[] = [];

  for (const route of ROUTES) {
    const { status, ok, body } = await checkRoute(route.path);
    if (ok) {
      console.log(`   ✓ ${route.path.padEnd(28)} ${status}`);
      continue;
    }
    if (status === 404 && route.required) {
      // Phase-1 routes that don't exist yet → soft pending
      pending.push(`${route.path} (404 — phase ${route.phase} pending)`);
      console.log(`   … ${route.path.padEnd(28)} 404 (PENDING — phase ${route.phase} not yet built)`);
      continue;
    }
    failures.push(`${route.path} → ${status}: ${body}`);
    console.log(`   ✗ ${route.path.padEnd(28)} ${status} ${body}`);
  }

  console.log("");
  if (failures.length > 0) {
    console.log(`❌ verify-cron-routes: ${failures.length} failure(s):`);
    for (const f of failures) console.log(`   ${f}`);
    process.exit(1);
  }

  if (pending.length > 0) {
    console.log(`⚠ verify-cron-routes: ${pending.length} route(s) pending (404 — phase 1 in progress):`);
    for (const p of pending) console.log(`   ${p}`);
    console.log("");
    console.log("   These do not fail the gate; they're tracked as 'in progress'.");
    console.log("   Phase 1 is NOT done until every route returns 200.");
    // Soft-fail at the orchestrator level — exit 1 so verify:phase-1 won't
    // emit the AUDIT GATE block until the routes ship.
    process.exit(1);
  }

  console.log(`✅ verify-cron-routes: ${ROUTES.length}/${ROUTES.length} routes responding 200`);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
