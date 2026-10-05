import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// User-scoped and changes the moment a story is saved/unsaved — render per request.
export const dynamic = "force-dynamic";

interface SavedOutcomeRow {
  article_id: string;
  rating: number | null;
  updated_at: string | null;
}

interface ArticleRow {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  source_name: string | null;
  published_at: string | null;
}

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id;

  // "Saved" lives in article_outcomes (outcome='saved') — that's where the Save
  // button on /briefs/[id] writes via the upsert_article_outcome RPC. The saved_items
  // table exists in schema but is unused (0 rows); reading it would show an empty page
  // forever. Read the real source of truth (review C-5). RLS scopes to the current user;
  // the .eq("user_id") is belt-and-suspenders.
  const { data: savedRows } = userId
    ? await supabase
        .from("article_outcomes")
        .select("article_id, rating, updated_at")
        .eq("user_id", userId)
        .eq("outcome", "saved")
        .order("updated_at", { ascending: false })
    : { data: [] };

  const saved = (savedRows ?? []) as SavedOutcomeRow[];
  const articleIds = saved.map((r) => r.article_id);

  // Single .in() hydration — no N+1 (VIBE Rule 53).
  const articlesById = new Map<string, ArticleRow>();
  if (articleIds.length > 0) {
    const { data: articleRows } = await supabase
      .from("raw_articles")
      .select("id, title, summary, url, source_name, published_at")
      .in("id", articleIds);
    for (const a of (articleRows ?? []) as ArticleRow[]) articlesById.set(a.id, a);
  }

  // Preserve saved-order (updated_at desc); drop any saved outcome whose article row
  // is missing (pruned/deleted) rather than render a blank card.
  const items = saved
    .map((s) => ({ outcome: s, article: articlesById.get(s.article_id) }))
    .filter(
      (x): x is { outcome: SavedOutcomeRow; article: ArticleRow } => x.article != null
    );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saved</h1>
          <p className="text-sm text-zinc-500">Stories you tapped Save on.</p>
        </div>
        <span className="text-sm text-zinc-500">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nothing saved yet</CardTitle>
            <CardDescription>
              Tap <span className="font-medium">Save</span> on any story inside a brief and
              it lands here. Saved stories also help tune what tomorrow&apos;s brief surfaces
              for you.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map(({ outcome, article }) => (
            <Card key={article.id}>
              <CardHeader className="pb-2">
                {article.url ? (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-medium tracking-tight hover:underline underline-offset-4"
                  >
                    {article.title}
                  </a>
                ) : (
                  <span className="text-base font-medium tracking-tight">
                    {article.title}
                  </span>
                )}
                <p className="text-xs text-zinc-500 mt-1">
                  {article.source_name ?? "Unknown source"}
                  {outcome.updated_at
                    ? ` · saved ${new Date(outcome.updated_at).toLocaleDateString()}`
                    : ""}
                  {outcome.rating ? ` · rated ${outcome.rating}/5` : ""}
                </p>
              </CardHeader>
              {article.summary ? (
                <CardContent className="pt-0">
                  <p className="text-sm text-zinc-600 leading-relaxed line-clamp-2">
                    {article.summary}
                  </p>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
