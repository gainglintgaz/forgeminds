import { IntakeForm } from "@/components/onboarding/intake-form";

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
 * If no proposals come back (catalog not yet seeded — Phase 1.5 close
 * dependency), the page shows an explanatory empty state instead of
 * silently producing nothing.
 */
export default function OnboardingIntakePage() {
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
