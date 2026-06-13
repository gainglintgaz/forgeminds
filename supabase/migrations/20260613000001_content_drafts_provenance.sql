-- Phase 1 actions — Draft Post provenance bag (design doc §5.2).
-- content_drafts has no jsonb column; Draft needs one additive bag carrying
-- { params: {...resolved config...}, sources: [...] } (the "what settings + which source
-- produced this" audit trait — two-way-traceability.md). ONE bag, not two overlapping columns.
-- Additive + non-destructive.

alter table public.content_drafts
  add column if not exists provenance jsonb not null default '{}'::jsonb;

comment on column public.content_drafts.provenance is
  'Phase 1: { params: <resolved draft config>, sources: [{type:''article'',id,label,url,published_at,outlet}] }. Forward-traceability spine alongside the article_id FK.';
