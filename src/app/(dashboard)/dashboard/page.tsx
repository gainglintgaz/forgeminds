import { createClient } from "@/lib/supabase/server";
import { ArticleFeed } from "@/components/feed/article-feed";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function DashboardPage() {
  const supabase = await createClient();

  // Read the authenticated user's articles. Layout already gated this route
  // behind login (src/app/(dashboard)/layout.tsx redirects unauth → /login),
  // so getUser() should always resolve here.
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  // Fetch this user's recent articles. raw_articles is RLS-scoped to user_id
  // so RLS would filter even if we didn't pass the eq, but we pass it
  // explicitly because the service-role pipeline writes might use SYSTEM and
  // we want only this user's results.
  // This is a Server Component — reading current time at request-time is
  // correct; the react-hooks/purity rule targets client components.
  // eslint-disable-next-line react-hooks/purity
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Page size from user_preferences (audit Blocker 6 — no hardcoded UX limits).
  const { data: prefsRow } = userId
    ? await supabase
        .from("user_preferences")
        .select("dashboard_feed_size")
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };
  const feedSize = prefsRow?.dashboard_feed_size ?? 50;

  const { data: articles } = userId
    ? await supabase
        .from("raw_articles")
        .select("id, title, summary, url, source_name, published_at")
        .eq("user_id", userId)
        .gte("published_at", oneDayAgo)
        .order("published_at", { ascending: false })
        .limit(feedSize)
    : { data: [] };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Intelligence Feed</h1>
        <span className="text-sm text-zinc-500">
          {articles?.length || 0} articles today
        </span>
      </div>
      <ArticleFeed articles={articles || []} />
    </div>
  );
}
