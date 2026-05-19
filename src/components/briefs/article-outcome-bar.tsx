"use client";

import { useState, useTransition } from "react";
import { BookmarkIcon, BookmarkCheckIcon, XIcon, StarIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Article outcome bar — save / dismiss / 1-5 star rating per article.
 *
 * Renders as a footer row inside an article Card on /briefs/[id].
 * Calls the `upsert_article_outcome` RPC defined in
 * `supabase/migrations/20260601000000_article_outcomes.sql` (Phase 2
 * prep) which:
 *   1. Upserts the per-(user, article) row in `article_outcomes`
 *   2. Mirrors the click into the `behavioral_events` event stream
 *
 * Both actions happen atomically server-side. The client makes one
 * round-trip per click.
 *
 * Initial state comes from the parent server component which pre-loads
 * the user's existing outcomes for these articles in a single
 * `.in()` query — so first paint shows correct icon state.
 *
 * Architecture follows the universal pattern from
 * `.claude/rules/reference/data-flywheel.md` §3 (Outcomes table) + §5
 * (Contribution UX flow).
 */

export type Outcome = "saved" | "dismissed" | "no_action" | "action_taken";

interface ArticleOutcomeBarProps {
  articleId: string;
  briefId: string;
  initialOutcome: Outcome;
  initialRating: number | null;
}

export function ArticleOutcomeBar({
  articleId,
  briefId,
  initialOutcome,
  initialRating,
}: ArticleOutcomeBarProps) {
  const [outcome, setOutcome] = useState<Outcome>(initialOutcome);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  function call(nextOutcome: Outcome, nextRating: number | null = null) {
    startTransition(async () => {
      setError(null);
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
        setError(rpcError.message);
        return;
      }
      setOutcome(nextOutcome);
      if (nextRating !== null) setRating(nextRating);
    });
  }

  const isSaved = outcome === "saved";
  const isDismissed = outcome === "dismissed";

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

      {error && (
        <p className="basis-full text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
