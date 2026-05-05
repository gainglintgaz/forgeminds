"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Browse + filter the public source_catalog. Power users who don't
 * want to go through the conversational onboarding can pick directly.
 *
 * Reads `source_catalog` via the user's auth session (RLS allows
 * authenticated read on is_active=true rows). Empty result =
 * catalog hasn't been seeded yet (Phase 1.5 close dependency).
 */

interface CatalogRow {
  id: string;
  name: string;
  description: string;
  url: string;
  type: string;
  paywall_tier: "free" | "freemium" | "paid" | "byos";
  paywall_cost_usd_monthly: number | null;
  categories: string[] | null;
  recommended_for_topics: string[] | null;
  quality_score: number | null;
}

interface CatalogBrowserProps {
  /** ids the user already has in `sources` — render as "Added" badge. */
  alreadyAddedCatalogIds: string[];
}

export function CatalogBrowser({
  alreadyAddedCatalogIds,
}: CatalogBrowserProps) {
  const supabase = createClient();
  const [rows, setRows] = useState<CatalogRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activePaywallFilter, setActivePaywallFilter] = useState<
    "all" | "free" | "freemium" | "paid"
  >("all");
  const [adding, setAdding] = useState<string | null>(null);
  const addedIds = useMemo(
    () => new Set(alreadyAddedCatalogIds),
    [alreadyAddedCatalogIds]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("source_catalog")
        .select(
          "id, name, description, url, type, paywall_tier, paywall_cost_usd_monthly, categories, recommended_for_topics, quality_score"
        )
        .eq("is_active", true)
        .order("quality_score", { ascending: false, nullsFirst: false })
        .limit(500);
      if (cancelled) return;
      if (error) {
        setLoadError(error.message);
      } else {
        setRows((data ?? []) as CatalogRow[]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        activePaywallFilter !== "all" &&
        r.paywall_tier !== activePaywallFilter
      )
        return false;
      if (!needle) return true;
      const hay =
        r.name.toLowerCase() +
        " " +
        r.description.toLowerCase() +
        " " +
        (r.categories ?? []).join(" ").toLowerCase() +
        " " +
        (r.recommended_for_topics ?? []).join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, search, activePaywallFilter]);

  async function addToSources(row: CatalogRow) {
    setAdding(row.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoadError("Not signed in.");
        return;
      }
      // Direct upsert into sources. Onboarding finalize uses the same
      // (user_id, type, url) conflict target.
      await supabase.from("sources").upsert(
        {
          user_id: user.id,
          type: row.type,
          name: row.name,
          url: row.url,
          is_active: true,
          config: {},
        },
        { onConflict: "user_id,type,url", ignoreDuplicates: false }
      );
    } finally {
      setAdding(null);
    }
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn&apos;t load the catalog</AlertTitle>
        <AlertDescription>{loadError}</AlertDescription>
      </Alert>
    );
  }

  if (rows === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <Alert>
        <AlertTitle>Catalog not seeded yet</AlertTitle>
        <AlertDescription>
          The source catalog is empty. Phase 1.5 catalog seeding is in
          progress — once curated sources are loaded, you&apos;ll see them
          here. Until then, use the &quot;Add custom URL&quot; section
          below or run the onboarding wizard.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by name, topic, or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <div className="flex items-center gap-1">
          {(["all", "free", "freemium", "paid"] as const).map((tier) => (
            <Button
              key={tier}
              size="sm"
              variant={activePaywallFilter === tier ? "default" : "ghost"}
              onClick={() => setActivePaywallFilter(tier)}
            >
              {tier === "all" ? "All" : tier[0].toUpperCase() + tier.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        {filtered.length} of {rows.length} source{rows.length === 1 ? "" : "s"}
      </p>

      <ul className="space-y-2">
        {filtered.slice(0, 50).map((r) => {
          const isAdded = addedIds.has(r.id);
          return (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {r.name}
                  </h4>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {r.type}
                  </Badge>
                  <PaywallTag
                    tier={r.paywall_tier}
                    cost={r.paywall_cost_usd_monthly}
                  />
                  {typeof r.quality_score === "number" && (
                    <span className="text-[10px] text-zinc-500">
                      q={r.quality_score.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {r.description}
                </p>
              </div>
              <Button
                size="sm"
                variant={isAdded ? "secondary" : "default"}
                disabled={isAdded || adding === r.id}
                onClick={() => addToSources(r)}
              >
                {isAdded ? "Added" : adding === r.id ? "Adding…" : "Add"}
              </Button>
            </li>
          );
        })}
      </ul>

      {filtered.length > 50 && (
        <p className="text-center text-xs text-zinc-500">
          Showing top 50. Refine the search to see more.
        </p>
      )}
    </div>
  );
}

function PaywallTag({
  tier,
  cost,
}: {
  tier: "free" | "freemium" | "paid" | "byos";
  cost: number | null;
}) {
  if (tier === "free") {
    return (
      <Badge variant="secondary" className="text-[10px]">
        Free
      </Badge>
    );
  }
  if (tier === "freemium") {
    return (
      <Badge variant="secondary" className="text-[10px]">
        Freemium
      </Badge>
    );
  }
  if (tier === "byos") {
    return (
      <Badge variant="outline" className="text-[10px]">
        BYO Sub
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px]">
      Paid{cost !== null ? ` $${cost.toFixed(2)}/mo` : ""}
    </Badge>
  );
}
