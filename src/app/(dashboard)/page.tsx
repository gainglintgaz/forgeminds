import { createClient } from "@/lib/supabase/server";
import { ArticleFeed } from "@/components/feed/article-feed";

export const revalidate = 60; // Revalidate every 60 seconds

export default async function DashboardPage() {
  const supabase = await createClient();

  // Fetch recent articles (last 24 hours) from raw_articles. Phase 0 reads
  // canonical columns: summary (not description), no entity_ids — entity
  // resolution is a Phase 1 concern that lives on scored_articles per the
  // schema design (see ARCHITECTURE_NOTES Schema Canonical Names Reference).
  // This is a Server Component, so reading current time at request-time is
  // correct; the react-hooks/purity rule targets client components.
  // eslint-disable-next-line react-hooks/purity
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: articles } = await supabase
    .from("raw_articles")
    .select("id, title, summary, url, source_name, published_at")
    .gte("published_at", oneDayAgo)
    .order("published_at", { ascending: false })
    .limit(50);

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
