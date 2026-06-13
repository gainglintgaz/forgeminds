/**
 * POST /api/actions/save  —  Save to Brain (no AI).
 *
 * Inserts a saved_items brain row, records the article outcome, and tracks the event.
 * Dedup via the partial unique index saved_items(user_id, article_id) WHERE is_brain_item
 * (migration 20260613000006): a 23505 means "already saved" (VIBE Rule 37 — skip, never retry).
 *
 * Cookie auth only (RLS-scoped); the RPCs use auth.uid() internally so they MUST run on
 * the authenticated client, never service-role (design doc §3 hard rule).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveSaveConfig } from "@/lib/actions/resolve-config";
import { loadActionArticle, isUuid } from "@/lib/actions/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { articleId?: unknown; overrides?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isUuid(body.articleId)) {
    return NextResponse.json({ error: "articleId must be a uuid" }, { status: 400 });
  }
  const articleId = body.articleId;

  const article = await loadActionArticle(supabase, articleId);
  if (!article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  const config = await resolveSaveConfig(supabase, user.id, body.overrides ?? {});

  // Insert the brain row. 23505 (already saved) is success, not an error.
  const { data: inserted, error: insertError } = await supabase
    .from("saved_items")
    .insert({
      user_id: user.id,
      item_type: "article",
      article_id: articleId,
      title: article.title,
      external_url: article.url,
      is_brain_item: true,
      tags: config.tags,
      notes: config.note,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ saved: true, alreadySaved: true });
    }
    console.error(
      `[actions/save] saved_items insert failed (user=${user.id.slice(0, 8)}, article=${articleId.slice(0, 8)}): ${insertError.message}`
    );
    return NextResponse.json(
      { error: "save_failed", detail: insertError.message },
      { status: 500 }
    );
  }

  const savedItemId = inserted.id as string;

  // Secondary signals — failures here don't undo a real save; log with context (VIBE 52).
  const { error: outcomeError } = await supabase.rpc("upsert_article_outcome", {
    p_article_id: articleId,
    p_outcome: "saved",
  });
  if (outcomeError) {
    console.error(
      `[actions/save] upsert_article_outcome failed (article=${articleId.slice(0, 8)}): ${outcomeError.message}`
    );
  }

  const { error: eventError } = await supabase.rpc("track_event", {
    p_event_type: "article_save",
    p_article_id: articleId,
    p_saved_item_id: savedItemId,
  });
  if (eventError) {
    console.error(
      `[actions/save] track_event failed (article=${articleId.slice(0, 8)}): ${eventError.message}`
    );
  }

  return NextResponse.json({ saved: true, alreadySaved: false, savedItemId });
}
