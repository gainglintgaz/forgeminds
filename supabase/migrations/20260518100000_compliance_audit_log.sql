-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — compliance_audit_log (Phase 2.2 expanded scope)
-- ════════════════════════════════════════════════════════════════════
-- Required by factory rule .claude/rules/reference (compliance.md §7).
-- Append-only ledger of compliance-sensitive events: outcome captures,
-- AI calls with cost, account deletions, source adds/removes, brief
-- deliveries. Lets the user (or, later, a regulator) audit "what did
-- the app do with my data + when" in one query.
--
-- Phase 2.2 writes only event_type='outcome_logged' rows (via the
-- upsert_article_outcome RPC extension in
-- 20260518100001_outcome_rpc_compliance_log.sql). Other event types
-- ship as their producing surfaces land.
--
-- Append-only: RLS allows users to SELECT their own rows; INSERT is
-- only available via SECURITY DEFINER RPCs (track_event,
-- upsert_article_outcome). No UPDATE, no DELETE for users; the rare
-- retention job runs as service_role.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.compliance_audit_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  event_type      text not null,
                            -- known values (extend as features ship):
                            --   outcome_logged       — article save/dismiss/rate
                            --   brief_delivered      — brief surfaced to user
                            --   ai_call              — LLM router invocation
                            --   source_added         — onboarding wizard or settings
                            --   source_removed       — settings
                            --   account_deleted      — danger zone
                            --   style_captured       — voice DNA capture
                            --   tos_consent          — terms of service acceptance
  resource_type   text,     -- 'article' / 'brief' / 'source' / 'session' / null
  resource_id     text,     -- the affected row's id, stringified
  event_data      jsonb not null default '{}'::jsonb,
                            -- inputs / outputs that produced the event
  prompt_version  text,     -- when AI was in the loop
  model_version   text,     -- ditto (e.g., 'claude-sonnet-4-6')
  cost_usd_cents  bigint,   -- ditto (per VIBE Rule 9: money as cents)
  ip_address      inet,     -- only if jurisdiction requires; nullable
  user_agent      text,     -- ditto; nullable
  rendered_at     timestamptz not null default now()
);

comment on table public.compliance_audit_log is
  'Append-only ledger of compliance-sensitive events. Users SELECT own rows via RLS; writes only through SECURITY DEFINER RPCs. See factory rule compliance.md §7.';

-- ─── Indexes ─────────────────────────────────────────────────────────
-- Hot path: "show me what the app did with my data" (per-user, recent first)
create index if not exists compliance_audit_log_user_time_idx
  on public.compliance_audit_log (user_id, rendered_at desc);

-- Filter by event type for cross-cutting audits (e.g., all AI calls
-- this week across all users — service_role only via RLS).
create index if not exists compliance_audit_log_event_time_idx
  on public.compliance_audit_log (event_type, rendered_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.compliance_audit_log enable row level security;

-- Users read their own rows only.
drop policy if exists "compliance_audit_log_owner_select" on public.compliance_audit_log;
create policy "compliance_audit_log_owner_select"
  on public.compliance_audit_log for select
  to authenticated
  using (auth.uid() = user_id);

-- NO insert/update/delete policy for authenticated. The SECURITY DEFINER
-- RPCs (upsert_article_outcome, track_event) write as the function's
-- definer role (postgres / service_role) with auth.uid() gating at
-- function entry. Direct .insert() from the browser is therefore
-- rejected by RLS — exactly the append-only contract this ledger needs.

-- service_role retains full access for retention jobs + admin exports.
grant all on public.compliance_audit_log to service_role;
grant select on public.compliance_audit_log to authenticated;

-- ─── Verification ────────────────────────────────────────────────────
--   select relname, relrowsecurity from pg_class where relname = 'compliance_audit_log';
--   -- expect rls = true
--
--   select polname, polcmd from pg_policies where tablename='compliance_audit_log';
--   -- expect one row: compliance_audit_log_owner_select, SELECT
--
--   -- confirm direct INSERT is rejected for authenticated:
--   -- (run via JS SDK as a signed-in user)
--   --   await supabase.from('compliance_audit_log').insert({...})
--   -- expect 42501 row-level security policy violation
