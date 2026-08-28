"use client";

/**
 * FCM device token registration.
 *
 * When a parent enables push notifications, we:
 *   1. Request browser permission + get the FCM token (via initFcm).
 *   2. Upsert the token into the `device_tokens` table (migration 0025).
 *      RLS-protected so a parent can only insert/update/delete their own tokens.
 *   3. On sign-out or push-disable, mark the token as inactive.
 *
 * The matching Supabase Edge Function `send-push-notification` reads this
 * table to fan out a notification to every device registered for a given
 * `target_user_id`.
 *
 * Token lifecycle:
 *   - FCM may refresh the token at any time (rare). The service worker
 *     receives a `pushsubscriptionchange` event and posts an
 *     `FCM_TOKEN_REFRESH` message to every open page. The page then
 *     re-calls `initFcm()` and re-upserts the new token. Stale tokens are
 *     cleaned up the next time the user opens the portal.
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

  // CANONICAL PATH (migration 0027): the `register_fcm_token` RPC is the one
  // idempotent registration entry point shared with the Android app
  // (FcmTokenRegistrar). The previous direct upsert targeted a nonexistent
  // `user_profile_id` column — the canonical table (0027) uses `user_id`
  // with a (tenant_id, token) unique key, and the RPC resolves the tenant
  // and performs the upsert SECURITY DEFINER.
  const { error } = await supabase.rpc("register_fcm_token", {
    p_user_id: userProfileId,
    p_token: token,
    p_platform: "web",
  });

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
  // re-enable, the RPC will reactivate the current one.
  // Column fix: the canonical table (migration 0027) uses `user_id`.
  const { error } = await supabase
    .from("device_tokens")
    .update({ is_active: false })
    .eq("user_id", userProfileId)
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
    .eq("user_id", userProfileId)
    .eq("platform", "web")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as DeviceTokenRow[];
}

/**
 * Subscribe to FCM_TOKEN_REFRESH messages from the service worker.
 * When FCM rotates the token, the SW posts this message; we re-register.
 *
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function subscribeToFcmTokenRefresh(userProfileId: string | null | undefined): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !userProfileId) {
    return () => {};
  }
  const handler = async (event: MessageEvent) => {
    if (event.data?.type !== "FCM_TOKEN_REFRESH") return;
    console.info("[fcm] token refresh requested by SW — re-registering.");
    await registerDeviceToken(userProfileId);
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
