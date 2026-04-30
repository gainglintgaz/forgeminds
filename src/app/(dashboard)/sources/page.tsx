import { createClient } from "@/lib/supabase/server";
import { SourceList } from "@/components/sources/source-list";
import { AddSourceDialog } from "@/components/sources/add-source-dialog";

export default async function SourcesPage() {
  const supabase = await createClient();

  // Canonical sources columns: is_active (not enabled), last_fetched_at (not
  // last_fetch_at). health_status is derived from error_count + last_error
  // since the schema doesn't carry a literal column.
  const { data: sources } = await supabase
    .from("sources")
    .select("id, type, name, url, is_active, last_fetched_at, error_count, last_error")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
        <AddSourceDialog />
      </div>
      <SourceList sources={sources || []} />
    </div>
  );
}
