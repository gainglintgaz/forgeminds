import { ArticleCard } from "./article-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Article shape mirrors the canonical raw_articles schema columns this view
// reads: id, title, summary (not description), url, source_name, published_at.
// Entity badges return in Phase 1 once scored_articles is wired into the feed.
interface Article {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  source_name: string | null;
  published_at: string | null;
}

interface ArticleFeedProps {
  articles: Article[];
  loading?: boolean;
}

export function ArticleFeed({ articles, loading }: ArticleFeedProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/4 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No articles yet</CardTitle>
          <CardDescription>
            Your intelligence feed will populate once the pipeline runs.
            Configure your sources to get started.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          articleId={article.id}
          title={article.title}
          summary={article.summary || ""}
          url={article.url || "#"}
          sourceName={article.source_name || "Unknown"}
          publishedAt={article.published_at || new Date().toISOString()}
        />
      ))}
    </div>
  );
}
