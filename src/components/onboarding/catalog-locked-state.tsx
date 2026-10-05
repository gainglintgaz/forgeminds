import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * LOCKED-state empty render for /onboarding/intake when the source
 * catalog isn't seeded enough yet to produce a useful onboarding run.
 *
 * Per .claude/rules/reference/ai-first-principles.md §6 Data Threshold pattern:
 *   - Proves the feature exists (no vaporware feel)
 *   - Tells user exactly what unlocks it
 *   - Invites the next step
 *   - Codifies honesty
 *
 * Rendered when source_catalog row count < THRESHOLD. With <50 rows
 * the onboarding agent's catalog RAG would return mostly-empty
 * candidate sets, leading to <5 proposals — which is below the
 * "fewer than 5 unless the candidate list is genuinely thin" guard
 * in src/lib/onboarding/agent.ts.
 *
 * The threshold is intentionally lower than the Phase 1.5 close
 * target of ≥200 entries — onboarding can produce useful runs at
 * ~50 sources spanning ≥3 categories, even if the full ≥200 / ≥10
 * is the close target.
 */

interface CatalogLockedStateProps {
  currentCount: number;
  targetCount: number;
}

export function CatalogLockedState({
  currentCount,
  targetCount,
}: CatalogLockedStateProps) {
  const pct = Math.min(100, Math.round((currentCount / targetCount) * 100));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
          1 of 3
        </span>
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          Onboarding pending catalog seed
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span aria-hidden="true">🔒</span>
            <span>AI-assisted source discovery</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-zinc-700 dark:text-zinc-300">
            We&apos;re still curating the source catalog the AI advisor matches
            your interests against. The conversational onboarding agent unlocks
            once enough verified sources are loaded.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                {currentCount} of {targetCount} sources curated
              </span>
              <span>{pct}%</span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-zinc-900 dark:bg-zinc-50 transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <p className="font-medium text-zinc-700 dark:text-zinc-300">
              Why this is locked
            </p>
            <p className="mt-1">
              Per the AI-First contract, we don&apos;t ship a half-empty
              catalog and let the AI fill in what&apos;s missing. Locked state
              with honest copy beats fake personalization. See{" "}
              <code className="rounded bg-zinc-200 px-1 py-0.5 text-[10px] font-mono dark:bg-zinc-800">
                .claude/rules/reference/ai-first-principles.md
              </code>{" "}
              §6.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href="/sources"
              className="text-xs underline-offset-2 hover:underline text-zinc-700 dark:text-zinc-300"
            >
              Add custom URLs (power-user fallback) →
            </Link>
            <Link
              href="/dashboard"
              className="text-xs underline-offset-2 hover:underline text-zinc-700 dark:text-zinc-300"
            >
              Back to dashboard →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
