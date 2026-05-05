"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Pending source_suggestions for the current user.
 *
 * Suggestions come from:
 *   • Onboarding agent (proposal_source='onboarding_agent')
 *   • Sidebar chat advisor (Phase 1.5+ followup)
 *   • Weekly forgeminds_source_advisor_weekly cron
 *   • Daily forgeminds_source_health_daily cron (replacement for broken feeds)
 *
 * User can: accept (creates `sources` row + marks suggestion accepted),
 * dismiss (marks suggestion dismissed). Updates flow through RLS:
 * users can UPDATE their own rows via policy `source_suggestions_update_own`.
 */

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
  proposal_source: string;
  rank_score: number | null;
  created_at: string;
}

export function SuggestionsPanel() {
  const supabase = createClient();
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("source_suggestions")
        .select(
          "id, catalog_id, name, description, url, type, paywall_tier, paywall_cost_usd_monthly, reason, proposal_source, rank_score, created_at"
        )
        .eq("status", "pending")
        .order("rank_score", { ascending: false, nullsFirst: false })
        .limit(20);
      if (cancelled) return;
      setItems((data ?? []) as Suggestion[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function accept(s: Suggestion) {
    setBusy(s.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: src } = await supabase
        .from("sources")
        .upsert(
          {
            user_id: user.id,
            type: s.type,
            name: s.name,
            url: s.url,
            is_active: true,
            config: {},
          },
          { onConflict: "user_id,type,url", ignoreDuplicates: false }
        )
        .select("id")
        .single();

      if (src) {
        await supabase
          .from("source_suggestions")
          .update({ status: "accepted", resulting_source_id: src.id })
          .eq("id", s.id);
        setItems((prev) => prev?.filter((x) => x.id !== s.id) ?? null);
      }
    } finally {
      setBusy(null);
    }
  }

  async function dismiss(s: Suggestion) {
    setBusy(s.id);
    try {
      await supabase
        .from("source_suggestions")
        .update({ status: "dismissed" })
        .eq("id", s.id);
      setItems((prev) => prev?.filter((x) => x.id !== s.id) ?? null);
    } finally {
      setBusy(null);
    }
  }

  if (items === null) {
    // initial load — render nothing rather than a flash of empty
    return null;
  }

  if (items.length === 0) {
    // No suggestions — don't show this section at all (avoid empty cruft)
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Suggested for you ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map((s) => (
            <li
              key={s.id}
              className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold">{s.name}</h4>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {s.type}
                    </Badge>
                    <PaywallTag
                      tier={s.paywall_tier}
                      cost={s.paywall_cost_usd_monthly}
                    />
                    <span className="text-[10px] text-zinc-500">
                      via {humanize(s.proposal_source)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {s.description}
                  </p>
                  {s.reason && (
                    <p className="text-xs italic text-zinc-500">
                      Why: {s.reason}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    onClick={() => accept(s)}
                    disabled={busy === s.id}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismiss(s)}
                    disabled={busy === s.id}
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PaywallTag({
  tier,
  cost,
}: {
  tier: "free" | "freemium" | "paid" | "byos";
  cost: number | null;
}) {
  if (tier === "paid") {
    return (
      <Badge className="text-[10px]">
        Paid{cost !== null ? ` $${cost.toFixed(2)}/mo` : ""}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px]">
      {tier === "byos" ? "BYO Sub" : tier[0].toUpperCase() + tier.slice(1)}
    </Badge>
  );
}

function humanize(s: string): string {
  return s.replace(/_/g, " ");
}
