/**
 * verify-rls.ts — RLS coverage gate
 *
 * For every public table, confirms:
 *   - rowsecurity = true (RLS is ENABLED on the table)
 *   - at least one policy exists in pg_policies
 *
 * Why both: enabling RLS without policies makes the table effectively
 * read-only-to-nobody for non-service-role keys. Conversely, having policies
 * but `rowsecurity = false` means the policies are dead code and any
 * authenticated request can read/write everything.
 *
 * Allow-list: a small set of "shared reference" tables may be intentionally
 * RLS-disabled (read-only public reference data). They must be explicitly
 * named below or the gate fails.
 *
 * Usage:
 *   npx tsx scripts/verify-rls.ts
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

// Tables that legitimately have RLS off (public reference data, no PII).
// Each entry must be justified in a comment.
const RLS_DISABLED_ALLOWED = new Set<string>([
  // none for now — every public table must have RLS on
]);

type RlsRow = {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
};

async function main() {
  console.log("🔍 verify-rls: querying RLS state for public schema…");

  const { data, error } = await supabase.rpc("forgeminds_rls_state");
  if (error || !data) {
    console.error(
      "\n❌ RLS introspection helper missing.\n" +
        "   Run this SQL in the Supabase SQL editor (one-time setup):\n\n" +
        "   create or replace function public.forgeminds_rls_state()\n" +
        "     returns table(table_name text, rls_enabled boolean, policy_count bigint)\n" +
        "     language sql security definer set search_path = public\n" +
        "     as $$\n" +
        "       select c.relname::text,\n" +
        "              c.relrowsecurity,\n" +
        "              coalesce((select count(*) from pg_policies p\n" +
        "                          where p.schemaname='public' and p.tablename=c.relname), 0)\n" +
        "       from pg_class c\n" +
        "       join pg_namespace n on n.oid = c.relnamespace\n" +
        "       where n.nspname='public' and c.relkind='r'\n" +
        "       order by c.relname;\n" +
        "     $$;\n" +
        "   grant execute on function public.forgeminds_rls_state() to service_role;\n\n" +
        `   SDK error: ${error?.message ?? "no data returned"}\n`
    );
    process.exit(2);
  }

  const rows = data as RlsRow[];
  console.log(`   ${rows.length} public tables found`);

  const failures: string[] = [];
  for (const row of rows) {
    const allowed = RLS_DISABLED_ALLOWED.has(row.table_name);
    if (!row.rls_enabled && !allowed) {
      failures.push(`   ✗ ${row.table_name}: RLS DISABLED (and not in allow-list)`);
      continue;
    }
    if (row.rls_enabled && Number(row.policy_count) === 0 && !allowed) {
      failures.push(
        `   ✗ ${row.table_name}: RLS enabled but ZERO policies (effectively no access)`
      );
    }
  }

  if (failures.length === 0) {
    console.log(`✅ verify-rls: ${rows.length}/${rows.length} tables compliant`);
    return;
  }
  console.log("");
  console.log(`❌ verify-rls: ${failures.length} table(s) failed:`);
  for (const f of failures) console.log(f);
  process.exit(1);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
