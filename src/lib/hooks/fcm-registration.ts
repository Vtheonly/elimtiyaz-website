"use client";

/**
 * FCM device token registration.
 *
 * When a parent enables push notifications, we:
 *   1. Request browser permission + get the FCM token (via initFcm).
 *   2. Upsert the token into the `device_tokens` table (RLS-protected so a
 *      parent can only insert/delete their own tokens).
 *   3. On sign-out or push-disable, delete the token.
 *
 * The matching Supabase Edge Function `send-push-notification` (lives in the
 * desktop repo's `supabase/functions/` directory) reads this table to fan out
 * a notification to every device registered for a given `target_user_id`.
 *
 * Backend contract (device_tokens table — to be added as a migration):
 *   CREATE TABLE public.device_tokens (
 *     id              uuid primary key default public.gen_uuid(),
 *     tenant_id       uuid references public.tenants(id) on delete cascade,
 *     user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
 *     token           text not null,
 *     platform        text not null default 'web',  -- 'web' | 'android' | 'ios'
 *     user_agent      text,
 *     is_active       boolean not null default true,
 *     last_seen_at    timestamptz not null default now(),
 *     created_at      timestamptz not null default now(),
 *     unique (user_profile_id, token)
 *   );
 *   ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY device_tokens_owner ON public.device_tokens
 *     FOR ALL TO authenticated
 *     USING (user_profile_id = public.current_user_profile_id())
 *     WITH CHECK (user_profile_id = public.current_user_profile_id());
 */

import { supabase } from "@/lib/supabase/client";
import { initFcm } from "@/lib/fcm";

interface DeviceTokenRow {
  id: string;
  token: string;
  is_active: boolean;
}

/**
 * Register the current device's FCM token for the given user profile.
 * Returns true on success, false if FCM isn't available or the user denied.
 */
export async function registerDeviceToken(userProfileId: string): Promise<boolean> {
  if (!supabase) return false;
  const token = await initFcm();
  if (!token) return false;

  // Upsert — if the token already exists for this user, just refresh last_seen.
  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_profile_id: userProfileId,
      token,
      platform: "web",
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      is_active: true,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_profile_id,token" }
  );

  if (error) {
    console.error("[fcm] failed to register device token:", error);
    return false;
  }
  return true;
}

/**
 * Deactivate (soft-delete) the current device's FCM token.
 * Called on sign-out or when the user disables push.
 */
export async function unregisterDeviceToken(userProfileId: string): Promise<void> {
  if (!supabase) return;
  // We don't have the token in scope here (it requires permission to read),
  // so we mark ALL this user's web tokens as inactive. The next time they
  // re-enable, the upsert will reactivate the current one.
  const { error } = await supabase
    .from("device_tokens")
    .update({ is_active: false })
    .eq("user_profile_id", userProfileId)
    .eq("platform", "web");
  if (error) {
    console.error("[fcm] failed to unregister device token:", error);
  }
}

/**
 * List the current user's registered devices (for display in the profile).
 */
export async function listDeviceTokens(userProfileId: string): Promise<DeviceTokenRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("device_tokens")
    .select("id, token, is_active")
    .eq("user_profile_id", userProfileId)
    .eq("platform", "web")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as DeviceTokenRow[];
}
