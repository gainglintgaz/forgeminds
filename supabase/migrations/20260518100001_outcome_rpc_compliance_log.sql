-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — upsert_article_outcome now writes to compliance_audit_log
-- ════════════════════════════════════════════════════════════════════
-- Extends the existing RPC from 20260516000000_phase2_kickoff.sql to
-- write a third row alongside (article_outcomes upsert + behavioral_events
-- mirror): one row in compliance_audit_log with event_type='outcome_logged'.
--
-- All three writes happen inside the same SECURITY DEFINER function, so
-- Postgres rolls back the whole tuple if any single one fails. The
-- existing function signature stays unchanged — only the body grows.
--
-- Why an audit log row for every outcome:
-- The compliance ledger answers "what did the app do with my data + when"
-- (compliance.md §7). Every save/dismiss/rate IS a data event the user
-- (or a regulator) might ask about later. Mirror-not-replace: the event
-- stream (behavioral_events) keeps the time-context analytics view; the
-- audit log keeps the regulator view; the state table (article_outcomes)
-- keeps the deduped current view. Three different consumers, three
-- different shapes, one atomic write.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.upsert_article_outcome(
  p_article_id          uuid,
  p_brief_id            uuid default null,
  p_outcome             public.article_outcome_kind default null,
  p_rating              smallint default null,
  p_worth_it            boolean default null,
  p_would_repeat        boolean default null,
  p_time_spent_seconds  integer default null,
  p_notes               text default null,
  p_context             jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outcome_id uuid;
  v_event_type public.behavioral_event_type;
  v_resolved_outcome public.article_outcome_kind;
begin
  if auth.uid() is null then
    raise exception 'upsert_article_outcome requires authenticated user';
  end if;

  v_resolved_outcome := coalesce(p_outcome, 'no_action');

  -- (1/3) State row — per-(user, article) deduped current outcome.
  insert into public.article_outcomes (
    user_id, article_id, brief_id, outcome, rating,
    worth_it, would_repeat, time_spent_seconds, notes, context
  ) values (
    auth.uid(), p_article_id, p_brief_id,
    v_resolved_outcome,
    p_rating, p_worth_it, p_would_repeat,
    p_time_spent_seconds, p_notes, coalesce(p_context, '{}'::jsonb)
  )
  on conflict (user_id, article_id) do update set
    brief_id = coalesce(excluded.brief_id, public.article_outcomes.brief_id),
    outcome = case
      when excluded.outcome = 'no_action' then public.article_outcomes.outcome
      else excluded.outcome
    end,
    rating = coalesce(excluded.rating, public.article_outcomes.rating),
    worth_it = coalesce(excluded.worth_it, public.article_outcomes.worth_it),
    would_repeat = coalesce(excluded.would_repeat, public.article_outcomes.would_repeat),
    time_spent_seconds = coalesce(excluded.time_spent_seconds, public.article_outcomes.time_spent_seconds),
    notes = coalesce(excluded.notes, public.article_outcomes.notes),
    context = public.article_outcomes.context || excluded.context,
    updated_at = now()
  returning outcome_id into v_outcome_id;

  -- (2/3) Event stream mirror — append-only behavioral_events row.
  v_event_type := case p_outcome
    when 'saved'        then 'article_save'::public.behavioral_event_type
    when 'dismissed'    then 'article_dismiss'::public.behavioral_event_type
    when 'action_taken' then 'template_accepted'::public.behavioral_event_type
    else 'article_view'::public.behavioral_event_type
  end;

  perform public.track_event(
    p_event_type := v_event_type,
    p_article_id := p_article_id,
    p_brief_id   := p_brief_id,
    p_duration_ms := case
      when p_time_spent_seconds is not null
      then p_time_spent_seconds * 1000
      else null
    end,
    p_metadata := jsonb_build_object(
      'outcome_id', v_outcome_id,
      'rating', p_rating,
      'worth_it', p_worth_it,
      'would_repeat', p_would_repeat
    )
  );

  -- (3/3) Compliance audit log row — append-only.
  -- event_data carries the inputs that produced the row so a future
  -- audit query can reconstruct "what did I tell the app on date X."
  insert into public.compliance_audit_log (
    user_id, event_type, resource_type, resource_id, event_data
  ) values (
    auth.uid(),
    'outcome_logged',
    'article',
    p_article_id::text,
    jsonb_build_object(
      'outcome', v_resolved_outcome,
      'rating', p_rating,
      'worth_it', p_worth_it,
      'would_repeat', p_would_repeat,
      'brief_id', p_brief_id,
      'outcome_id', v_outcome_id
    )
  );

  return v_outcome_id;
end;
$$;

-- Re-apply the grant pattern from the original migration. CREATE OR
-- REPLACE preserves existing grants on the function, but include
-- defensively in case dev DB was reset.
revoke execute on function public.upsert_article_outcome(
  uuid, uuid, public.article_outcome_kind, smallint, boolean, boolean, integer, text, jsonb
) from anon, public;
grant execute on function public.upsert_article_outcome(
  uuid, uuid, public.article_outcome_kind, smallint, boolean, boolean, integer, text, jsonb
) to authenticated, service_role;

-- ─── Verification ────────────────────────────────────────────────────
-- After applying, click Save on one article from a signed-in browser
-- session, then:
--
--   select 'outcomes' as src, count(*) from public.article_outcomes
--     where user_id = '<test user>'
--   union all
--   select 'events'   as src, count(*) from public.behavioral_events
--     where user_id = '<test user>' and event_type = 'article_save'
--   union all
--   select 'audit'    as src, count(*) from public.compliance_audit_log
--     where user_id = '<test user>' and event_type = 'outcome_logged';
--
-- Expect all three to grow by exactly 1 per click.
