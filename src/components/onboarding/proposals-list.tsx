"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

interface Suggestion {
  id: string;
  catalog_id: string | null;
  name: string;
  description: string;
  url: string;
  type: string;
  paywall_tier: "free" | "freemium" | "paid" | "byos";
  paywall_cost_usd_monthly: number | null;
  reason: string;
  rank_score: number | null;
  status: string;
}

export function ProposalsList({ suggestions }: { suggestions: Suggestion[] }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(suggestions.map((s) => [s.id, true]))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledCount = useMemo(
    () => Object.values(enabled).filter(Boolean).length,
    [enabled]
  );

  const totalMonthlyCost = useMemo(() => {
    return suggestions.reduce((sum, s) => {
      if (!enabled[s.id]) return sum;
      if (s.paywall_tier !== "paid") return sum;
      return sum + (s.paywall_cost_usd_monthly ?? 0);
    }, 0);
  }, [suggestions, enabled]);

  function toggle(id: string) {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleContinue() {
    if (enabledCount === 0) {
      setError("Pick at least one source — leaving everything off means no pipeline runs.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const acceptedCatalogIds = suggestions
        .filter((s) => enabled[s.id] && s.catalog_id)
        .map((s) => s.catalog_id!);

      // Stash the picks in sessionStorage so /confirm can show a
      // summary without re-querying. Real persistence happens when
      // /confirm posts to /api/onboarding/finalize.
      sessionStorage.setItem(
        "onboarding_picks",
        JSON.stringify({ acceptedCatalogIds, totalMonthlyCost })
      );
      router.push("/onboarding/style");
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className="flex items-start gap-4 rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="pt-1">
              <Switch
                checked={enabled[s.id] ?? false}
                onCheckedChange={() => toggle(s.id)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {s.name}
                </h3>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {s.type}
                </Badge>
                <PaywallBadge
                  tier={s.paywall_tier}
                  costMonthly={s.paywall_cost_usd_monthly}
                />
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {s.description}
              </p>
              {s.reason && (
                <p className="text-xs italic text-zinc-500">
                  Why: {s.reason}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-4 flex flex-col gap-3 rounded-md border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-zinc-700 dark:text-zinc-300">
          <span className="font-semibold">{enabledCount}</span> of{" "}
          {suggestions.length} selected
          {totalMonthlyCost > 0 && (
            <span className="ml-2 text-zinc-500">
              · est. ${totalMonthlyCost.toFixed(2)}/mo paid sources
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
          <Button onClick={handleContinue} disabled={submitting} size="lg">
            {submitting ? "Loading…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PaywallBadge({
  tier,
  costMonthly,
}: {
  tier: Suggestion["paywall_tier"];
  costMonthly: number | null;
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
        BYO Subscription
      </Badge>
    );
  }
  // paid
  return (
    <Badge className="text-[10px]">
      Paid{costMonthly !== null ? ` · $${costMonthly.toFixed(2)}/mo` : ""}
    </Badge>
  );
}
