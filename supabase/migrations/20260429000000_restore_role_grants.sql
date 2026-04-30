-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — Restore role grants after schema reset
-- ════════════════════════════════════════════════════════════════════
-- When we did `drop schema public cascade` during DB reset, the default
-- privilege grants for anon/authenticated/service_role were stripped.
-- New tables get created without the GRANTs that Supabase normally sets
-- up automatically, causing 42501 "permission denied" errors when
-- accessing tables via JWT-authenticated PostgREST queries.
--
-- This migration:
--   1. Grants schema usage to all standard Supabase roles
--   2. Grants table/sequence/function access to all CURRENT objects
--   3. Sets default privileges for FUTURE objects (so new tables auto-grant)
--
-- After this migration, JS SDK queries with anon/service_role keys will
-- work as expected. RLS still gates per-row access — these grants only
-- restore the table-level permissions Supabase normally provides.
-- ════════════════════════════════════════════════════════════════════

-- Schema-level usage
grant usage on schema public to anon, authenticated, service_role;

-- Existing tables
grant all on all tables in schema public to anon, authenticated, service_role;

-- Existing sequences (for nextval, etc.)
grant all on all sequences in schema public to anon, authenticated, service_role;

-- Existing functions
grant all on all functions in schema public to anon, authenticated, service_role;

-- Default privileges for FUTURE objects created by postgres
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;

-- Note: We can't ALTER DEFAULT PRIVILEGES for supabase_admin from migration
-- context (insufficient privileges). The postgres-role grants above are
-- sufficient — all our schema objects are created via CLI which runs as
-- postgres. If a future Supabase change introduces tables created by
-- supabase_admin, we'd need to manually grant via the dashboard.
