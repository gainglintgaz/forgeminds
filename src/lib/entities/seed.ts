import { type SupabaseClient } from "@supabase/supabase-js";

/**
 * Entity seeding is DEPRECATED.
 *
 * Per ARCHITECTURE_NOTES + DECISIONS.md (2026-04-26 "No hardcoded seed entities"):
 * entities are discovered lazily via Wikidata at first article mention. Hardcoded
 * SQL seeds go stale immediately, have ~40-entity coverage versus Wikidata's
 * 110M, and require manual maintenance forever.
 *
 * The canonical entity-resolution path is `src/lib/entities/resolver.ts`. When
 * Wikidata-backed `resolveOrCreateEntity()` lands, this file will be deleted.
 *
 * Keeping the function as a no-op preserves the import surface during transition
 * so any caller compiles cleanly. Returns `created: 0, skipped: 0`.
 */
export async function seedEntities(
  supabase: SupabaseClient
): Promise<{ created: number; skipped: number }> {
  // Intentional no-op. The `supabase` parameter is preserved on the call
  // signature for back-compat with any caller that already passes it; we
  // don't use it in the body. Reference once to satisfy `no-unused-vars`.
  void supabase;
  return { created: 0, skipped: 0 };
}
