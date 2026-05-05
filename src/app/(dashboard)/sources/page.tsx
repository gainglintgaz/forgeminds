import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SourceList } from "@/components/sources/source-list";
import { CatalogBrowser } from "@/components/sources/catalog-browser";
import { SuggestionsPanel } from "@/components/sources/suggestions-panel";
import { SourceHealth } from "@/components/sources/source-health";
import { AddSourceDialog } from "@/components/sources/add-source-dialog";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

/**
 * /sources — Phase-1.5 redesign.
 *
 * Layout (top to bottom):
 *
 *   1. Header + "Open onboarding wizard" CTA (primary action)
 *   2. SuggestionsPanel — pending source_suggestions for this user
 *      (rendered only if there are any; auto-hidden when empty)
 *   3. SourceHealth — quick view of fetch status across active sources
 *   4. Active sources list (existing SourceList component)
 *   5. Catalog browser — power user search / filter / add
 *   6. "Add custom URL" — fallback for sources not in the catalog
 *      (validated server-side via /api/onboarding/validate-source)
 *
 * Per VIBE Rule 56 (AI-Assisted Discovery Over User Configuration),
 * the conversational onboarding wizard is the FIRST-CLASS path.
 * Browser + custom URL are power-user fallbacks at the bottom.
 */
export default async function SourcesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sources } = await supabase
    .from("sources")
    .select(
      "id, type, name, url, is_active, last_fetched_at, error_count, last_error, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const sourceList = sources ?? [];

  // To mark "already added" in the CatalogBrowser, we need the catalog
  // ids that map to existing sources. We don't store catalog_id on the
  // sources table (it's a runtime relationship via url match), so we
  // approximate: any source whose url matches a catalog entry counts.
  // For now, just pass an empty list — the catalog browser will work
  // without "already added" badges. Phase 1.5 close adds a denormalized
  // `sources.catalog_id` column for reliable matching.
  const alreadyAddedCatalogIds: string[] = [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Tell the AI advisor what you want to follow, or pick from the
            catalog directly.
          </p>
        </div>
        <Link href="/onboarding/intake" className={buttonVariants()}>
          Talk to advisor
        </Link>
      </div>

      {/* AI suggestions (auto-hides when empty) */}
      <SuggestionsPanel />

      {/* Health summary (auto-hides when no sources). nowMs captured at
          request-time so staleness checks are deterministic against the
          server's clock, not the client's. Server components re-render
          per request, so this is the canonical place to call Date.now(). */}
      {/* eslint-disable-next-line react-hooks/purity */}
      <SourceHealth sources={sourceList} nowMs={Date.now()} />

      {/* Active sources */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Your sources ({sourceList.length})
        </h2>
        <SourceList sources={sourceList} />
      </section>

      <Separator />

      {/* Catalog browser */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Browse the catalog
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Power-user view. The advisor (above) usually picks better — but
            search if you know what you want.
          </p>
        </div>
        <CatalogBrowser alreadyAddedCatalogIds={alreadyAddedCatalogIds} />
      </section>

      <Separator />

      {/* Custom URL fallback */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Add a custom URL
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Have a feed not in the catalog? Paste the URL — we&apos;ll
            validate it before adding.
          </p>
        </div>
        <AddSourceDialog />
      </section>
    </div>
  );
}
