/**
 * POST /api/onboarding/finalize
 *
 * Commit step. The user has reviewed proposals on /onboarding/refine
 * and clicked "Start my pipeline" on /onboarding/confirm. This endpoint:
 *
 *   1. Reads the enabled-flagged proposals from source_suggestions.
 *   2. Inserts a row in `sources` for each (so the dispatcher picks
 *      them up on next tick).
 *   3. Marks each accepted source_suggestions row as status='accepted'
 *      with resulting_source_id pointing at the new sources row.
 *   4. Optionally writes the extracted intent fields to user_preferences
 *      (depthPref → density caps, cadencePref → cadence_minutes, etc.).
 *
 * Idempotent: if the user clicks "Start my pipeline" twice, the second
 * call sees status='accepted' rows and short-circuits without creating
 * duplicate `sources` rows.
 *
 * Auth: signed-in user only.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { UserIntent } from "@/lib/onboarding/types";

interface FinalizeRequestBody {
  /** Catalog ids the user kept enabled. */
  acceptedCatalogIds: string[];
  /** Optional: extracted intent we should write to user_preferences. */
  intent?: UserIntent;
}

interface FinalizeResponseBody {
  sourcesCreated: number;
  sourcesAlreadyExisted: number;
  preferencesUpdated: boolean;
  /** ids of rows in `sources` after the operation (existing + new). */
  sourceIds: string[];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: FinalizeRequestBody;
  try {
    body = (await request.json()) as FinalizeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    !Array.isArray(body.acceptedCatalogIds) ||
    body.acceptedCatalogIds.length === 0
  ) {
    return NextResponse.json(
      { error: "acceptedCatalogIds must be a non-empty array." },
      { status: 400 }
    );
  }

  const service = await createServiceClient();

  // Pull the user's pending suggestions matching the accepted catalog ids.
  const { data: pending, error: pendingError } = await service
    .from("source_suggestions")
    .select("id, catalog_id, name, url, type, status, resulting_source_id")
    .eq("user_id", user.id)
    .in("catalog_id", body.acceptedCatalogIds);

  if (pendingError) {
    return NextResponse.json(
      { error: "Could not load pending suggestions", detail: pendingError.message },
      { status: 500 }
    );
  }

  let sourcesCreated = 0;
  let sourcesAlreadyExisted = 0;
  const sourceIds: string[] = [];

  for (const sug of pending ?? []) {
    // Idempotency: if this suggestion was already accepted, reuse the
    // pre-existing source row.
    if (sug.status === "accepted" && sug.resulting_source_id) {
      sourcesAlreadyExisted += 1;
      sourceIds.push(sug.resulting_source_id);
      continue;
    }

    // Create the sources row. Use upsert on (user_id, type, url) to
    // be defensive against the user having added the same source
    // manually before going through onboarding — we don't want
    // duplicates.
    const { data: source, error: insertError } = await service
      .from("sources")
      .upsert(
        {
          user_id: user.id,
          type: sug.type,
          name: sug.name,
          url: sug.url,
          is_active: true,
          config: {},
        },
        { onConflict: "user_id,type,url", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (insertError || !source) {
      // Skip but don't fail the whole batch — log + move on.
      console.error(
        `[/api/onboarding/finalize] insert source failed for ${sug.name}:`,
        insertError
      );
      continue;
    }

    sourcesCreated += 1;
    sourceIds.push(source.id);

    // Mark the suggestion as accepted with resulting_source_id.
    const { error: updateError } = await service
      .from("source_suggestions")
      .update({
        status: "accepted",
        resulting_source_id: source.id,
      })
      .eq("id", sug.id);
    if (updateError) {
      console.error(
        `[/api/onboarding/finalize] suggestion update failed for ${sug.id}:`,
        updateError
      );
    }
  }

  // Optionally apply intent → user_preferences. We only write a
  // narrow set of fields the intent maps to cleanly; everything else
  // keeps its default.
  let preferencesUpdated = false;
  if (body.intent) {
    const cadenceMinutes = mapCadenceToMinutes(body.intent.cadencePref);
    const maxArticles = mapDepthToMaxArticles(body.intent.depthPref);
    const updatePayload: Record<string, unknown> = {
      cadence_minutes: cadenceMinutes,
      max_articles_per_brief: maxArticles,
    };

    const { error: prefsError } = await service
      .from("user_preferences")
      .upsert({ user_id: user.id, ...updatePayload }, { onConflict: "user_id" });

    if (prefsError) {
      console.error(
        "[/api/onboarding/finalize] user_preferences upsert failed:",
        prefsError
      );
    } else {
      preferencesUpdated = true;
    }
  }

  const response: FinalizeResponseBody = {
    sourcesCreated,
    sourcesAlreadyExisted,
    preferencesUpdated,
    sourceIds,
  };
  return NextResponse.json(response);
}

function mapCadenceToMinutes(pref: UserIntent["cadencePref"]): number {
  switch (pref) {
    case "realtime":
      return 15;
    case "daily":
      return 60;
    case "weekly":
      return 1440; // once a day, but pipeline still ticks
  }
}

function mapDepthToMaxArticles(pref: UserIntent["depthPref"]): number {
  switch (pref) {
    case "shallow":
      return 25;
    case "medium":
      return 15;
    case "deep":
      return 8;
  }
}
