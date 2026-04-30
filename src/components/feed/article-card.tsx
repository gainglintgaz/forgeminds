import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "./source-badge";

// Renamed `description` → `summary` to match the canonical raw_articles
// column name. UI-side prop is now schema-aligned end-to-end.
interface ArticleCardProps {
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  category?: string;
  entitySymbols?: string[];
}

export function ArticleCard({
  title,
  summary,
  url,
  sourceName,
  publishedAt,
  category,
  entitySymbols,
}: ArticleCardProps) {
  const timeAgo = getTimeAgo(publishedAt);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-medium tracking-tight hover:underline underline-offset-4 leading-snug"
            >
              {title}
            </a>
            <div className="flex items-center gap-2 mt-2">
              <SourceBadge source={sourceName} />
              {category && (
                <span className="text-xs text-zinc-500">{category}</span>
              )}
              <span className="text-xs text-zinc-400">{timeAgo}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-zinc-600 leading-relaxed line-clamp-3">
          {summary}
        </p>
        {entitySymbols && entitySymbols.length > 0 && (
          <div className="flex gap-1 mt-3">
            {entitySymbols.map((symbol) => (
              <span
                key={symbol}
                className="text-xs font-mono bg-zinc-100 px-1.5 py-0.5 rounded"
              >
                ${symbol}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <Button size="sm" variant="outline" disabled>
            Save to Brain
          </Button>
          <Button size="sm" variant="outline" disabled>
            Analyze
          </Button>
          <Button size="sm" variant="outline" disabled>
            Draft Post
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
