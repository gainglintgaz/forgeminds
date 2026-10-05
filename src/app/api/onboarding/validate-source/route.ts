/**
 * POST /api/onboarding/validate-source
 *
 * Validates a user-submitted custom source URL before letting it land
 * in `sources`. Used by the "Add custom URL" power-user fallback on
 * /sources and as part of the onboarding wizard's "I have a source not
 * in the catalog" flow.
 *
 * Auth: signed-in user.
 * Body: { url: string }
 * Returns: ValidationResult (see @/lib/onboarding/source-validator).
 *
 * Why a route + not a client-side fetch: the validator follows
 * redirects and reads up to 2 MB of body — running it from the
 * browser would expose the user's IP to third parties + leak their
 * Supabase session origin. Server-side keeps both private + lets us
 * apply rate limiting (pending Phase 1.5 multi-user traffic — see CURRENT_SPRINT.md).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateSource } from "@/lib/onboarding/source-validator";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { url?: unknown };
  try {
    body = (await request.json()) as { url?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.url !== "string" || body.url.trim().length === 0) {
    return NextResponse.json(
      { error: "Body must include a non-empty `url` string." },
      { status: 400 }
    );
  }

  try {
    const result = await validateSource(body.url.trim());
    return NextResponse.json(result);
  } catch (e) {
    console.error("[/api/onboarding/validate-source] threw:", e);
    return NextResponse.json(
      {
        error: "Validation failed",
        detail: (e as Error).message,
      },
      { status: 500 }
    );
  }
}
