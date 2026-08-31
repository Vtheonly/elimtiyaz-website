/**
 * T-036 — PUSH-103 regression suite: FCM auto-registration after the first
 * user gesture.
 *
 * The defect: the website's ONLY token-registration path was the manual
 * toggle in the Profile view — most parents never found it, so the server
 * had no FCM token for them and no push notification could ever be
 * delivered. Browsers require a user gesture for
 * `Notification.requestPermission()`, so plain auto-registration on
 * sign-in is impossible — the fix waits for the FIRST gesture.
 *
 * Client contract under test (fcm-registration.ts):
 *   - permission "granted"  → register immediately (no prompt);
 *   - permission "default"  → requestPermission FROM the gesture; register
 *                             only if granted; NEVER auto-retry after a
 *                             dismissed/denied prompt (once per browser);
 *   - permission "denied"   → never prompt, never register;
 *   - one attempt per browser profile (localStorage guard);
 *   - the returned teardown stops listening;
 *   - a second gesture after the first does nothing (one-shot).
 *
 * Wiring pinned by source-scan: the auth-provider re-wires the listener
 * whenever the signed-in profile changes.
 */
type RpcCall = { fn: string; args: Record<string, unknown> };

const rpcCalls: RpcCall[] = [];

vi.mock("@/lib/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn === "register_fcm_token") return Promise.resolve({ error: null });
      return Promise.resolve({ error: { message: "no such fn" } });
    },
  },
}));

const NEW_TOKEN = "fcm-token-t036";

vi.mock("@/lib/fcm", () => ({
  initFcm: () => Promise.resolve(NEW_TOKEN),
}));

import {
  autoRegisterAction,
  autoRegisterFcmAfterFirstGesture,
} from "./fcm-registration";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Minimal Notification stub — jsdom has none. */
class FakeNotification {
  static permission = "granted";
  static requestPermission = vi.fn(async () => "granted");
}

const flush = () => new Promise((r) => setTimeout(r, 10));

function gesture(): void {
  window.dispatchEvent(new Event("pointerdown"));
}

describe("T-036 — FCM auto-registration after first gesture (PUSH-103)", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    localStorage.clear();
    FakeNotification.permission = "granted";
    FakeNotification.requestPermission.mockClear();
    (globalThis as unknown as { Notification: unknown }).Notification = FakeNotification;
  });

  afterEach(() => {
    delete (globalThis as unknown as { Notification?: unknown }).Notification;
  });

  it("decision map: granted → register, default → prompt, denied → never", () => {
    expect(autoRegisterAction("granted")).toBe("register");
    expect(autoRegisterAction("default")).toBe("prompt");
    expect(autoRegisterAction("denied")).toBe("never");
  });

  it("permission already granted → registers on the first gesture WITHOUT a prompt", async () => {
    FakeNotification.permission = "granted";
    const teardown = autoRegisterFcmAfterFirstGesture("profile-1");
    try {
      gesture();
      await flush();

      expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
      expect(rpcCalls).toEqual([
        { fn: "register_fcm_token", args: { p_user_id: "profile-1", p_token: NEW_TOKEN, p_platform: "web" } },
      ]);
    } finally {
      teardown();
    }
  });

  it("permission default → prompts FROM the gesture; granted → registers", async () => {
    FakeNotification.permission = "default";
    FakeNotification.requestPermission.mockResolvedValue("granted");
    const teardown = autoRegisterFcmAfterFirstGesture("profile-1");
    try {
      gesture();
      await flush();

      expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
      expect(rpcCalls).toHaveLength(1);
      expect(rpcCalls[0]?.fn).toBe("register_fcm_token");
    } finally {
      teardown();
    }
  });

  it("prompt dismissed/denied → NO registration, NO auto-retry on later gestures", async () => {
    FakeNotification.permission = "default";
    FakeNotification.requestPermission.mockResolvedValue("denied");
    const teardown = autoRegisterFcmAfterFirstGesture("profile-1");
    try {
      gesture();
      await flush();
      gesture(); // a later gesture must not re-prompt
      await flush();

      expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
      expect(rpcCalls).toHaveLength(0);
      // The attempt is remembered — a fresh wiring also will not re-prompt.
      const teardown2 = autoRegisterFcmAfterFirstGesture("profile-1");
      gesture();
      await flush();
      teardown2();
      expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
    } finally {
      teardown();
    }
  });

  it("permission denied → never prompts, never registers", async () => {
    FakeNotification.permission = "denied";
    const teardown = autoRegisterFcmAfterFirstGesture("profile-1");
    try {
      gesture();
      await flush();

      expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
      expect(rpcCalls).toHaveLength(0);
    } finally {
      teardown();
    }
  });

  it("one-shot: the second gesture after a successful first does nothing", async () => {
    FakeNotification.permission = "granted";
    const teardown = autoRegisterFcmAfterFirstGesture("profile-1");
    try {
      gesture();
      await flush();
      gesture();
      await flush();

      expect(rpcCalls).toHaveLength(1);
    } finally {
      teardown();
    }
  });

  it("teardown stops listening — a gesture after cleanup registers nothing", async () => {
    FakeNotification.permission = "granted";
    const teardown = autoRegisterFcmAfterFirstGesture("profile-1");
    teardown();
    gesture();
    await flush();

    expect(rpcCalls).toHaveLength(0);
  });

  it("the once-guard short-circuits: a previous attempt means zero listeners", async () => {
    localStorage.setItem("el-imtiyaz.fcm-autoreg", "2026-08-31T00:00:00.000Z");
    const teardown = autoRegisterFcmAfterFirstGesture("profile-1");
    gesture();
    await flush();

    expect(rpcCalls).toHaveLength(0);
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });

  it("wiring pin: the auth-provider re-wires the listener on profile change", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "app", "providers", "auth-provider.tsx"),
      "utf8",
    );
    expect(src).toContain("autoRegisterFcmAfterFirstGesture(user?.id)");
  });
});
