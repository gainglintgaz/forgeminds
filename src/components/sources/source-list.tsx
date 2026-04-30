"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

// Source shape mirrors canonical schema columns the page selects: is_active
// (not enabled), last_fetched_at (not last_fetch_at), error_count + last_error
// (we derive health from these — the schema has no literal health_status).
interface Source {
  id: string;
  type: string;
  name: string;
  url: string | null;
  is_active: boolean;
  last_fetched_at: string | null;
  error_count: number | null;
  last_error: string | null;
}

interface SourceListProps {
  sources: Source[];
}

type Health = "healthy" | "degraded" | "failing";

function healthOf(s: Pick<Source, "error_count" | "last_error">): Health {
  const errs = s.error_count ?? 0;
  if (errs === 0) return "healthy";
  if (errs < 3) return "degraded";
  return "failing";
}

export function SourceList({ sources }: SourceListProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function toggleSource(sourceId: string, currentIsActive: boolean) {
    setLoading(sourceId);
    await supabase
      .from("sources")
      .update({ is_active: !currentIsActive })
      .eq("id", sourceId);
    setLoading(null);
    router.refresh();
  }

  async function deleteSource(sourceId: string) {
    setLoading(sourceId);
    await supabase.from("sources").delete().eq("id", sourceId);
    setLoading(null);
    router.refresh();
  }

  if (sources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No sources configured</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            Add RSS feeds or enable API sources to start receiving articles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((source) => {
        const health = healthOf(source);
        return (
          <Card key={source.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <Badge variant={source.is_active ? "default" : "secondary"}>
                  {source.type}
                </Badge>
                <div>
                  <p className="text-sm font-medium">{source.name}</p>
                  {source.url && (
                    <p className="text-xs text-zinc-500 truncate max-w-xs">{source.url}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    health === "healthy"
                      ? "text-green-600"
                      : health === "degraded"
                        ? "text-yellow-600"
                        : "text-red-600"
                  }
                  title={source.last_error ?? undefined}
                >
                  {health}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loading === source.id}
                  onClick={() => toggleSource(source.id, source.is_active)}
                >
                  {source.is_active ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={loading === source.id}
                  onClick={() => deleteSource(source.id)}
                >
                  Remove
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
