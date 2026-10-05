-- Phase 1 actions — Act / Hand-to-AI config bag (design doc §R2.3).
-- The 4th action persists into action_plans (title + rationale + steps[]). It needs one additive
-- bag for { flavor, target, params, sources:[...] } — mirrors content_drafts.provenance.
-- Additive + non-destructive.

alter table public.action_plans
  add column if not exists config jsonb not null default '{}'::jsonb;

comment on column public.action_plans.config is
  'Phase 1 Act: { flavor: research|plan|draft_brief|code_kickoff, target, params, sources:[...] }. Forward-traceability spine alongside article_id.';
