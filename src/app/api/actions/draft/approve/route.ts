/**
 * POST /api/actions/draft/approve  —  the HITL gate.
 *
 * Sets a pending_approval draft to status='approved' + approved_at=now(). Cookie auth,
 * RLS-scoped (a user can only approve their own draft). Idempotent: approving an already
 * approved draft is a no-op success.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/actions/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { draftId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isUuid(body.draftId)) {
    return NextResponse.json({ error: "draftId must be a uuid" }, { status: 400 });
  }
  const draftId = body.draftId;

  const { data: updated, error: updateError } = await supabase
    .from("content_drafts")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("user_id", user.id)
    .select("id, status, approved_at")
    .maybeSingle();

  if (updateError) {
    console.error(
      `[actions/draft/approve] update failed (draft=${draftId.slice(0, 8)}): ${updateError.message}`
    );
    return NextResponse.json({ error: "approve_failed", detail: updateError.message }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const { error: eventError } = await supabase.rpc("track_event", {
    p_event_type: "feature_used",
    p_draft_id: draftId,
    p_metadata: { action: "draft_approve" },
  });
  if (eventError) {
    console.error(`[actions/draft/approve] track_event failed (draft=${draftId.slice(0, 8)}): ${eventError.message}`);
  }

  return NextResponse.json({ approved: true, status: updated.status, approvedAt: updated.approved_at });
}
