import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/logout — sign the current user out.
 *
 * Uses the request-scoped server Supabase client so the cookie-based session
 * is cleared on the response. Always returns 200 so the client can navigate
 * away regardless of whether there was a session to clear.
 *
 * Wired in Phase 0 to satisfy VIBE Rule 51 ("No Dead UI") — the dashboard
 * topbar's logout control needs a working endpoint, not a placeholder.
 */
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
