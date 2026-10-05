-- H1 fix 2 — source-health loud degradation (docs/architecture/curation-hardening-vra.md
-- §7 assumptions 2-4, founder-approved 2026-07-09).
--
-- Today a dead RSS feed or finance API fails quietly: `sources.error_count` and
-- `last_error` exist but nothing ever writes them (confirmed by code read —
-- ingest/route.ts only ever touched `last_fetched_at`), so a dead source is
-- indistinguishable from a genuinely quiet news day. This migration adds the
-- two current-state columns the fix needs (`consecutive_failures`,
-- `last_success_at`) plus the generate-time degradation snapshot column on
-- `briefs`, and the atomic batched RPC that records per-tick fetch outcomes
-- without an N+1 (Hostile Architect finding #9 / Senior Architect §5 — a
-- single `UPDATE ... FROM jsonb_to_recordset(...)`, not one UPDATE per source
-- row).
--
-- Additive only — no drops, no destructive ops.

-- ════════════════════════════════════════════════════════════════════
-- sources: current-state degradation columns
-- ════════════════════════════════════════════════════════════════════
alter table public.sources
  add column if not exists consecutive_failures integer not null default 0,
  add column if not exists last_success_at timestamptz;

comment on column public.sources.consecutive_failures is
  'Resets to 0 on any successful fetch; +1 on failure. >=3 marks a source '
  '"degraded" for the brief-level banner (H1 fix 2, architecture §7 assumption 3). '
  'Current-state only — does NOT track historical flap frequency (explicit V1 '
  'non-goal, architecture §8).';
comment on column public.sources.last_success_at is
  'Timestamp of the most recent SUCCESSFUL fetch for this source, distinct from '
  'last_fetched_at (which updates on every attempt, success or not).';

-- ════════════════════════════════════════════════════════════════════
-- briefs: generate-time degradation snapshot (NOT a live query — architecture
-- §7 assumption 4: a brief's degradation state stays accurate to what was
-- true when it was generated, so re-opening the same brief later shows the
-- same banner it had at generation time).
-- ════════════════════════════════════════════════════════════════════
alter table public.briefs
  add column if not exists degraded_sources jsonb;

comment on column public.briefs.degraded_sources is
  'Snapshot of pipeline source health computed once at generate-time: '
  '{count_active, count_degraded, source_names_degraded}. Always populated '
  'post-H1 (count_degraded=0 = healthy, never a bare null). NOT recomputed on '
  'read — this is "what was true when this brief was made", distinct from '
  '/sources'' live-computed SourceHealth (architecture §4).';

-- ════════════════════════════════════════════════════════════════════
-- record_source_fetch_results() — atomic batched fetch-outcome recorder.
--
-- Called once per ingest tick with the full set of {source_id, success, error}
-- results for every source ATTEMPTED that tick (RSS: per-URL; the 4 finance
-- APIs: the same per-type result applied to every active source row of that
-- type, since one API call covers all rows of that type — architecture §4
-- forward-provenance table). A single UPDATE...FROM jsonb_to_recordset keeps
-- this O(1) round-trips regardless of source count (avoids the N+1 class of
-- bug this codebase has hit before — score-step N+1, S3.1 commit history).
--
-- `error` is expected to already be scrubbed of API keys by the caller via
-- scrubUrl() (H1 fix 6) before this function ever sees it — this function
-- does not re-scrub, so callers MUST scrub first.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.record_source_fetch_results(
  p_user_id uuid,
  p_results jsonb -- array of {source_id: uuid, success: boolean, error: text|null}
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.sources s
  set
    last_fetched_at = now(),
    consecutive_failures = case when r.success then 0 else s.consecutive_failures + 1 end,
    last_success_at = case when r.success then now() else s.last_success_at end,
    error_count = case when r.success then coalesce(s.error_count, 0) else coalesce(s.error_count, 0) + 1 end,
    last_error = case when r.success then s.last_error else r.error end,
    updated_at = now()
  from jsonb_to_recordset(p_results) as r(source_id uuid, success boolean, error text)
  where s.id = r.source_id
    and s.user_id = p_user_id;
end;
$$;

-- Server-side cron routes only (service-role client) — never exposed to
-- authenticated/anon callers, matching the existing per-operation-token posture
-- (data-protection.md §3).
grant execute on function public.record_source_fetch_results(uuid, jsonb) to service_role;
revoke execute on function public.record_source_fetch_results(uuid, jsonb) from public, anon, authenticated;
