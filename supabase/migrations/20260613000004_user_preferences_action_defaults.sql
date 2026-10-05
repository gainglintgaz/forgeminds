-- Phase 1 actions — per-user saved defaults for Analyze + Draft (design doc §5.4, VIBE Rule 55).
-- Defaults live in the DB (not JS constants); the resolver reads pref-with-fallback. We REUSE
-- existing social_tone / social_platforms — we do NOT add a duplicate tone column (Rule-59 conflict).
-- Per-platform caps + hashtag defaults live as DATA inside draft_defaults.platform_caps.
-- Additive + non-destructive. The column DEFAULTs ARE the resolver's tier-1 fallback (kept in sync
-- with DEFAULT_ANALYZE_CONFIG / DEFAULT_DRAFT_CONFIG in src/lib/actions/resolve-config.ts).

alter table public.user_preferences
  add column if not exists analyze_defaults jsonb not null default
    '{"lens":"key_facts","depth":"standard","stance":"facts_only"}'::jsonb;

alter table public.user_preferences
  add column if not exists draft_defaults jsonb not null default
    '{
      "platform":"x",
      "length":"standard",
      "stance":"facts_only",
      "hashtags":true,
      "platform_caps":{
        "x":{"max_chars":280,"hashtags_default":true},
        "reddit":{"max_chars":4000,"hashtags_default":false},
        "facebook":{"max_chars":2000,"hashtags_default":false},
        "linkedin":{"max_chars":3000,"hashtags_default":true},
        "generic":{"max_chars":1000,"hashtags_default":false}
      }
    }'::jsonb;

comment on column public.user_preferences.analyze_defaults is
  'Phase 1: saved Analyze defaults {lens,depth,stance}. Tier-2 of resolveActionConfig (overridden per-click).';
comment on column public.user_preferences.draft_defaults is
  'Phase 1: saved Draft defaults {platform,length,stance,hashtags,platform_caps{...}}. Per-platform caps are DATA so "FB longer / X shorter / Reddit no hashtags" is a config change, not code. Tone reuses social_tone.';
