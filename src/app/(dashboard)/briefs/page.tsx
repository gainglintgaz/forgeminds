import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const revalidate = 60;

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

interface BriefRow {
  id: string;
  title: string;
  brief_date: string;
  brief_type: string;
  article_count: number | null;
  ticker_symbols: string[] | null;
  categories_covered: string[] | null;
  is_delivered: boolean;
  delivered_at: string | null;
  created_at: string;
  summary_html: string | null;
}

export default async function BriefsPage() {
  const supabase = await createClient();

  // Phase 1: read system briefs (single-tenant pipeline). Phase 2 will switch
  // to per-user briefs scoped via .eq("user_id", auth.uid()) in the query.
  const { data: briefs } = await supabase
    .from("briefs")
    .select(
      "id, title, brief_date, brief_type, article_count, ticker_symbols, categories_covered, is_delivered, delivered_at, created_at, summary_html"
    )
    .eq("user_id", SYSTEM_USER_ID)
    .order("brief_date", { ascending: false })
    .limit(30);

  const rows = (briefs ?? []) as BriefRow[];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Briefs</h1>
          <p className="text-sm text-zinc-500">
            Daily intelligence digests from your sources.
          </p>
        </div>
        <span className="text-sm text-zinc-500">
          {rows.length} {rows.length === 1 ? "brief" : "briefs"}
        </span>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No briefs yet</CardTitle>
            <CardDescription>
              Briefs are generated automatically by the pipeline once articles
              are scored and curated. If you just configured sources, your
              first brief should appear within an hour.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((brief) => (
            <Link key={brief.id} href={`/briefs/${brief.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-base">{brief.title}</CardTitle>
                      <p className="text-xs text-zinc-500 mt-1">
                        {brief.brief_date} ·{" "}
                        {brief.article_count ?? 0}{" "}
                        {brief.article_count === 1 ? "story" : "stories"}
                        {brief.categories_covered && brief.categories_covered.length > 0
                          ? ` · ${brief.categories_covered.slice(0, 3).join(", ")}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {brief.summary_html ? null : (
                        <Badge variant="secondary" className="text-xs">Pending</Badge>
                      )}
                      {brief.is_delivered ? (
                        <Badge variant="outline" className="text-xs">Delivered</Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                {brief.ticker_symbols && brief.ticker_symbols.length > 0 ? (
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1">
                      {brief.ticker_symbols.slice(0, 8).map((t) => (
                        <span
                          key={t}
                          className="text-xs font-mono bg-zinc-100 px-1.5 py-0.5 rounded"
                        >
                          ${t}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
