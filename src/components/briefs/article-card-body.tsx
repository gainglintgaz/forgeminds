"use client";

import { useState } from "react";
import { ArticleOutcomeBar, type Outcome } from "@/components/briefs/article-outcome-bar";

interface ArticleCardBodyProps {
  articleId: string;
  briefId: string;
  summary: string | null;
  initialOutcome: Outcome;
  initialRating: number | null;
  initialUpdatedAt: string | null;
}

/**
 * Client body for an article card on /briefs/[id]. Owns the dismissed state so a
 * "Dismiss" click visibly collapses the story out of the reading flow (review U-6 /
 * ERR-022: previously Dismiss wrote the outcome row but left the card fully visible —
 * a button that appears to do nothing is dead UI, VIBE Rule 51). The outcome bar stays
 * mounted while collapsed, so un-dismissing is a single tap (Dismiss again toggles it).
 */
export function ArticleCardBody({
  articleId,
  briefId,
  summary,
  initialOutcome,
  initialRating,
  initialUpdatedAt,
}: ArticleCardBodyProps) {
  const [dismissed, setDismissed] = useState(initialOutcome === "dismissed");

  return (
    <>
      {dismissed ? (
        <p className="text-xs italic text-zinc-400 mb-2">
          Dismissed — hidden from your reading flow. Tap Dismiss again to bring it back.
        </p>
      ) : summary ? (
        <p className="text-sm text-zinc-600 leading-relaxed line-clamp-3 mb-2">
          {summary}
        </p>
      ) : null}
      <ArticleOutcomeBar
        articleId={articleId}
        briefId={briefId}
        initialOutcome={initialOutcome}
        initialRating={initialRating}
        initialUpdatedAt={initialUpdatedAt}
        onOutcomeChange={(o) => setDismissed(o === "dismissed")}
      />
    </>
  );
}
