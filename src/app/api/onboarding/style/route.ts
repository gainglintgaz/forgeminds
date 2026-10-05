import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/onboarding/style — persist Voice DNA capture.
 *
 * Writes to user_preferences:
 *   - style_anchors:    jsonb array of {name, url?, why?, captured_at}
 *   - style_tone:       one of concise/analytical/conversational/academic/investigative
 *   - style_density:    one of telegraphic/paragraph/longform
 *   - style_captured_at: now()
 *
 * Auth: server-side createClient — RLS scopes the update to auth.uid().
 *       No service role used; the user updates their own row only.
 */

const TONE_VALUES = new Set([
  "concise",
  "analytical",
  "conversational",
  "academic",
  "investigative",
]);
const DENSITY_VALUES = new Set(["telegraphic", "paragraph", "longform"]);

interface StyleAnchor {
  name: string;
  url?: string;
  why?: string;
  captured_at?: string;
}

interface RequestBody {
  style_anchors?: StyleAnchor[];
  style_tone?: string;
  style_density?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate anchors
  if (!Array.isArray(body.style_anchors) || body.style_anchors.length < 3) {
    return NextResponse.json(
      { error: "At least 3 style anchors required" },
      { status: 422 }
    );
  }
  if (body.style_anchors.length > 5) {
    return NextResponse.json(
      { error: "At most 5 style anchors allowed" },
      { status: 422 }
    );
  }
  for (const a of body.style_anchors) {
    if (!a || typeof a.name !== "string" || a.name.trim().length === 0) {
      return NextResponse.json(
        { error: "Each style anchor needs a name" },
        { status: 422 }
      );
    }
    if (a.name.length > 100) {
      return NextResponse.json(
        { error: "Anchor name max 100 chars" },
        { status: 422 }
      );
    }
    if (a.url && (a.url.length > 500 || !/^https?:\/\//.test(a.url))) {
      return NextResponse.json(
        { error: "Anchor URL must be http(s) and < 500 chars" },
        { status: 422 }
      );
    }
    if (a.why && a.why.length > 300) {
      return NextResponse.json(
        { error: "Anchor 'why' max 300 chars" },
        { status: 422 }
      );
    }
  }

  // Validate tone + density against CHECK constraint values
  if (!body.style_tone || !TONE_VALUES.has(body.style_tone)) {
    return NextResponse.json(
      { error: `style_tone must be one of: ${[...TONE_VALUES].join(", ")}` },
      { status: 422 }
    );
  }
  if (!body.style_density || !DENSITY_VALUES.has(body.style_density)) {
    return NextResponse.json(
      { error: `style_density must be one of: ${[...DENSITY_VALUES].join(", ")}` },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();

  // Normalize anchors — strip empties, ensure captured_at is set.
  const normalizedAnchors: StyleAnchor[] = body.style_anchors.map((a) => ({
    name: a.name.trim(),
    ...(a.url?.trim() ? { url: a.url.trim() } : {}),
    ...(a.why?.trim() ? { why: a.why.trim() } : {}),
    captured_at: a.captured_at ?? now,
  }));

  // Upsert against user_preferences. user_id is PK on that table.
  const { error: updateErr } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        style_anchors: normalizedAnchors,
        style_tone: body.style_tone,
        style_density: body.style_density,
        style_captured_at: now,
      },
      { onConflict: "user_id" }
    );

  if (updateErr) {
    console.error(
      `[/api/onboarding/style] update failed for user=${user.id.slice(0, 8)}:`,
      updateErr.message
    );
    return NextResponse.json(
      { error: "Could not save style preferences", detail: updateErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    anchors_saved: normalizedAnchors.length,
    captured_at: now,
  });
}
