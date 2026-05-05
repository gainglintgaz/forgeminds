import { IntakeForm } from "@/components/onboarding/intake-form";
import { CatalogLockedState } from "@/components/onboarding/catalog-locked-state";
import { createClient } from "@/lib/supabase/server";

// Server component — re-evaluates per request (catalog count is the
// gate, must reflect current seed state without client-side delay).
export const dynamic = "force-dynamic";

/**
 * /onboarding/intake — first step of the wizard.
 *
 * Intentionally a single textarea instead of a multi-step form. The
 * conversational agent extracts structured intent from free-form text,
 * which is the entire point of Phase 1.5 (VIBE Rule 56: AI-assisted
 * discovery over user configuration).
 *
 * On submit, the form POSTs to /api/onboarding/chat, which:
 *   1. Extracts intent (Claude Haiku, JSON output)
 *   2. Embeds intent + retrieves catalog candidates
 *   3. Asks Claude Sonnet to pick + draft per-source reasons
 *   4. Persists proposals to source_suggestions
 *   5. Returns proposals to the client → router push to /onboarding/refine.
 *
 * Pre-flight LOCKED check: if the catalog has fewer than CATALOG_UNLOCK_MIN
 * active rows, we render a LOCKED state instead of the form (per
 * ai-first-principles.md §6 Data Threshold pattern). This prevents the
 * user from typing a thoughtful intent only to receive 0-3 proposals
 * because the catalog isn't seeded enough yet. Honest "locked" beats
 * fake "we tried our best."
 */

// Below this row count, onboarding RAG returns thin candidate sets +
// the agent's "fewer than 5 unless thin" guard would skip. Set lower
// than the Phase 1.5 close target of >=200 — onboarding can be useful
// at ~50 sources covering >=3 categories. Tune up after seed batches.
const CATALOG_UNLOCK_MIN = 50;
const CATALOG_TARGET = 200;

export default async function OnboardingIntakePage() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("source_catalog")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  // If the catalog query errors (e.g. table doesn't exist yet because
  // migrations weren't applied), treat as "0 rows" → LOCKED. Defensive
  // — the user gets the locked state instead of a broken form.
  const currentCount = error ? 0 : (count ?? 0);

  if (currentCount < CATALOG_UNLOCK_MIN) {
    return (
      <CatalogLockedState
        currentCount={currentCount}
        targetCount={CATALOG_TARGET}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Step indicator="1 of 3" />
      <IntakeForm />
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
        Describe your interests
      </span>
    </div>
  );
}
