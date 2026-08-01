-- ============================================================================
-- 0028_notification_preferences.sql
-- ============================================================================
-- Per-category notification opt-in/out for each user. The web portal uses
-- this table to let parents choose which notification categories they want
-- to receive via push (FCM) vs. in-app only.
--
-- Categories are derived from the notification taxonomy documented in the
-- project plan (payment, absence, message, announcement, grade, homework,
-- calendar, account, system).
--
-- A row is created on-demand the first time the user opens the preferences
-- screen — we don't pre-seed rows for every user × category. When a row is
-- missing, the default behavior is "both push and in-app enabled" (the
-- Edge Function treats missing rows as opted-in).
-- ============================================================================

create table if not exists public.notification_preferences (
  id              uuid        primary key default public.gen_uuid(),
  tenant_id       uuid        references public.tenants(id) on delete cascade,
  user_profile_id uuid        not null references public.user_profiles(id) on delete cascade,
  category        text        not null check (category in (
                    'payment', 'absence', 'message', 'announcement',
                    'grade', 'homework', 'calendar', 'account', 'system'
                  )),
  push_enabled    boolean     not null default true,
  in_app_enabled  boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_profile_id, category)
);

create index if not exists notification_prefs_user_idx
  on public.notification_preferences (user_profile_id);

comment on table public.notification_preferences is
  'Per-category notification opt-in/out for each user. Missing rows = both push and in-app enabled (default opt-in).';

create trigger notification_preferences_touch_updated_at
  before update on public.notification_preferences
  for each row execute function public.touch_updated_at();

-- Auto-populate tenant_id from the user's profile on insert.
create or replace function public.set_notification_preference_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then
    select tenant_id into new.tenant_id from public.user_profiles where id = new.user_profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists notification_preferences_set_tenant on public.notification_preferences;
create trigger notification_preferences_set_tenant
  before insert on public.notification_preferences
  for each row execute function public.set_notification_preference_tenant();

-- ----------------------------------------------------------------------------
-- RLS: a user can only see and manage their own preferences.
-- ----------------------------------------------------------------------------
alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;

create policy notification_preferences_select_own
  on public.notification_preferences
  for select to authenticated
  using (user_profile_id = public.current_user_profile_id());

create policy notification_preferences_upsert_own
  on public.notification_preferences
  for insert to authenticated
  with check (user_profile_id = public.current_user_profile_id());

create policy notification_preferences_update_own
  on public.notification_preferences
  for update to authenticated
  using (user_profile_id = public.current_user_profile_id())
  with check (user_profile_id = public.current_user_profile_id());

create policy notification_preferences_delete_own
  on public.notification_preferences
  for delete to authenticated
  using (user_profile_id = public.current_user_profile_id());
