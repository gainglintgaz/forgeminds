/**
 * POST /api/settings  —  editable Settings (design doc §R2.2). NO new schema; every field
 * is an existing user_preferences column. Validates (hours 0-23, min_composite_score 0-1,
 * weights ≥0, cadence sane) then upserts. Partial: only validated, present fields are written.
 * Cookie auth + RLS (a user only writes their own row). Per Rule 55 these knobs already live in
 * the DB — this is the "form over existing schema" the rule promised, not a rewrite.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

type Errors = string[];

function intInRange(v: unknown, min: number, max: number, field: string, errors: Errors): number | undefined {
  if (v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    errors.push(`${field} must be an integer between ${min} and ${max}`);
    return undefined;
  }
  return n;
}
function numInRange(v: unknown, min: number, max: number, field: string, errors: Errors): number | undefined {
  if (v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    errors.push(`${field} must be a number between ${min} and ${max}`);
    return undefined;
  }
  return n;
}
function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}
function nonEmptyString(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, max) : undefined;
}
function stringArray(v: unknown, eachMax: number, max: number, upper = false): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => {
      const t = s.trim().slice(0, eachMax);
      return upper ? t.toUpperCase() : t;
    });
  return Array.from(new Set(out)).slice(0, max);
}
function daysArray(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((s): s is string => typeof s === "string" && DAYS.has(s.toLowerCase())).map((s) => s.toLowerCase());
  return Array.from(new Set(out));
}
function scheduleTimes(v: unknown, errors: Errors): Record<string, string> | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    errors.push("schedule_times must be an object of HH:MM strings");
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(val)) out[k.slice(0, 32)] = val;
    else {
      errors.push(`schedule_times.${k} must be HH:MM`);
      return undefined;
    }
  }
  return out;
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

  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const errors: Errors = [];
  const update: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) update[k] = v;
  };

  // Schedule
  set("timezone", nonEmptyString(b.timezone, 64));
  set("cadence_minutes", intInRange(b.cadence_minutes, 5, 10080, "cadence_minutes", errors));
  const startH = intInRange(b.active_hours_start, 0, 23, "active_hours_start", errors);
  const endH = intInRange(b.active_hours_end, 0, 23, "active_hours_end", errors);
  if (startH !== undefined && endH !== undefined && startH > endH) {
    errors.push("active_hours_start must be <= active_hours_end");
  } else {
    set("active_hours_start", startH);
    set("active_hours_end", endH);
  }
  set("active_days", daysArray(b.active_days));
  set("schedule_days", daysArray(b.schedule_days));
  set("schedule_times", scheduleTimes(b.schedule_times, errors));

  // Windows
  set("recency_window_minutes", intInRange(b.recency_window_minutes, 1, 100000, "recency_window_minutes", errors));
  set("score_lookback_minutes", intInRange(b.score_lookback_minutes, 1, 100000, "score_lookback_minutes", errors));
  set("min_composite_score", numInRange(b.min_composite_score, 0, 1, "min_composite_score", errors));

  // Density
  set("max_articles_per_brief", intInRange(b.max_articles_per_brief, 1, 200, "max_articles_per_brief", errors));
  set("max_per_category", intInRange(b.max_per_category, 1, 100, "max_per_category", errors));
  set("max_per_entity", intInRange(b.max_per_entity, 1, 100, "max_per_entity", errors));

  // Scoring weights (≥ 0)
  set("weight_relevance", numInRange(b.weight_relevance, 0, 100, "weight_relevance", errors));
  set("weight_impact", numInRange(b.weight_impact, 0, 100, "weight_impact", errors));
  set("weight_novelty", numInRange(b.weight_novelty, 0, 100, "weight_novelty", errors));
  set("weight_credibility", numInRange(b.weight_credibility, 0, 100, "weight_credibility", errors));

  // Delivery + content
  set("delivery_email", bool(b.delivery_email));
  set("delivery_push", bool(b.delivery_push));
  set("auto_generate_content", bool(b.auto_generate_content));
  set("social_platforms", stringArray(b.social_platforms, 40, 20));
  set("social_tone", nonEmptyString(b.social_tone, 40));

  // Tracking chips
  set("topics", stringArray(b.topics, 80, 100));
  set("excluded_topics", stringArray(b.excluded_topics, 80, 100));
  set("tracked_tickers", stringArray(b.tracked_tickers, 12, 100, true));

  if (errors.length > 0) {
    return NextResponse.json({ error: "validation_failed", details: errors }, { status: 400 });
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error: upsertError } = await supabase
    .from("user_preferences")
    .upsert({ user_id: user.id, ...update }, { onConflict: "user_id" });

  if (upsertError) {
    console.error(`[api/settings] upsert failed (user=${user.id.slice(0, 8)}): ${upsertError.message}`);
    return NextResponse.json({ error: "save_failed", detail: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true, updated: Object.keys(update) });
}
