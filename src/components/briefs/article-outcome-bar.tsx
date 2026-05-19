"use client";

import { useState, useTransition } from "react";
import {
  BookmarkIcon,
  BookmarkCheckIcon,
  XIcon,
  StarIcon,
  CheckCircle2Icon,
  InfoIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Article outcome bar — save / dismiss / took action / 1-5 star rating.
 *
 * Renders as a footer row inside an article Card on /briefs/[id].
 * Calls the `upsert_article_outcome` RPC defined in
 * `supabase/migrations/20260516000000_phase2_kickoff.sql` and extended
 * in `20260518100001_outcome_rpc_compliance_log.sql` which:
 *   1. Upserts the per-(user, article) row in `article_outcomes`
 *   2. Mirrors the click into the `behavioral_events` event stream
 *   3. Appends a row to `compliance_audit_log` with event_type='outcome_logged'
 *
 * All three writes happen atomically server-side. The client makes one
 * round-trip per click.
 *
 * Initial state comes from the parent server component which pre-loads
 * the user's existing outcomes for these articles in a single
 * `.in()` query — so first paint shows correct icon state.
 *
 * Architecture follows the universal pattern from
 * `.claude/rules/reference/data-flywheel.md` §3 (Outcomes table) + §5
 * (Contribution UX flow), with the four-trait provenance contract from
 * `.claude/rules/data-citizenship.md` (the ⓘ tooltip exposes
 * source / derivation / destinations / provenance to the user).
 */

export type Outcome = "saved" | "dismissed" | "no_action" | "action_taken";

interface ArticleOutcomeBarProps {
  articleId: string;
  briefId: string;
  initialOutcome: Outcome;
  initialRating: number | null;
  initialUpdatedAt?: string | null;
}

export function ArticleOutcomeBar({
  articleId,
  briefId,
  initialOutcome,
  initialRating,
  initialUpdatedAt = null,
}: ArticleOutcomeBarProps) {
  const [outcome, setOutcome] = useState<Outcome>(initialOutcome);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  function call(nextOutcome: Outcome, nextRating: number | null = null) {
    // Capture pre-click state to revert on RPC failure (Bridge Brief §3
    // failure mode 5: RLS denial; failure mode 6: network down mid-write).
    const prevOutcome = outcome;
    const prevRating = rating;
    const prevUpdatedAt = updatedAt;

    // Optimistic flip — gives the user a visible response in <100ms
    // independent of round-trip latency (Bridge Brief Job-to-be-Done
    // success criterion: "click visibly persists").
    setOutcome(nextOutcome);
    if (nextRating !== null) setRating(nextRating);
    setError(null);

    startTransition(async () => {
      const { error: rpcError } = await supabase.rpc(
        "upsert_article_outcome",
        {
          p_article_id: articleId,
          p_brief_id: briefId,
          p_outcome: nextOutcome,
          p_rating: nextRating,
        }
      );
      if (rpcError) {
        // Revert per VIBE Rule 52 — no silent failure. Surface inline
        // (no toast) per the prompt's friction floor.
        console.error("[outcome-bar] rpc failed", {
          articleId,
          outcome: nextOutcome,
          err: rpcError.message,
        });
        setOutcome(prevOutcome);
        setRating(prevRating);
        setUpdatedAt(prevUpdatedAt);
        setError(`Couldn't save — ${rpcError.message}`);
        return;
      }
      // RPC succeeded — record the click time for the ⓘ tooltip.
      setUpdatedAt(new Date().toISOString());
    });
  }

  const isSaved = outcome === "saved";
  const isDismissed = outcome === "dismissed";
  const isActed = outcome === "action_taken";

  return (
    <div
      className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800"
      aria-busy={pending}
    >
      <Button
        size="sm"
        variant={isSaved ? "default" : "ghost"}
        disabled={pending}
        onClick={() => call(isSaved ? "no_action" : "saved")}
        aria-pressed={isSaved}
      >
        {isSaved ? (
          <BookmarkCheckIcon className="size-4" />
        ) : (
          <BookmarkIcon className="size-4" />
        )}
        <span className="ml-1.5">{isSaved ? "Saved" : "Save"}</span>
      </Button>

      <Button
        size="sm"
        variant={isDismissed ? "destructive" : "ghost"}
        disabled={pending}
        onClick={() => call(isDismissed ? "no_action" : "dismissed")}
        aria-pressed={isDismissed}
      >
        <XIcon className="size-4" />
        <span className="ml-1.5">{isDismissed ? "Dismissed" : "Dismiss"}</span>
      </Button>

      <Button
        size="sm"
        variant={isActed ? "default" : "ghost"}
        disabled={pending}
        onClick={() => call(isActed ? "no_action" : "action_taken")}
        aria-pressed={isActed}
        title="I took action on this story (made a trade, wrote a draft, sent a note)"
      >
        <CheckCircle2Icon className="size-4" />
        <span className="ml-1.5">{isActed ? "Acted" : "Took action"}</span>
      </Button>

      <div
        className="ml-auto flex items-center gap-0.5"
        role="group"
        aria-label="Rate this article"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            onClick={() =>
              call(outcome === "no_action" ? "saved" : outcome, n)
            }
            className="p-0.5 rounded transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            aria-label={`Rate ${n} of 5`}
            aria-pressed={rating !== null && n <= rating}
          >
            <StarIcon
              className={`size-3.5 ${
                rating !== null && n <= rating
                  ? "fill-amber-400 text-amber-500"
                  : "text-zinc-300 dark:text-zinc-600"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Provenance ⓘ affordance per Bridge Brief §5 Data Citizenship.
          Hover/tap reveals: who (you), when, what (action), via what
          (RPC) — the four traits from .claude/rules/data-citizenship.md
          mapped to the outcome row. */}
      <OutcomeProvenanceChip
        outcome={outcome}
        rating={rating}
        updatedAt={updatedAt}
      />

      {error && (
        <p
          className="basis-full text-xs text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Per-row Provenance affordance. Renders a small ⓘ that opens a tooltip
 * describing the source row + write path. The four citizenship traits:
 *   - Source:       this user's click (article_outcomes row)
 *   - Derivation:   identity (outcome value displayed directly)
 *   - Destinations: this bar + behavioral_events mirror + audit log +
 *                   future Voice DNA / scoring weights
 *   - Provenance:   the timestamp when the user last changed the state
 */
function OutcomeProvenanceChip({
  outcome,
  rating,
  updatedAt,
}: {
  outcome: Outcome;
  rating: number | null;
  updatedAt: string | null;
}) {
  if (outcome === "no_action" && rating === null) return null;

  const label = (() => {
    if (outcome === "saved") return "Saved";
    if (outcome === "dismissed") return "Dismissed";
    if (outcome === "action_taken") return "Acted on";
    if (rating !== null) return `Rated ${rating}/5`;
    return "Captured";
  })();

  const when = updatedAt
    ? `on ${new Date(updatedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "(captured this session)";

  const tooltip = [
    `${label} by you ${when}`,
    "",
    "Source:       your click — stored in article_outcomes",
    "Destinations: this bar · behavioral_events · compliance_audit_log",
    "              · future Voice DNA training (Phase 2.5)",
  ].join("\n");

  return (
    <span
      className="ml-1 inline-flex items-center"
      title={tooltip}
      aria-label="Provenance"
    >
      <InfoIcon className="size-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" />
    </span>
  );
}
