-- Phase 1 actions — the two missing article_id indexes (design doc §5.3).
-- Reverse-traceability ("where did this article end up") queries the four action tables by
-- article_id. action_template_runs(article_id) [template_runs_article_idx] and
-- article_outcomes(article_id) [article_outcomes_article_idx] already exist; only these two are missing.
-- Additive + non-destructive.

create index if not exists content_drafts_article_idx
  on public.content_drafts (article_id);

create index if not exists saved_items_article_idx
  on public.saved_items (article_id);
