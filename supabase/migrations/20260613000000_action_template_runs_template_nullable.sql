-- Phase 1 actions — load-bearing migration (design doc §5.1, docs/architecture/full-os-phase-1-actions.md).
-- Analyze writes an action_template_runs row with template_id = NULL (the run is driven by a
-- user-selected lens, not a seeded action_templates row — those are the Phase-2 auto-suggest engine).
-- The column is currently NOT NULL, so every Analyze insert would fail without this.
-- Additive + non-destructive (relaxes a constraint; no data loss). No [approved-destructive] needed.

alter table public.action_template_runs
  alter column template_id drop not null;

-- Optional tag so reverse-traceability can filter "analyze" runs without parsing resolved_data.
alter table public.action_template_runs
  add column if not exists action text;

comment on column public.action_template_runs.template_id is
  'Nullable since Phase 1: user-lens Analyze runs have no seeded template. Phase-2 auto-suggest sets it.';
comment on column public.action_template_runs.action is
  'Phase 1: tags the run kind (e.g. ''analyze'') for reverse-traceability filtering. Null for legacy/template runs.';
