import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { AiOutputMeta } from "@/lib/actions/types";

/**
 * The ONE wrapper every AI-generated text renders inside (ai-native SS4.2 /
 * two-way-traceability.md §4). It shows: model + prompt_version, a clickable link
 * back to the exact source article (title-only when url is null — never a dead link),
 * and a grounding badge. When grounding fails it shows a "Review — N unverified
 * claims" state, NEVER a green badge (fail-closed). `data-ai-generated` is the
 * tripwire marker: AI text rendered outside this wrapper fails review.
 */
export function AiOutputDisclaimer({
  meta,
  children,
}: {
  meta: AiOutputMeta;
  children: ReactNode;
}) {
  const { model, promptVersion, source, grounding } = meta;

  return (
    <div data-ai-generated className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="whitespace-pre-wrap text-sm text-zinc-800 leading-relaxed">{children}</div>

      <div className="mt-3 border-t border-zinc-200 pt-3 space-y-1.5">
        <p className="text-xs text-zinc-500">
          AI-generated · {model} · {promptVersion}
        </p>

        <p className="text-xs text-zinc-500">
          Based on:{" "}
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-700 hover:underline underline-offset-2"
            >
              &ldquo;{source.label}&rdquo; — {source.outlet ?? "Unknown source"}
              {source.published_at ? `, ${formatDate(source.published_at)}` : ""} ↗
            </a>
          ) : (
            <span className="text-zinc-700">
              &ldquo;{source.label}&rdquo; — {source.outlet ?? "Unknown source"}
              {source.published_at ? `, ${formatDate(source.published_at)}` : ""}
            </span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {grounding.passed ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              ✓ Grounded in source
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              ⚠ Review — {grounding.warnings.length} unverified{" "}
              {grounding.warnings.length === 1 ? "claim" : "claims"}
            </Badge>
          )}
        </div>

        {!grounding.passed && grounding.warnings.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
            {grounding.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
