-- Perf: wrap auth.*() calls in RLS policies so Postgres evaluates them ONCE per
-- query (an initPlan) instead of once per row. Clears the Supabase advisor
-- `auth_rls_initplan` (review C-7 — 67 USING + 3 WITH CHECK policies; already_wrapped=0).
-- Semantically identical: `(select auth.uid())` === `auth.uid()`. This is a pure
-- query-planner optimization, NOT an access-policy change — no row a user could see
-- before/after changes; only the per-row re-evaluation is removed.
--
-- Catalog-driven ALTER POLICY (never DROP/CREATE) so every policy's exact expression
-- is preserved verbatim and no table is ever left without a policy mid-migration.
-- Idempotent: only touches policies whose expression still contains an UNWRAPPED
-- auth.<fn>() call (one not already inside a `(select ...)`), so a re-run is a no-op.
-- The "already wrapped" guard uses the case-INSENSITIVE operator `!~*` because
-- Postgres decompiles the wrapped form back as `( SELECT auth.uid() AS uid)` with an
-- uppercase SELECT — a case-sensitive guard would re-select and double-wrap on re-run.
do $$
declare
  r  record;
  nq text;
  nc text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (qual       is not null and qual       ~ 'auth\.(uid|jwt|role)\(\)' and qual       !~* '\(\s*select\s+auth\.')
        or (with_check is not null and with_check ~ 'auth\.(uid|jwt|role)\(\)' and with_check !~* '\(\s*select\s+auth\.')
      )
  loop
    nq := r.qual;
    nc := r.with_check;

    if nq is not null then
      nq := regexp_replace(nq, 'auth\.uid\(\)',  '(select auth.uid())',  'g');
      nq := regexp_replace(nq, 'auth\.jwt\(\)',  '(select auth.jwt())',  'g');
      nq := regexp_replace(nq, 'auth\.role\(\)', '(select auth.role())', 'g');
    end if;
    if nc is not null then
      nc := regexp_replace(nc, 'auth\.uid\(\)',  '(select auth.uid())',  'g');
      nc := regexp_replace(nc, 'auth\.jwt\(\)',  '(select auth.jwt())',  'g');
      nc := regexp_replace(nc, 'auth\.role\(\)', '(select auth.role())', 'g');
    end if;

    execute format(
      'alter policy %I on %I.%I%s%s',
      r.policyname, r.schemaname, r.tablename,
      case when r.qual       is not null then ' using ('      || nq || ')' else '' end,
      case when r.with_check is not null then ' with check (' || nc || ')' else '' end
    );
  end loop;
end $$;
