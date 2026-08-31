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
 *     re-calls `initFcm()`, re-registers the new token AND retires the
 *     stale one via the `unregister_fcm_token` RPC (T-030, migration
 *     0060) — no orphan active rows are left behind.
 */

import { supabase } from "@/lib/supabase/client";
import { initFcm } from "@/lib/fcm";

/**
 * Last-known FCM token for THIS browser (localStorage). Written on every
 * successful registration so the FCM_TOKEN_REFRESH flow can retire the
 * STALE token immediately (T-030 / PUSH-102) instead of leaving a
 * permanently-active orphan row in device_tokens — the old comment
 * claimed "stale tokens are cleaned up the next time the user opens the
 * portal", but nothing ever did that.
 */
const FCM_TOKEN_STORAGE_KEY = "el-imtiyaz.fcm-token";

interface DeviceTokenRow {
  id: string;
  token: string;
  is_active: boolean;
}

/**
 * Read the last-known FCM token (localStorage) — used by tests + the refresh
 * flow to detect a rotated token.
 */
export function getLastKnownFcmToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
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
  // Remember the token so a future rotation can retire THIS one.
  try {
    localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
  } catch {
    // Non-fatal — private browsing etc.
  }
  return true;
}

/**
 * Retire ONE stale FCM token by string (T-030 / PUSH-102).
 *
 * Called by the FCM_TOKEN_REFRESH flow after re-registering: FCM rotated
 * the token, the NEW one is now active, the OLD row (still is_active=true
 * from the previous registration) is deactivated via the canonical
 * `unregister_fcm_token` RPC (migration 0060, caller-verified: only the
 * row's owner can retire it). Best-effort — a failure leaves the row for
 * the user's next sign-out (deactivate_fcm_tokens).
 */
export async function unregisterFcmToken(token: string): Promise<boolean> {
  if (!supabase || !token) return false;
  const { error } = await supabase.rpc("unregister_fcm_token", { p_token: token });
  if (error) {
    console.warn("[fcm] failed to retire stale token:", error.message);
    return false;
  }
  return true;
}

/**
 * Deactivate (soft-delete) the current device's FCM token.
 * Called on sign-out (auth-provider) or when the user disables push.
 *
 * SYNC-105 fix (2026-08-30): sign-out previously left is_active=true rows
 * behind — push notifications kept reaching signed-out devices. Uses the
 * canonical `deactivate_fcm_tokens` RPC (migration 0050, caller-verified,
 * SECURITY DEFINER) so the same path is shared with the Android app's
 * sign-out; falls back to the RLS-scoped direct update if the RPC is not
 * yet deployed.
 */
export async function unregisterDeviceToken(userProfileId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc("deactivate_fcm_tokens", {
    p_user_id: userProfileId,
    p_platform: "web",
  });
  if (error) {
    // RPC not deployed (or transient failure) — fall back to the direct,
    // RLS-scoped update. We mark ALL this user's web tokens as inactive;
    // the next re-enable reactivates the current one.
    console.warn("[fcm] deactivate_fcm_tokens RPC failed, falling back to direct update:", error.message);
    const { error: fallbackError } = await supabase
      .from("device_tokens")
      .update({ is_active: false })
      .eq("user_id", userProfileId)
      .eq("platform", "web");
    if (fallbackError) {
      console.error("[fcm] failed to unregister device token:", fallbackError.message);
    }
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
 * When FCM rotates the token, the SW posts this message; we:
 *   1. re-register the NEW token (registerDeviceToken), and
 *   2. retire the STALE one (unregisterFcmToken with the last-known token,
 *      T-030) so device_tokens never holds two active rows for this browser.
 *
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function subscribeToFcmTokenRefresh(userProfileId: string | null | undefined): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !userProfileId) {
    return () => {};
  }
  const handler = async (event: MessageEvent) => {
    if (event.data?.type !== "FCM_TOKEN_REFRESH") return;
    console.info("[fcm] token refresh requested by SW — re-registering + retiring the stale token.");
    const staleToken = getLastKnownFcmToken();
    const ok = await registerDeviceToken(userProfileId);
    if (ok && staleToken) {
      await unregisterFcmToken(staleToken);
    }
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
