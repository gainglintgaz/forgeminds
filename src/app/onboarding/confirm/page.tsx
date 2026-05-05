import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfirmStartPipeline } from "@/components/onboarding/confirm-start-pipeline";

/**
 * /onboarding/confirm — final step.
 *
 * Loads the user's pending suggestions (matching what /refine
 * displayed) so we can render a final summary even if the user
 * navigated away and back. The Continue button on this page POSTs to
 * /api/onboarding/finalize, which:
 *   - Inserts a row in `sources` per accepted catalog id
 *   - Marks each accepted source_suggestions row as status='accepted'
 *   - Updates user_preferences (cadence/density) from the extracted intent
 *   - Returns the user to /dashboard
 */
export default async function OnboardingConfirmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: suggestions } = await supabase
    .from("source_suggestions")
    .select("id, catalog_id, name, paywall_tier, paywall_cost_usd_monthly")
    .eq("user_id", user.id)
    .eq("status", "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
          3 of 3
        </span>
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          Confirm + start
        </span>
      </div>
      <ConfirmStartPipeline pendingCount={suggestions?.length ?? 0} />
    </div>
  );
}
