import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const revalidate = 60;

/**
 * Settings — Phase 1 read-only view of pipeline preferences.
 *
 * Shows the user's user_preferences row (the per-user knobs that drive the
 * cron dispatcher and route handlers — schedule, recency window, score
 * threshold, brief density, delivery channels). Phase 2 wraps each section
 * in an edit form. Phase 1 is read-only so we have something to look at
 * without building forms before the pipeline is proven to work.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const { data: prefs } = userId
    ? await supabase
        .from("user_preferences")
        .select(
          "timezone, cadence_minutes, active_hours_start, active_hours_end, active_days, recency_window_minutes, score_lookback_minutes, min_composite_score, max_articles_per_brief, max_per_category, max_per_entity, delivery_email, delivery_push, tracked_tickers, topics, excluded_topics, social_tone"
        )
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };

  const { data: profile } = userId
    ? await supabase
        .from("profiles")
        .select("display_name, tier, timezone, created_at")
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Read-only view of your pipeline preferences. Edit forms ship in Phase 2.
        </p>
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

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Pipeline schedule</CardTitle>
          <CardDescription>
            When and how often the news pipeline runs for you. Driven by the
            pg_cron dispatcher (see migration 20260501000001).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[200px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Timezone</dt>
            <dd>{prefs?.timezone ?? "America/New_York"}</dd>
            <dt className="text-zinc-500">Cadence</dt>
            <dd>Every {prefs?.cadence_minutes ?? 30} minutes</dd>
            <dt className="text-zinc-500">Active hours</dt>
            <dd>
              {prefs?.active_hours_start ?? 7}:00 – {prefs?.active_hours_end ?? 23}:00 ({prefs?.timezone ?? "local"})
            </dd>
            <dt className="text-zinc-500">Active days</dt>
            <dd>{(prefs?.active_days ?? ["mon", "tue", "wed", "thu", "fri"]).join(", ")}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Pipeline windows</CardTitle>
          <CardDescription>
            How far back each pipeline step looks for work to do.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[200px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Recency window</dt>
            <dd>{prefs?.recency_window_minutes ?? 120} minutes (ingest dedup horizon)</dd>
            <dt className="text-zinc-500">Score lookback</dt>
            <dd>{prefs?.score_lookback_minutes ?? 240} minutes (how far back to grab unscored)</dd>
            <dt className="text-zinc-500">Min composite score</dt>
            <dd>{prefs?.min_composite_score ?? 0.45} (0-1 scale; below this article doesn&apos;t make brief)</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Brief density</CardTitle>
          <CardDescription>How big and diverse each brief is.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[200px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Max articles per brief</dt>
            <dd>{prefs?.max_articles_per_brief ?? 15}</dd>
            <dt className="text-zinc-500">Max per category</dt>
            <dd>{prefs?.max_per_category ?? 3}</dd>
            <dt className="text-zinc-500">Max per entity</dt>
            <dd>{prefs?.max_per_entity ?? 2}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Delivery</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[200px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Email digests</dt>
            <dd>
              {prefs?.delivery_email ? (
                <Badge variant="default">Enabled</Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </dd>
            <dt className="text-zinc-500">Push notifications</dt>
            <dd>
              {prefs?.delivery_push ? (
                <Badge variant="default">Enabled</Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </dd>
            <dt className="text-zinc-500">Social tone</dt>
            <dd>{prefs?.social_tone ?? "professional"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Topics &amp; tickers</CardTitle>
          <CardDescription>
            What you&apos;re tracking. Phase 2 adds editing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[200px_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Topics</dt>
            <dd>
              {prefs?.topics && prefs.topics.length > 0
                ? prefs.topics.join(", ")
                : <span className="text-zinc-400">none yet</span>}
            </dd>
            <dt className="text-zinc-500">Tracked tickers</dt>
            <dd className="font-mono">
              {prefs?.tracked_tickers && prefs.tracked_tickers.length > 0
                ? prefs.tracked_tickers.map((t: string) => `$${t}`).join("  ")
                : <span className="text-zinc-400">none yet</span>}
            </dd>
            <dt className="text-zinc-500">Excluded topics</dt>
            <dd>
              {prefs?.excluded_topics && prefs.excluded_topics.length > 0
                ? prefs.excluded_topics.join(", ")
                : <span className="text-zinc-400">none</span>}
            </dd>
          </dl>
        </CardContent>
      </Card>

      <p className="text-xs text-zinc-400 mt-6">
        Phase 1 ships read-only. Phase 2 wraps each section in an edit form
        backed by the same `user_preferences` row.
      </p>
    </div>
  );
}
