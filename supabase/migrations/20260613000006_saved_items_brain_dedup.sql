-- Phase 1 actions — Save-to-Brain dedup (design doc §5.6).
-- "Save to Brain" must be idempotent: re-clicking the same article must not create a second brain row.
-- Partial unique on the brain rows only (is_brain_item) — non-brain saved_items rows are unaffected.
-- The route treats 23505 on insert as { alreadySaved: true } (VIBE Rule 37).
-- Additive (new index) + non-destructive. article_id is nullable but brain saves always supply it.

create unique index if not exists saved_items_user_article_brain_uq
  on public.saved_items (user_id, article_id)
  where is_brain_item;
