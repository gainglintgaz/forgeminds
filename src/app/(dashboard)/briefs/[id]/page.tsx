import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArticleOutcomeBar, type Outcome } from "@/components/briefs/article-outcome-bar";

// Per-render dynamic — outcomes change on every save/dismiss click and
// the page should reflect them on refresh. revalidate disabled.
export const dynamic = "force-dynamic";

interface BriefDetail {
  id: string;
  title: string;
  brief_date: string;
  brief_type: string;
  summary_html: string | null;
  summary_text: string | null;
  article_ids: string[] | null;
  ticker_symbols: string[] | null;
  categories_covered: string[] | null;
  article_count: number | null;
  is_delivered: boolean;
  delivered_at: string | null;
  generation_model: string | null;
  prompt_version: string | null;
}

interface ArticleRow {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  source_name: string | null;
  published_at: string | null;
}

interface OutcomeRow {
  article_id: string;
  outcome: Outcome;
  rating: number | null;
  updated_at: string | null;
}

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: briefRaw } = await supabase
    .from("briefs")
    .select(
      "id, title, brief_date, brief_type, summary_html, summary_text, article_ids, ticker_symbols, categories_covered, article_count, is_delivered, delivered_at, generation_model, prompt_version"
    )
    .eq("id", id)
    .single();

  if (!briefRaw) {
    notFound();
  }

  const brief = briefRaw as BriefDetail;

  // Hydrate the article list. Empty array if article_ids is null/empty.
  const articleIds = (brief.article_ids ?? []) as string[];
  let articles: ArticleRow[] = [];
  if (articleIds.length > 0) {
    const { data: articleRows } = await supabase
      .from("raw_articles")
      .select("id, title, summary, url, source_name, published_at")
      .in("id", articleIds);
    articles = (articleRows ?? []) as ArticleRow[];
  }

  // Pre-load existing outcomes for this user × these articles. One row
  // per (user, article). RLS gates this to the current user. First
  // paint then renders save/dismiss/rate buttons in correct state.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const outcomesByArticle = new Map<
    string,
    { outcome: Outcome; rating: number | null; updated_at: string | null }
  >();
  if (user && articleIds.length > 0) {
    const { data: outcomeRows } = await supabase
      .from("article_outcomes")
      .select("article_id, outcome, rating, updated_at")
      .eq("user_id", user.id)
      .in("article_id", articleIds);
    for (const row of (outcomeRows ?? []) as OutcomeRow[]) {
      outcomesByArticle.set(row.article_id, {
        outcome: row.outcome,
        rating: row.rating,
        updated_at: row.updated_at,
      });
    }
  }

  // Outcome count for the week — DMG-aware header chip per Bridge Brief
  // §5 (Data Citizenship destinations include "this bar header"). We
  // count distinct (article, outcome ≠ no_action) rows the user has
  // captured in the trailing 7 days. Single .gte() query, no N+1.
  // Note: this is a server component with `dynamic = "force-dynamic"` —
  // it runs once per request, so reading the current clock is the
  // intended behavior. React 19 react-hooks/purity flags Date.now() as
  // impure assuming client re-render semantics; disabled here because
  // the assumption doesn't hold for dynamic server components.
  // eslint-disable-next-line react-hooks/purity
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let outcomesThisWeek = 0;
  if (user) {
    const { count } = await supabase
      .from("article_outcomes")
      .select("outcome_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("updated_at", weekAgoIso)
      .neq("outcome", "no_action");
    outcomesThisWeek = count ?? 0;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-4">
        <Link
          href="/briefs"
          className="text-sm text-zinc-500 hover:text-zinc-900 underline-offset-4 hover:underline"
        >
          ← Back to briefs
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{brief.title}</h1>
        <p className="text-sm text-zinc-500 mt-2">
          {brief.brief_date} · {brief.article_count ?? articles.length}{" "}
          {(brief.article_count ?? articles.length) === 1 ? "story" : "stories"}
          {brief.is_delivered ? " · Delivered" : " · Pending delivery"}
        </p>
        {/* DMG-aware outcome-count chip. Per Bridge Brief §5 + the
            data-integrity rule (rules/data-integrity.md): show a real
            number when the user has captured at least one outcome this
            week; show an honest empty-state prompt otherwise. The
            sample-size threshold for displaying = 1, per the contract
            that outcome capture is binary and AVAILABLE from brief #1
            (Bridge Brief §1 five-states). */}
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          {outcomesThisWeek > 0 ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800"
              title={[
                `${outcomesThisWeek} outcome${outcomesThisWeek === 1 ? "" : "s"} captured in the trailing 7 days.`,
                "",
                "Source:       article_outcomes rows where outcome ≠ no_action",
                "              and updated_at ≥ now() − 7 days",
                "Derivation:   COUNT(*) per the query above",
                "Destinations: this header · future per-user scoring weights",
                "              (Phase 3) · alpha exit-interview metrics",
                "Provenance:   updated_at on each underlying row",
              ].join("\n")}
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>
                {outcomesThisWeek} outcome{outcomesThisWeek === 1 ? "" : "s"} captured this week
              </span>
            </span>
          ) : (
            <span className="text-zinc-400 italic">
              No outcomes captured yet — one tap below tunes tomorrow&apos;s pick.
            </span>
          )}
        </div>
        {brief.categories_covered && brief.categories_covered.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-3">
            {brief.categories_covered.map((c) => (
              <Badge key={c} variant="outline" className="text-xs">
                {c}
              </Badge>
            ))}
          </div>
        ) : null}
      </header>

      {brief.summary_html ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm prose-zinc max-w-none"
              // summary_html is server-generated by our LLM with hard rules
              // against script/style tags. Phase 1: trusted source.
              dangerouslySetInnerHTML={{ __html: brief.summary_html }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Summary pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              The /api/cron/generate step hasn&apos;t produced a summary for this
              brief yet. It runs every 30 minutes during weekday business hours.
            </p>
          </CardContent>
        </Card>
      )}

      {brief.ticker_symbols && brief.ticker_symbols.length > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Tickers mentioned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {brief.ticker_symbols.map((t) => (
                <span
                  key={t}
                  className="text-sm font-mono bg-zinc-100 px-2 py-1 rounded"
                >
                  ${t}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold tracking-tight mb-3">Articles</h2>
        {articles.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No articles linked to this brief.
          </p>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => {
              const stored = outcomesByArticle.get(article.id);
              return (
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
                      {article.published_at
                        ? ` · ${new Date(article.published_at).toLocaleDateString()}`
                        : ""}
                    </p>
                  </CardHeader>
                  <CardContent className={article.summary ? undefined : "pt-0"}>
                    {article.summary ? (
                      <p className="text-sm text-zinc-600 leading-relaxed line-clamp-3 mb-2">
                        {article.summary}
                      </p>
                    ) : null}
                    {/* Outcome bar — auth-gated server-side via RLS; if user
                        is somehow unauthenticated we still render a disabled
                        bar but the RPC will reject. */}
                    {user ? (
                      <ArticleOutcomeBar
                        articleId={article.id}
                        briefId={brief.id}
                        initialOutcome={stored?.outcome ?? "no_action"}
                        initialRating={stored?.rating ?? null}
                        initialUpdatedAt={stored?.updated_at ?? null}
                      />
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {brief.generation_model || brief.prompt_version ? (
        <p className="text-xs text-zinc-400 mt-8 pt-4 border-t">
          Generated by {brief.generation_model ?? "unknown model"} · prompt{" "}
          {brief.prompt_version ?? "unknown"}
        </p>
      ) : null}
    </div>
  );
}
