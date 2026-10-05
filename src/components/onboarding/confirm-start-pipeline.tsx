"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface StashedPicks {
  acceptedCatalogIds: string[];
  totalMonthlyCost?: number;
}

interface FinalizeResponse {
  sourcesCreated: number;
  sourcesAlreadyExisted: number;
  preferencesUpdated: boolean;
  sourceIds: string[];
}

export function ConfirmStartPipeline({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [picks, setPicks] = useState<StashedPicks | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // sessionStorage is browser-only; we deliberately defer its read
    // until after mount to avoid SSR hydration mismatch. This setState
    // is the correct pattern for "subscribe to an external store on
    // mount" — eslint's react-hooks/set-state-in-effect rule has a
    // documented exception for first-mount external-store reads.
    try {
      const raw = sessionStorage.getItem("onboarding_picks");
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPicks(JSON.parse(raw) as StashedPicks);
      }
    } catch {
      // sessionStorage unavailable or malformed — fall through to "no picks"
      setPicks(null);
    }
  }, []);

  const acceptedCount = picks?.acceptedCatalogIds.length ?? 0;
  const cost = picks?.totalMonthlyCost ?? 0;

  async function handleFinalize() {
    if (!picks || picks.acceptedCatalogIds.length === 0) {
      setError("No sources selected. Go back to /onboarding/refine to pick.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptedCatalogIds: picks.acceptedCatalogIds }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? `Server returned ${response.status}`);
        setSubmitting(false);
        return;
      }

      const data = (await response.json()) as FinalizeResponse;
      sessionStorage.removeItem("onboarding_picks");

      // Hand off to the dashboard. The dispatcher will pick up the
      // user's new sources on the next per-step tick.
      const params = new URLSearchParams({
        from: "onboarding",
        created: String(data.sourcesCreated),
      });
      router.push(`/dashboard?${params.toString()}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-zinc-200 bg-white p-6 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-1">
          <p className="text-zinc-700 dark:text-zinc-300">
            <span className="font-semibold">{acceptedCount}</span> source
            {acceptedCount === 1 ? "" : "s"} ready to start.
          </p>
          {cost > 0 && (
            <p className="text-zinc-500">
              Estimated paid-source cost:{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                ${cost.toFixed(2)}/mo
              </span>
            </p>
          )}
          {pendingCount > 0 && (
            <p className="text-xs text-zinc-500">
              {pendingCount - acceptedCount} other proposals will stay parked in
              your suggestions for later.
            </p>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t start the pipeline</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/onboarding/refine")}
          disabled={submitting}
        >
          ← Back
        </Button>
        <Button
          onClick={handleFinalize}
          disabled={submitting || acceptedCount === 0}
          size="lg"
        >
          {submitting ? "Starting…" : "Start my pipeline"}
        </Button>
      </div>
    </div>
  );
}
