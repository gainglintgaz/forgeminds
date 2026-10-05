-- ════════════════════════════════════════════════════════════════════
-- ForgeMinds — User Secrets Vault
-- ════════════════════════════════════════════════════════════════════
-- Per-user encrypted secrets storage. Used for BYOS (Bring Your Own
-- Subscription) credentials — WSJ cookies, Readwise API key, etc.
--
-- Uses pgcrypto + a platform-level master key stored in
-- supabase Vault. Decryption happens server-side only via SECURITY
-- DEFINER functions; user RLS policies prevent direct table access.
--
-- THIS IS PHASE 2+ — apply after Phase 0/1 are stable.
-- ════════════════════════════════════════════════════════════════════

-- pgcrypto already enabled in initial migration

-- ─── Master key handling ───────────────────────────────────────────
-- The actual master key lives in Supabase Vault (managed by Supabase
-- with envelope encryption). Never store the key in this migration.
--
-- To set up:
-- 1. Generate master key: openssl rand -base64 32
-- 2. Store in Supabase Vault via dashboard:
--    Settings → Vault → Add Secret → name: 'user_secrets_master_key'
-- 3. Functions below retrieve it via vault.decrypted_secrets view

-- ════════════════════════════════════════════════════════════════════
-- 70. USER_SECRETS — encrypted per-user credentials
-- ════════════════════════════════════════════════════════════════════
create table user_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  secret_key text not null,                       -- 'wsj_session', 'readwise_api', etc.
  encrypted_value bytea not null,                 -- pgcrypto-encrypted blob
  iv bytea not null,                              -- initialization vector
  metadata jsonb default '{}'::jsonb,             -- non-secret context (label, expiry, etc.)
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(user_id, secret_key)
);

create index user_secrets_user_idx on user_secrets(user_id);

-- RLS: users can see THAT they have a secret, but NOT decrypted_value
alter table user_secrets enable row level security;

create policy "own metadata only"
  on user_secrets for select
  using (user_id = auth.uid());

create policy "own write"
  on user_secrets for all
  using (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- Encryption helpers (SECURITY DEFINER — service role only)
-- ════════════════════════════════════════════════════════════════════
-- Get master key from Vault. Only callable from SECURITY DEFINER funcs.
create or replace function _get_master_key()
returns text
security definer
set search_path = vault, public
language plpgsql as $$
declare
  k text;
begin
  select decrypted_secret into k
  from vault.decrypted_secrets
  where name = 'user_secrets_master_key'
  limit 1;

  if k is null then
    raise exception 'master key not found in vault';
  end if;

  return k;
end;
$$;

-- Set a user secret. Caller must be authenticated as the user_id.
create or replace function set_user_secret(
  p_secret_key text,
  p_plain_value text,
  p_metadata jsonb default '{}'::jsonb,
  p_expires_at timestamptz default null
)
returns uuid
security definer
set search_path = public, pgcrypto
language plpgsql as $$
declare
  v_iv bytea;
  v_encrypted bytea;
  v_master_key text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_master_key := _get_master_key();
  v_iv := extensions.gen_random_bytes(16);
  v_encrypted := encrypt_iv(p_plain_value::bytea, decode(v_master_key, 'base64'), v_iv, 'aes-cbc/pad:pkcs');

  insert into user_secrets (user_id, secret_key, encrypted_value, iv, metadata, expires_at)
  values (auth.uid(), p_secret_key, v_encrypted, v_iv, p_metadata, p_expires_at)
  on conflict (user_id, secret_key) do update
    set encrypted_value = excluded.encrypted_value,
        iv = excluded.iv,
        metadata = excluded.metadata,
        expires_at = excluded.expires_at,
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function set_user_secret to authenticated;

-- Get a user secret. Returns decrypted value only to the owner OR service role.
-- Service role is used by pipeline functions to fetch a user's BYOS credentials.
create or replace function get_user_secret(
  p_user_id uuid,
  p_secret_key text
)
returns text
security definer
set search_path = public, pgcrypto
language plpgsql as $$
declare
  v_row user_secrets%rowtype;
  v_master_key text;
  v_decrypted text;
  v_caller_role text;
begin
  -- Determine caller. service_role bypasses; authenticated must own the secret.
  v_caller_role := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', 'anon');

  if v_caller_role != 'service_role' and auth.uid() != p_user_id then
    raise exception 'unauthorized';
  end if;

  select * into v_row from user_secrets
  where user_id = p_user_id and secret_key = p_secret_key;

  if not found then
    return null;
  end if;

  -- Check expiry
  if v_row.expires_at is not null and v_row.expires_at < now() then
    return null;
  end if;

  v_master_key := _get_master_key();
  v_decrypted := convert_from(
    decrypt_iv(v_row.encrypted_value, decode(v_master_key, 'base64'), v_row.iv, 'aes-cbc/pad:pkcs'),
    'utf8'
  );

  -- Update last_used_at (best-effort)
  update user_secrets set last_used_at = now()
  where id = v_row.id;

  return v_decrypted;
end;
$$;

-- Only service role can call get_user_secret directly (bypass user RLS).
revoke execute on function get_user_secret from public, authenticated;
grant execute on function get_user_secret to service_role;

-- Delete a user secret
create or replace function delete_user_secret(p_secret_key text)
returns boolean
security definer
set search_path = public
language plpgsql as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  delete from user_secrets
  where user_id = auth.uid() and secret_key = p_secret_key;

  return found;
end;
$$;

grant execute on function delete_user_secret to authenticated;
