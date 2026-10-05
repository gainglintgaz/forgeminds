-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — match_source_catalog RPC for onboarding RAG
-- ════════════════════════════════════════════════════════════════════
-- Wrapped in an RPC (not a view) because RLS would otherwise block
-- the embedding-similarity ORDER BY from running as the anon role
-- during onboarding. SECURITY DEFINER lets the function run with
-- elevated privileges; we lock down the body with a fixed search_path
-- and parameter validation.
--
-- Called from src/lib/onboarding/catalog-rag.ts via:
--   supabase.rpc("match_source_catalog", {
--     query_embedding: number[1536],
--     match_count: number,
--     allowed_tiers: text[],
--     allowed_geographies: text[] | null
--   })
--
-- Apply this AFTER the source_catalog migration + seed catalog have
-- been applied (so the table + index exist + are populated).
-- ════════════════════════════════════════════════════════════════════

-- SECURITY INVOKER (not DEFINER): the function only does a SELECT against
-- public.source_catalog, which authenticated users can already read via
-- the RLS policy `source_catalog_read_authenticated` (using is_active=true).
-- INVOKER runs the query in the caller's RLS context — same result set,
-- no advisor warning about "Signed-In Users Can Execute SECURITY DEFINER
-- Function". Pinned search_path is still mandatory per Supabase advisor
-- best practice (CVE-class search_path injection in any functions on
-- exposed API schemas). Decision recorded 2026-05-05 in DECISIONS.md.
create or replace function public.match_source_catalog(
  query_embedding       vector(1536),
  match_count           integer default 25,
  allowed_tiers         text[]  default array['free', 'freemium'],
  allowed_geographies   text[]  default null
)
returns table (
  id                          uuid,
  name                        text,
  description                 text,
  url                         text,
  type                        text,
  paywall_tier                text,
  paywall_cost_usd_monthly    numeric,
  recommended_for_topics      text[],
  geography                   text[],
  quality_score               numeric,
  similarity                  numeric
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  return query
  select
    sc.id,
    sc.name,
    sc.description,
    sc.url,
    sc.type::text,
    sc.paywall_tier::text,
    sc.paywall_cost_usd_monthly,
    sc.recommended_for_topics,
    sc.geography,
    sc.quality_score,
    -- 1 - cosine_distance = cosine similarity, normalized to [0, 1]
    (1 - (sc.embedding <=> query_embedding))::numeric as similarity
  from public.source_catalog sc
  where sc.is_active = true
    and sc.embedding is not null
    and sc.paywall_tier::text = any(allowed_tiers)
    and (
      allowed_geographies is null
      or sc.geography && allowed_geographies
    )
  order by
    -- Combine semantic similarity with quality_score for the final
    -- rank. 0.7 weight on similarity (intent fit) + 0.3 on quality
    -- so a slightly-less-similar but high-quality source can outrank
    -- a perfectly-similar mediocre source.
    (
      0.7 * (1 - (sc.embedding <=> query_embedding))
      + 0.3 * coalesce(sc.quality_score, 0.5)
    ) desc
  limit match_count;
end;
$$;

-- Lock execution down to authenticated + service_role.
-- (Anon should never call this — onboarding requires sign-in.)
revoke execute on function public.match_source_catalog(
  vector(1536), integer, text[], text[]
) from anon, public;

grant execute on function public.match_source_catalog(
  vector(1536), integer, text[], text[]
) to authenticated, service_role;

-- ─── Verification (paste in SQL editor after applying) ───────────────
--
--   -- Confirm the function exists with explicit search_path:
--   select proname, proconfig
--   from pg_proc
--   where pronamespace = 'public'::regnamespace
--     and proname = 'match_source_catalog';
--   -- proconfig should show {search_path=public, pg_temp}
--
--   -- Confirm anon cannot execute:
--   select has_function_privilege('anon',
--     'public.match_source_catalog(vector, integer, text[], text[])'::regprocedure,
--     'EXECUTE'
--   );
--   -- expect: false
