import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsForm, type SettingsValues } from "@/components/settings/settings-form";

// Editable in Phase 1 — fetch fresh each load so a save round-trips visibly.
export const dynamic = "force-dynamic";

/**
 * Settings — Phase 1 EDITABLE view over the existing user_preferences columns
 * (design doc §R2.2). Account is read-only; everything else writes back via
 * /api/settings. Source management + conversational config stay Phase 1b.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id;

  const { data: prefs } = userId
    ? await supabase
        .from("user_preferences")
        .select(
          "timezone, cadence_minutes, active_hours_start, active_hours_end, active_days, recency_window_minutes, score_lookback_minutes, min_composite_score, max_articles_per_brief, max_per_category, max_per_entity, weight_relevance, weight_impact, weight_novelty, weight_credibility, delivery_email, delivery_push, auto_generate_content, social_platforms, social_tone, topics, excluded_topics, tracked_tickers"
        )
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };

  const { data: profile } = userId
    ? await supabase.from("profiles").select("display_name, tier, created_at").eq("user_id", userId).maybeSingle()
    : { data: null };

  const p = (prefs ?? {}) as Partial<SettingsValues>;
  const initial: SettingsValues = {
    timezone: p.timezone ?? "America/New_York",
    cadence_minutes: p.cadence_minutes ?? 30,
    active_hours_start: p.active_hours_start ?? 7,
    active_hours_end: p.active_hours_end ?? 23,
    active_days: p.active_days ?? ["mon", "tue", "wed", "thu", "fri"],
    recency_window_minutes: p.recency_window_minutes ?? 120,
    score_lookback_minutes: p.score_lookback_minutes ?? 240,
    min_composite_score: p.min_composite_score ?? 0.45,
    max_articles_per_brief: p.max_articles_per_brief ?? 15,
    max_per_category: p.max_per_category ?? 3,
    max_per_entity: p.max_per_entity ?? 2,
    weight_relevance: p.weight_relevance ?? 0.3,
    weight_impact: p.weight_impact ?? 0.3,
    weight_novelty: p.weight_novelty ?? 0.2,
    weight_credibility: p.weight_credibility ?? 0.2,
    delivery_email: p.delivery_email ?? true,
    delivery_push: p.delivery_push ?? false,
    auto_generate_content: p.auto_generate_content ?? false,
    social_platforms: p.social_platforms ?? [],
    social_tone: p.social_tone ?? "professional",
    topics: p.topics ?? [],
    excluded_topics: p.excluded_topics ?? [],
    tracked_tickers: p.tracked_tickers ?? [],
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Edit your pipeline preferences. Changes save to your account.</p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Email</dt>
            <dd className="font-mono">{user?.email ?? "—"}</dd>
            <dt className="text-zinc-500">Display name</dt>
            <dd>{profile?.display_name ?? "—"}</dd>
            <dt className="text-zinc-500">Tier</dt>
            <dd>
              <Badge variant="outline">{profile?.tier ?? "explorer"}</Badge>
            </dd>
            <dt className="text-zinc-500">Joined</dt>
            <dd>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}</dd>
            <dt className="text-zinc-500">User ID</dt>
            <dd className="font-mono text-xs text-zinc-500">{userId ?? "—"}</dd>
          </dl>
        </CardContent>
      </Card>

      <SettingsForm initial={initial} />
    </div>
  );
}
