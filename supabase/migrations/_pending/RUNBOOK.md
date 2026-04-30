# ForgeMinds Migration Runbook — One-at-a-Time Rollout

7 migrations apply sequentially. Each step has: APPLY → VERIFY → MOVE NEXT.

If a migration errors, we fix the file, then re-push (the CLI is idempotent for failed migrations — it'll retry).

---

## Step 0: Reset the database (Victor)

In Supabase Dashboard SQL editor (https://supabase.com/dashboard/project/ymgbjtgczgnooscigplb/sql/new):

```sql
drop schema public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant create on schema public to postgres, anon, authenticated, service_role;

drop schema if exists supabase_migrations cascade;
```

Expected: `Success. No rows returned.`

---

## Migration 1: initial_schema (31 tables — the foundation)

**File:** `migrations/20260413000000_initial_schema.sql`
**Currently active:** ✓ (only one in `migrations/`)

### Apply
```powershell
cd C:\Users\vtbsj\victor-ai-factory\projects\forgeminds
npx supabase db push
```

Type `Y` when prompted.

### Verify (in Supabase SQL editor)
```sql
-- Should return 31
select count(*) from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- Should return 'profiles' as one of the rows
select table_name from information_schema.tables
where table_schema = 'public' order by table_name limit 5;

-- All tables should have RLS enabled (returns true for each)
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;
```

### If errors: fix migration file, re-run `npx supabase db push`.
### If success: Victor tells Claude → Claude moves migration 2 back.

---

## Migration 2: action_templates (3 tables)

**File:** `_pending/20260426000000_action_templates.sql`
**Tables added:** `action_templates`, `action_template_runs`, `data_source_cache`

### Move it back
Claude runs:
```bash
mv supabase/migrations/_pending/20260426000000_action_templates.sql supabase/migrations/
```

### Apply
```powershell
npx supabase db push
```

### Verify
```sql
-- Should return 34 (was 31 + 3)
select count(*) from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- Confirm new tables exist
select table_name from information_schema.tables
where table_name in ('action_templates','action_template_runs','data_source_cache');

-- Confirm enums created
select typname from pg_type where typname in ('action_vector','event_trigger','run_outcome');
```

---

## Migration 3: geo_paywall_moat (8 tables)

**File:** `_pending/20260426000001_geo_paywall_moat.sql`
**Tables:** geographies, user_geographies, article_geographies, paywall_sources, external_subscriptions, user_context_matrix, outcome_aggregates, template_effectiveness

### Verify after apply
```sql
-- Should return 42
select count(*) from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- Confirm enum geo_scale exists
select unnest(enum_range(null::geo_scale));
```

---

## Migration 4: chains_noise_kickoff_capabilities (9 tables)

**File:** `_pending/20260426000002_chains_noise_kickoff_capabilities.sql`
**Tables:** event_chain_patterns, event_chains, user_filter_preferences, engagement_decay, notification_preferences, tool_capabilities, tool_lessons_learned, kickoff_templates, build_kickoff_packages

### Verify after apply
```sql
-- Should return 51
select count(*) from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- Trigger should now fire on signup (recreated in this migration)
select tgname from pg_trigger where tgname = 'on_auth_user_created';
```

---

## Migration 5: shared_brains_and_community_brain (6 tables)

**File:** `_pending/20260426000003_shared_brains_and_community_brain.sql`
**Tables:** shared_brains, brain_memberships, community_data_settings, community_embeddings, community_trends, community_brain_queries

### Verify after apply
```sql
-- Should return 57
select count(*) from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- Confirm community defaults are ON (not opted-out by default)
select column_default from information_schema.columns
where table_name = 'community_data_settings' and column_name = 'enabled_scopes';
-- Should show: '{anonymized_signals,anonymized_outcomes,...}'
```

---

## Migration 6: behavioral_signals (3 tables)

**File:** `_pending/20260426000004_behavioral_signals.sql`
**Tables:** behavioral_events, session_summaries, community_behavioral_aggregates

### Verify after apply
```sql
-- Should return 60
select count(*) from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- Confirm track_event function exists
select proname from pg_proc where proname = 'track_event';
```

---

## Migration 7: brain_stack (9 tables)

**File:** `_pending/20260426000005_brain_stack.sql`
**Tables:** prompt_versions, prompt_outcomes, insight_distillations, model_routing_rules, profile_clusters, user_profile_cluster, topic_clusters, improvement_proposals, brain_stack_layers

### Verify after apply
```sql
-- Should return 69
select count(*) from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- Confirm 6 brain_stack_layers seeded (Layers 0-5)
select layer_number, layer_name from brain_stack_layers order by layer_number;

-- Confirm 12 model_routing_rules seeded
select count(*) from model_routing_rules;
```

---

## Final verification

After all 7 applied:

```sql
-- 69 tables across 6 brain stack layers
select count(*) from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';

-- All RLS-enabled
select count(*) from pg_tables
where schemaname = 'public' and rowsecurity = false;
-- Should be 0

-- Migrations history clean
select version from supabase_migrations.schema_migrations
order by version;
-- Should list all 7 versions
```

Then Victor sets `.env.local` and visits `/api/health` to confirm everything connects.
