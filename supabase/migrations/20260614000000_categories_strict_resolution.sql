-- 20260614000000_categories_strict_resolution.sql
--
-- S2 strict-resolution layer (ERR-021, lessons.md #105, VIBE Rule 24).
-- Additive + idempotent. No destructive ops.
--
-- Why: scored_articles.diversity_category was a hardcoded 'core' literal in
-- score/route.ts (the AI's real category was dropped), so every article fell in
-- one invented bucket. This adds the canonical taxonomy + a strict-resolution
-- target so the model can only map to an EXISTING category UUID; a miss lands in
-- the 'uncategorized' review bucket (never invented / never blind-inserted).
--
-- Canonical taxonomy = the 13 source_catalog.categories values (single source of
-- truth) + one 'uncategorized' sentinel.

-- ── Canonical categories table ────────────────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  label       text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

-- Public read (taxonomy is not sensitive); writes only via service_role
-- (service_role bypasses RLS — no write policy needed for anon/authenticated).
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);

grant select on public.categories to anon, authenticated;
grant all    on public.categories to service_role;

-- Seed the 13 canonical slugs + the 'uncategorized' review sentinel (idempotent).
insert into public.categories (slug, label, sort_order) values
  ('finance',      'Finance & Markets',      10),
  ('tech',         'Technology',             20),
  ('sciences',     'Sciences',               30),
  ('medicine',     'Medicine',               40),
  ('health',       'Health',                 50),
  ('geopolitics',  'Geopolitics',            60),
  ('civic',        'Civic & Government',     70),
  ('legal_tax',    'Legal & Tax',            80),
  ('career',       'Career',                 90),
  ('education',    'Education',              100),
  ('arts',         'Arts',                  110),
  ('lifestyle',    'Lifestyle',             120),
  ('sports',       'Sports',                130),
  ('uncategorized','Uncategorized (review)',999)
on conflict (slug) do nothing;

-- ── scored_articles: strict-resolution columns ────────────────────────────
-- category_id  → the resolved canonical UUID (NULL on existing back-data).
-- category_resolution → 'resolved' (matched a real slug) or
--                       'flagged_for_review' (model output had no match →
--                       parked in 'uncategorized', surfaced for alias-table growth).
alter table public.scored_articles
  add column if not exists category_id uuid references public.categories(id),
  add column if not exists category_resolution text
    check (category_resolution in ('resolved','flagged_for_review'))
    default 'flagged_for_review';

create index if not exists idx_scored_articles_category_id
  on public.scored_articles(category_id);
