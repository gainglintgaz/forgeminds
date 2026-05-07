/**
 * smoke-rls-two-user.ts — runtime proof that RLS isolates user data
 *
 * Phase 1 close blocker P1.0-D. The pg_policies structural check
 * (verify-rls.ts) confirms that policies exist and use
 * `(user_id = auth.uid())`. This script proves the policies WORK at
 * runtime by exercising them with two real auth users.
 *
 * What it does:
 *   1. Create two fresh test users via auth.admin.createUser (with
 *      known passwords).
 *   2. As service-role (RLS bypassed), insert one `briefs` row owned
 *      by user A and one owned by user B.
 *   3. Sign in as user A (gets a session JWT). Open a new client with
 *      that session. Query briefs. Expect to see 1 row (A's) and only
 *      A's row — not B's.
 *   4. Same as user B; expect to see only B's row.
 *   5. Cleanup: delete both users (cascade drops their briefs via FK).
 *
 * Service-role bypasses RLS entirely (it's how the cron pipeline
 * writes per-user audit rows). The RLS test MUST use the anon key with
 * each user's session JWT to exercise the auth.uid() path. A
 * service-role-only check proves nothing.
 *
 * Pre-conditions:
 *   - .env.local has NEXT_PUBLIC_SUPABASE_URL +
 *     SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   - Network access to the dev Supabase project
 *
 * Usage:
 *   npx tsx scripts/smoke-rls-two-user.ts
 *
 * Exits non-zero if any user sees rows that don't belong to them.
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

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error(
    "❌ Missing one of NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function createUser(label: "A" | "B") {
  const email = `rls-smoke-${label.toLowerCase()}-${Date.now()}@forgeminds.test`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user?.id) {
    throw new Error(
      `Could not create user ${label}: ${error?.message ?? "no user returned"}`
    );
  }
  return { id: data.user.id, email, password };
}

async function deleteUser(userId: string) {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.warn(
      `⚠ Could not delete user ${userId.slice(0, 8)}…: ${error.message}`
    );
  }
}

async function clientFor(email: string, password: string) {
  // Fresh client with the user's session JWT bound, anon key as the
  // public-facing access token. PostgREST will read auth.uid() from
  // the JWT's `sub` claim — the same path real signed-in browser
  // sessions take.
  const c = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInWithPassword failed: ${error.message}`);
  return c;
}

async function main() {
  console.log("🔍 smoke-rls-two-user: validating RLS isolates user-owned data");
  console.log("");

  // 1. Create test users
  const userA = await createUser("A");
  const userB = await createUser("B");
  console.log(`   Created user A: ${userA.id} (${userA.email})`);
  console.log(`   Created user B: ${userB.id} (${userB.email})`);

  let pass = false;
  try {
    // 2. Service-role inserts one brief per user
    const { data: briefA, error: insAErr } = await admin
      .from("briefs")
      .insert({ user_id: userA.id, title: "Brief A — RLS smoke", brief_date: new Date().toISOString().slice(0, 10) })
      .select("id")
      .single();
    if (insAErr || !briefA?.id) throw new Error(`insert briefA failed: ${insAErr?.message}`);

    const { data: briefB, error: insBErr } = await admin
      .from("briefs")
      .insert({ user_id: userB.id, title: "Brief B — RLS smoke", brief_date: new Date().toISOString().slice(0, 10) })
      .select("id")
      .single();
    if (insBErr || !briefB?.id) throw new Error(`insert briefB failed: ${insBErr?.message}`);

    console.log(`   Inserted brief A=${briefA.id.slice(0, 8)}… and brief B=${briefB.id.slice(0, 8)}…`);
    console.log("");

    // 3. Sign in as user A; query both briefs by id
    const ca = await clientFor(userA.email, userA.password);
    const { data: aSeesA } = await ca.from("briefs").select("id").eq("id", briefA.id);
    const { data: aSeesB } = await ca.from("briefs").select("id").eq("id", briefB.id);

    // 4. Same for user B
    const cb = await clientFor(userB.email, userB.password);
    const { data: bSeesA } = await cb.from("briefs").select("id").eq("id", briefA.id);
    const { data: bSeesB } = await cb.from("briefs").select("id").eq("id", briefB.id);

    const result = {
      a_sees_own_brief: aSeesA?.length ?? 0,
      a_sees_other_brief: aSeesB?.length ?? 0,
      b_sees_own_brief: bSeesB?.length ?? 0,
      b_sees_other_brief: bSeesA?.length ?? 0,
    };

    console.log("   user A signed in:");
    console.log(`     sees own brief: ${result.a_sees_own_brief} (expected 1)`);
    console.log(`     sees other:     ${result.a_sees_other_brief} (expected 0)`);
    console.log("   user B signed in:");
    console.log(`     sees own brief: ${result.b_sees_own_brief} (expected 1)`);
    console.log(`     sees other:     ${result.b_sees_other_brief} (expected 0)`);
    console.log("");

    pass =
      result.a_sees_own_brief === 1 &&
      result.a_sees_other_brief === 0 &&
      result.b_sees_own_brief === 1 &&
      result.b_sees_other_brief === 0;
  } finally {
    await deleteUser(userA.id);
    await deleteUser(userB.id);
    console.log("   Cleaned up both test users (cascade dropped briefs)");
  }

  console.log("");
  if (pass) {
    console.log("✅ smoke-rls-two-user: RLS correctly isolates user data on briefs table");
    return;
  }
  console.log("❌ smoke-rls-two-user: RLS isolation FAILED — investigate immediately");
  console.log("   Either the policy is wrong, the auth.uid() path is broken, or the");
  console.log("   service-role insert wrote with a corrupted user_id.");
  process.exit(1);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
