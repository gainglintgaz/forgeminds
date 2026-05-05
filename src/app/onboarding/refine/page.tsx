import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProposalsList } from "@/components/onboarding/proposals-list";

interface SuggestionRow {
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

/**
 * /onboarding/refine — second step.
 *
 * Loads pending source_suggestions for the current user (set by the
 * /api/onboarding/chat call from /intake). Each card shows: name,
 * description, agent's reason, paywall cost (if any). User toggles
 * each on/off, optionally types feedback for a re-propose.
 *
 * Submit advances to /onboarding/confirm.
 */
export default async function OnboardingRefinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load pending suggestions. Only ones that haven't been accepted/
  // dismissed yet.
  const { data: suggestions, error } = await supabase
    .from("source_suggestions")
    .select(
      "id, catalog_id, name, description, url, type, paywall_tier, paywall_cost_usd_monthly, reason, rank_score, status"
    )
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("rank_score", { ascending: false, nullsFirst: false });

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        Couldn&apos;t load proposals: {error.message}
      </div>
    );
  }

  const rows = (suggestions ?? []) as SuggestionRow[];

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <Step indicator="2 of 3" />
        <div className="rounded-md border border-zinc-200 bg-white p-6 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <p className="font-medium">No proposals yet.</p>
          <p className="mt-1 text-zinc-500">
            Either you skipped intake or the catalog isn&apos;t seeded yet.{" "}
            <a
              href="/onboarding/intake"
              className="underline underline-offset-2 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Start over →
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Step indicator="2 of 3" />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        I picked {rows.length} sources from the catalog based on what you said.
        Toggle off the ones you don&apos;t want, then continue.
      </p>
      <ProposalsList suggestions={rows} />
    </div>
  );
}

function Step({ indicator }: { indicator: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
        {indicator}
      </span>
      <span className="text-xs uppercase tracking-wide text-zinc-500">
        Review proposals
      </span>
    </div>
  );
}
