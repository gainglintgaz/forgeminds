-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — User Style Anchors (Voice DNA capture, Phase 2.B)
-- ════════════════════════════════════════════════════════════════════
-- Adds Voice DNA inputs to user_preferences: which writers / blogs the
-- user wants briefs to READ LIKE, plus tone + density preferences.
-- Future enhancement (deferred): fetch sample text from anchor URLs via
-- Jina Reader + cache per-anchor for richer style transfer. This
-- migration only stores the names + meta the brief prompt uses today.
--
-- All four additions are nullable / default-empty — online ALTER per
-- migration-strategy.md §3 (ADD COLUMN ... NULL with no/literal default
-- is instant in Postgres ≥11).
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. style_anchors — JSONB array of {name, url?, why?, captured_at}
alter table public.user_preferences
  add column if not exists style_anchors jsonb not null default '[]'::jsonb;

comment on column public.user_preferences.style_anchors is
  'Array of style anchor objects: {name: string, url?: string, why?: string, captured_at: timestamptz}. User-declared writers / blogs / publications whose voice the brief should emulate. Read by src/lib/ai/prompts/generate-brief — feeds the style prefix on Claude Haiku.';

-- ─── 2. style_tone — bounded enum-via-CHECK
alter table public.user_preferences
  add column if not exists style_tone text
    check (style_tone is null or style_tone in
      ('concise', 'analytical', 'conversational', 'academic', 'investigative'));

comment on column public.user_preferences.style_tone is
  'User preferred brief tone. NULL until onboarding captures it.';

-- ─── 3. style_density — bounded enum-via-CHECK
alter table public.user_preferences
  add column if not exists style_density text
    check (style_density is null or style_density in
      ('telegraphic', 'paragraph', 'longform'));

comment on column public.user_preferences.style_density is
  'User preferred brief density. NULL until onboarding captures it.';

-- ─── 4. style_captured_at — provenance for the Voice DNA capture event
alter table public.user_preferences
  add column if not exists style_captured_at timestamptz;

comment on column public.user_preferences.style_captured_at is
  'Timestamp when the user completed the Voice DNA capture step in onboarding. Used to detect un-captured users for re-prompt + to audit prompt_version vs. capture date.';

-- ─── Verification (paste in SQL editor after applying) ───────────────
--
--   select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--   where table_schema='public' and table_name='user_preferences'
--     and column_name like 'style%'
--   order by column_name;
--
--   -- Expect 4 rows: style_anchors (jsonb), style_captured_at (timestamptz),
--   --               style_density (text), style_tone (text).
--
--   -- Confirm CHECK constraints exist:
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.user_preferences'::regclass
--     and conname like '%style%';
