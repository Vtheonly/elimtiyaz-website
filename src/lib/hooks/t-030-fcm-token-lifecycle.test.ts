/**
 * T-030 — FCM token lifecycle regression suite (PUSH-102 / SYNC-104).
 *
 * Problems covered:
 *  - PUSH-102 (verified live 2026-08-31 — the registry's "blocked" note was
 *    inaccurate): `register_fcm_token`'s ON CONFLICT re-pointed `user_id`
 *    silently; the 0050 caller verification only proved the caller owned
 *    p_user_id, not the conflicting row. Migration 0060 adds the
 *    active-conflict guard + audited transfer (verified server-side by
 *    scripts/verify_t-030.sql in the hub repo).
 *  - SYNC-104 residue: the service-worker FCM_TOKEN_REFRESH flow re-registered
 *    the NEW token but never retired the STALE one — the old comment claimed
 *    "stale tokens are cleaned up the next time the user opens the portal",
 *    but nothing ever did that. device_tokens accumulated permanently-active
 *    orphan rows for rotated tokens.
 *
 * These tests pin the CLIENT side of the fix (fcm-registration.ts):
 *   1. registerDeviceToken persists the last-known token (localStorage) so a
 *      future rotation can retire it;
 *   2. the FCM_TOKEN_REFRESH handler re-registers AND retires the stale
 *      token via the new `unregister_fcm_token` RPC;
 *   3. unregisterFcmToken surfaces failure as false (best-effort contract).
 */

type RpcCall = { fn: string; args: Record<string, unknown> };

const rpcCalls: RpcCall[] = [];

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn === "register_fcm_token") return Promise.resolve({ error: null });
      if (fn === "unregister_fcm_token") return Promise.resolve({ error: null });
      return Promise.resolve({ error: { message: "no such fn" } });
    },
  },
}));

const NEW_TOKEN = "fcm-new-token-abc";
const STALE_TOKEN = "fcm-stale-token-xyz";

vi.mock("@/lib/fcm", () => ({
  initFcm: () => Promise.resolve(NEW_TOKEN),
}));

import {
  registerDeviceToken,
  unregisterFcmToken,
  subscribeToFcmTokenRefresh,
  getLastKnownFcmToken,
} from "./fcm-registration";

describe("T-030 — FCM token lifecycle (client half)", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    localStorage.clear();
  });

  it("registerDeviceToken remembers the token so a rotation can retire it", async () => {
    const ok = await registerDeviceToken("profile-1");

    expect(ok).toBe(true);
    expect(getLastKnownFcmToken()).toBe(NEW_TOKEN);
    expect(rpcCalls).toEqual([
      { fn: "register_fcm_token", args: { p_user_id: "profile-1", p_token: NEW_TOKEN, p_platform: "web" } },
    ]);
  });

  it("unregisterFcmToken calls the canonical RPC with the token string", async () => {
    const ok = await unregisterFcmToken(STALE_TOKEN);

    expect(ok).toBe(true);
    expect(rpcCalls).toEqual([
      { fn: "unregister_fcm_token", args: { p_token: STALE_TOKEN } },
    ]);
  });

  it("FCM_TOKEN_REFRESH re-registers AND retires the stale token (no orphan active row)", async () => {
    // The previous registration left the stale token behind.
    localStorage.setItem("el-imtiyaz.fcm-token", STALE_TOKEN);

    const listener = captureServiceWorkerListener();
    listener({ data: { type: "FCM_TOKEN_REFRESH" } } as MessageEvent);

    // The handler is async — let it settle.
    await vi.waitFor(() => {
      expect(rpcCalls.length).toBeGreaterThanOrEqual(1);
    });
    await new Promise((r) => setTimeout(r, 10));

    const register = rpcCalls.find((c) => c.fn === "register_fcm_token");
    const retire = rpcCalls.find((c) => c.fn === "unregister_fcm_token");
    expect(register).toBeDefined();
    // The NEW token is registered under the caller's profile…
    expect(register?.args.p_token).toBe(NEW_TOKEN);
    // …and the STALE token is retired immediately (T-030 fix).
    expect(retire).toBeDefined();
    expect(retire?.args.p_token).toBe(STALE_TOKEN);
    // The last-known token is updated to the new one.
    expect(getLastKnownFcmToken()).toBe(NEW_TOKEN);
  });

  it("non-FCM messages are ignored (no RPC calls)", async () => {
    const listener = captureServiceWorkerListener();
    listener({ data: { type: "SOMETHING_ELSE" } } as MessageEvent);
    await new Promise((r) => setTimeout(r, 10));

    expect(rpcCalls).toHaveLength(0);
  });

  it("unregisterFcmToken is best-effort: RPC failure resolves false without throwing", async () => {
    const { supabase } = await import("@/lib/supabase/client");
    // @ts-expect-error — test override of the mocked client
    supabase.rpc = () => Promise.resolve({ error: { message: "boom" } });

    const ok = await unregisterFcmToken(STALE_TOKEN);
    expect(ok).toBe(false);
  });
});

/** Install a stub service-worker registry and return the registered handler. */
function captureServiceWorkerListener(): (ev: MessageEvent) => void {
  let handler: ((ev: MessageEvent) => void) | null = null;
  // @ts-expect-error — minimal navigator.serviceWorker stub for jsdom
  globalThis.navigator.serviceWorker = {
    addEventListener: (_type: string, fn: (ev: MessageEvent) => void) => {
      handler = fn;
    },
    removeEventListener: () => {},
  };
  subscribeToFcmTokenRefresh("profile-1");
  return handler as unknown as (ev: MessageEvent) => void;
}
