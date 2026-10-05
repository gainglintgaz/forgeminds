/**
 * Server-side helpers shared by the action routes. The cookie (authenticated) client
 * is RLS-scoped, so loading an article by id also enforces that the caller owns it —
 * a user can never act on another user's article. NEVER use the service-role client in
 * these user routes (design doc §3 hard rule).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionArticle } from "./types";

export async function loadActionArticle(
  supabase: SupabaseClient,
  articleId: string
): Promise<ActionArticle | null> {
  const { data } = await supabase
    .from("raw_articles")
    .select("id, title, url, summary, full_text, source_name, published_at")
    .eq("id", articleId)
    .maybeSingle();
  return (data as ActionArticle | null) ?? null;
}

/** Validate a UUID-ish articleId from the request body before any DB call. */
export function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}
