-- ============================================================================
-- 0025_device_tokens.sql
-- ============================================================================
-- FCM device token registration for push notifications.
--
-- This migration adds the `device_tokens` table that the web portal (and
-- eventually the Android app) uses to register each device's FCM token so
-- the backend can target push notifications to specific users.
--
-- The matching Edge Function `send-push-notification` (in
-- `supabase/functions/`) reads this table to fan out a notification to every
-- active device registered for a given `target_user_id`.
--
-- This file is provided as a REFERENCE migration — apply it to your Supabase
-- project with `supabase db push` or via the SQL editor. It is NOT run
-- automatically by the web portal.
-- ============================================================================

create table if not exists public.device_tokens (
    id              uuid        primary key default public.gen_uuid(),
    tenant_id       uuid        references public.tenants(id) on delete cascade,
    user_profile_id uuid        not null references public.user_profiles(id) on delete cascade,
    token           text        not null,
    platform        text        not null default 'web'
                    check (platform in ('web', 'android', 'ios')),
    user_agent      text,
    is_active       boolean     not null default true,
    last_seen_at    timestamptz not null default now(),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (user_profile_id, token)
);

create index if not exists device_tokens_user_idx
  on public.device_tokens (user_profile_id, is_active);

comment on table public.device_tokens is
  'FCM device tokens registered by each user. The web portal upserts a row when the parent enables push notifications; the backend reads this table to send pushes.';

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------
create trigger device_tokens_touch_updated_at
  before update on public.device_tokens
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.device_tokens enable row level security;
alter table public.device_tokens force row level security;

-- A user can only see / manage their own tokens.
create policy device_tokens_select_own
  on public.device_tokens
  for select to authenticated
  using (user_profile_id = public.current_user_profile_id());

create policy device_tokens_insert_own
  on public.device_tokens
  for insert to authenticated
  with check (user_profile_id = public.current_user_profile_id());

create policy device_tokens_update_own
  on public.device_tokens
  for update to authenticated
  using (user_profile_id = public.current_user_profile_id())
  with check (user_profile_id = public.current_user_profile_id());

create policy device_tokens_delete_own
  on public.device_tokens
  for delete to authenticated
  using (user_profile_id = public.current_user_profile_id());

-- ----------------------------------------------------------------------------
-- Auto-populate tenant_id from the user's profile on insert.
-- ----------------------------------------------------------------------------
create or replace function public.set_device_token_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then
    select tenant_id into new.tenant_id from public.user_profiles where id = new.user_profile_id;
  end if;
  return new;
end;
$$;

create trigger device_tokens_set_tenant
  before insert on public.device_tokens
  for each row execute function public.set_device_token_tenant();
