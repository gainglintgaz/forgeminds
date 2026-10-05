/**
 * Build the traceable source spine for an AI output from one raw_articles row.
 * Single-source confinement (design doc §4): the model sees ONLY this article.
 */
import type { ActionArticle, SourceRef } from "./types";

/** The sources[] entry persisted on the run/draft/plan row. */
export function buildArticleSource(a: ActionArticle): SourceRef {
  return {
    type: "article",
    id: a.id,
    label: a.title,
    url: a.url, // may be null — the disclaimer renders title-only, never a dead link
    published_at: a.published_at,
    outlet: a.source_name,
  };
}

/** The text the deterministic grounding check verifies the output against. */
export function articleGroundingText(a: ActionArticle): string {
  return [a.title, a.full_text ?? a.summary ?? ""].filter(Boolean).join("\n\n");
}

/** The single-article body handed to the model. full_text is richer than summary for grounding. */
export function articlePromptBody(a: ActionArticle): string {
  const body = a.full_text ?? a.summary ?? "(no article body available)";
  return [
    `TITLE: ${a.title}`,
    `SOURCE: ${a.source_name ?? "Unknown source"}`,
    `URL: ${a.url ?? "(none)"}`,
    a.published_at ? `PUBLISHED: ${a.published_at}` : null,
    "",
    "ARTICLE:",
    body,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
