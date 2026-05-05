import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Health summary of the user's active sources.
 *
 * Shows: how many sources, last fetch time, dead-feed warnings.
 * Drives the user's mental model of "is the pipeline working?"
 *
 * The forgeminds_source_health_daily cron will write replacement
 * suggestions to source_suggestions when a feed is dead — those
 * surface in the SuggestionsPanel above.
 */

interface SourceRow {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  last_fetched_at: string | null;
  error_count: number | null;
  last_error: string | null;
}

interface SourceHealthProps {
  sources: SourceRow[];
  /**
   * Reference timestamp (ms since epoch) for computing freshness. Server
   * component callers pass `Date.now()` at request time; this keeps the
   * client-side render deterministic relative to a known instant.
   */
  nowMs: number;
}

const STALE_THRESHOLD_MS = 1000 * 60 * 60 * 48; // 48 hours

type HealthStatus = "healthy" | "stale" | "errored" | "disabled";

function statusOf(s: SourceRow, nowMs: number): HealthStatus {
  if (!s.is_active) return "disabled";
  if ((s.error_count ?? 0) > 0) return "errored";
  if (s.last_fetched_at) {
    const ageMs = nowMs - Date.parse(s.last_fetched_at);
    if (ageMs > STALE_THRESHOLD_MS) return "stale";
  }
  return "healthy";
}

export function SourceHealth({ sources, nowMs }: SourceHealthProps) {
  if (sources.length === 0) {
    // Empty case is handled by the empty state above; don't double-render.
    return null;
  }

  const counts = {
    healthy: 0,
    stale: 0,
    errored: 0,
    disabled: 0,
  };
  for (const s of sources) counts[statusOf(s, nowMs)] += 1;

  const concerning = sources.filter((s) =>
    ["stale", "errored"].includes(statusOf(s, nowMs))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <HealthChip count={counts.healthy} status="healthy" />
          <HealthChip count={counts.stale} status="stale" />
          <HealthChip count={counts.errored} status="errored" />
          <HealthChip count={counts.disabled} status="disabled" />
        </div>

        {concerning.length > 0 && (
          <ul className="space-y-2 text-sm">
            {concerning.map((s) => {
              const status = statusOf(s, nowMs);
              const ageHours = s.last_fetched_at
                ? Math.floor(
                    (nowMs - Date.parse(s.last_fetched_at)) /
                      (1000 * 60 * 60)
                  )
                : null;
              return (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-medium">{s.name}</span>{" "}
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {s.type}
                    </Badge>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {status === "errored"
                      ? `${s.error_count ?? 0} error${
                          (s.error_count ?? 0) === 1 ? "" : "s"
                        }`
                      : ageHours !== null
                        ? `last fetched ${ageHours}h ago`
                        : "never fetched"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {concerning.length === 0 && (
          <p className="text-sm text-zinc-500">
            All active sources fetched within the last 48 hours.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function HealthChip({
  count,
  status,
}: {
  count: number;
  status: HealthStatus;
}) {
  if (count === 0) return null;
  const color =
    status === "healthy"
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
      : status === "stale"
        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300"
        : status === "errored"
          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
    >
      {count} {status}
    </span>
  );
}
