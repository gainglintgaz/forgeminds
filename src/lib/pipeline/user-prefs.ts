/**
 * Per-user pipeline preferences loader.
 *
 * Captures the per-user-from-day-1 principle (factory CLAUDE.md §17,
 * VIBE Rule 55): every value that affects user experience lives in the
 * user_preferences table with a sensible default — never as a hardcoded
 * literal in code.
 *
 * The cron dispatcher (private.dispatch_forgeminds_cron in pg_cron) decides
 * WHICH user runs WHEN. The route handlers then use this loader to know
 * HOW to run the pipeline for that user.
 *
 * Phase 1 fallback: if no user_preferences row exists for the requested
 * user_id, return defaults that match what was previously hardcoded in code.
 * That keeps the system pipeline (SYSTEM_USER_ID) working until Phase 2's
 * onboarding flow lets real users customize.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface PipelinePrefs {
  user_id: string;
  timezone: string;
  cadence_minutes: number;
  active_hours_start: number;
  active_hours_end: number;
  active_days: string[];
  recency_window_minutes: number;
  score_lookback_minutes: number;
  min_composite_score: number; // 0-1 scale (matches schema)
  max_articles_per_brief: number;
  max_per_category: number;
  max_per_entity: number;
  // Interest graph (S2 personalization, ERR-020). Drives the relevance score so
  // the brief favors THIS user's topics/tickers over the loudest generic feed.
  topics: string[];
  tracked_tickers: string[];
  excluded_topics: string[];
  // Pagination + batch-size knobs (audit Blocker 6, migration 20260504000000)
  score_batch_size: number;
  deliver_batch_size: number;
  briefs_page_size: number;
  dashboard_feed_size: number;
  // Voice DNA capture (migration 20260518000000). Null until the user
  // completes /onboarding/style.
  style_anchors: StyleAnchor[];
  style_tone: StyleTone | null;
  style_density: StyleDensity | null;
  style_captured_at: string | null;
}

export type StyleTone =
  | "concise"
  | "analytical"
  | "conversational"
  | "academic"
  | "investigative";
export type StyleDensity = "telegraphic" | "paragraph" | "longform";
export interface StyleAnchor {
  name: string;
  url?: string;
  why?: string;
  captured_at?: string;
}

// Defaults match what was hardcoded in the routes before the per-user redesign.
// They double as fall-back values when a row is missing (e.g., the SYSTEM_USER_ID
// pseudo-user used for testing before any real user signs up).
export const DEFAULT_PREFS: Omit<PipelinePrefs, "user_id"> = {
  timezone: "America/New_York",
  cadence_minutes: 30,
  active_hours_start: 7,
  active_hours_end: 23,
  active_days: ["mon", "tue", "wed", "thu", "fri"],
  recency_window_minutes: 120,
  score_lookback_minutes: 240,
  min_composite_score: 0.45,
  max_articles_per_brief: 15,
  max_per_category: 3,
  max_per_entity: 2,
  topics: [],
  tracked_tickers: [],
  excluded_topics: [],
  score_batch_size: 100,
  deliver_batch_size: 20,
  briefs_page_size: 30,
  dashboard_feed_size: 50,
  style_anchors: [],
  style_tone: null,
  style_density: null,
  style_captured_at: null,
};

export const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Resolve which user_id this cron invocation is for.
 *
 * Priority:
 *   1. ?user_id= query param (set by the dispatcher when it fires per-user)
 *   2. SYSTEM_USER_ID (fallback for manual curl during dev / pre-onboarding)
 *
 * Returns the resolved user_id as a string. Caller uses this for both
 * loadPrefs() and any DB writes scoped to the user.
 */
export function resolveUserId(request: Request): string {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("user_id");
  if (fromQuery && /^[0-9a-f-]{36}$/i.test(fromQuery)) {
    return fromQuery;
  }
  return SYSTEM_USER_ID;
}

/**
 * Load this user's pipeline preferences. Falls back to DEFAULT_PREFS for any
 * column the row doesn't have or if the row doesn't exist.
 */
export async function loadPrefs(
  supabase: SupabaseClient,
  userId: string
): Promise<PipelinePrefs> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select(
      "timezone, cadence_minutes, active_hours_start, active_hours_end, active_days, recency_window_minutes, score_lookback_minutes, min_composite_score, max_articles_per_brief, max_per_category, max_per_entity, topics, tracked_tickers, excluded_topics, score_batch_size, deliver_batch_size, briefs_page_size, dashboard_feed_size, style_anchors, style_tone, style_density, style_captured_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn(`[user-prefs] load failed for ${userId}: ${error.message} — using defaults`);
  }

  return {
    user_id: userId,
    timezone: data?.timezone ?? DEFAULT_PREFS.timezone,
    cadence_minutes: data?.cadence_minutes ?? DEFAULT_PREFS.cadence_minutes,
    active_hours_start: data?.active_hours_start ?? DEFAULT_PREFS.active_hours_start,
    active_hours_end: data?.active_hours_end ?? DEFAULT_PREFS.active_hours_end,
    active_days: data?.active_days ?? DEFAULT_PREFS.active_days,
    recency_window_minutes: data?.recency_window_minutes ?? DEFAULT_PREFS.recency_window_minutes,
    score_lookback_minutes: data?.score_lookback_minutes ?? DEFAULT_PREFS.score_lookback_minutes,
    min_composite_score: Number(data?.min_composite_score ?? DEFAULT_PREFS.min_composite_score),
    max_articles_per_brief: data?.max_articles_per_brief ?? DEFAULT_PREFS.max_articles_per_brief,
    max_per_category: data?.max_per_category ?? DEFAULT_PREFS.max_per_category,
    max_per_entity: data?.max_per_entity ?? DEFAULT_PREFS.max_per_entity,
    topics: (data?.topics as string[] | null) ?? DEFAULT_PREFS.topics,
    tracked_tickers: (data?.tracked_tickers as string[] | null) ?? DEFAULT_PREFS.tracked_tickers,
    excluded_topics: (data?.excluded_topics as string[] | null) ?? DEFAULT_PREFS.excluded_topics,
    score_batch_size: data?.score_batch_size ?? DEFAULT_PREFS.score_batch_size,
    deliver_batch_size: data?.deliver_batch_size ?? DEFAULT_PREFS.deliver_batch_size,
    briefs_page_size: data?.briefs_page_size ?? DEFAULT_PREFS.briefs_page_size,
    dashboard_feed_size: data?.dashboard_feed_size ?? DEFAULT_PREFS.dashboard_feed_size,
    style_anchors: (data?.style_anchors as StyleAnchor[] | null) ?? DEFAULT_PREFS.style_anchors,
    style_tone: (data?.style_tone as StyleTone | null) ?? DEFAULT_PREFS.style_tone,
    style_density: (data?.style_density as StyleDensity | null) ?? DEFAULT_PREFS.style_density,
    style_captured_at: data?.style_captured_at ?? DEFAULT_PREFS.style_captured_at,
  };
}
