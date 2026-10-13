/**
 * T-520 / CONFIG-502 regression — the owner's Web Push certificate key pair
 * arrives and web push goes LIVE out of the box.
 *
 * THE ARRIVAL (owner message, 2026-10-13): "i am not sure or rmemreb if i
 * didi the authreictn wit hsupabsde or firabse but here is the firabseas key
 * pair BK08KLwqnYj-…" — the 87-char base64url value is the PUBLIC half of
 * the Web Push certificate key pair generated in the NEW Firebase console
 * (Project settings → Cloud Messaging → Web Push Certificates), i.e. the
 * VAPID application-server key `getToken()` needs. The auth question the
 * owner asked is answered by the code: the portal's AUTH is Supabase-side
 * end-to-end (§15.99a); Firebase serves FCM push ONLY — this key affects
 * push, never sign-in.
 *
 * THE FIX (T-520 / CONFIG-502, 2026-10-13): the key is COMMITTED as the
 * `NEXT_PUBLIC_FIREBASE_VAPID_KEY` default in `src/lib/public-config.ts`
 * (public by Web-Push protocol design — the browser hands it to the push
 * service; only the PRIVATE half, which never leaves Google's console, is
 * sensitive) and shipped in `.env.example`. No Vercel env var is required:
 * the committed default rules the production bundle (the T-516/T-519
 * pattern). This closes the LAST open value of the T-096 design —
 * `isFcmConfigured` becomes TRUE on a fresh clone, the T-121 env warning
 * silences, and the T-036 first-gesture auto-registration path activates.
 *
 * These tests pin the behaviours that must hold:
 *   1. The committed VAPID default IS the owner-supplied key (exact pin) and
 *      has the VAPID public-key shape (87-char base64url P-256 key).
 *   2. A fresh clone is FCM-CONFIGURED (isFcmConfigured === true) — web push
 *      enabled out of the box for the first time.
 *   3. A fresh clone logs NO FCM env warning — the owner-pasted live warning
 *      ("Missing: NEXT_PUBLIC_FIREBASE_VAPID_KEY") is silenced by design.
 *   4. `.env.example` ships the same VAPID key (parity with the committed
 *      default).
 *   5. initFcm() passes the resolved VAPID key to Firebase's getToken — the
 *      behavioural wire from the committed default to the FCM SDK call.
 *
 * Related: hub `docs/operations/credentials.md` §9.6 (the VAPID row —
 * ISSUED + COMMITTED) · T-519/CONFIG-501 (the cutover this completes) ·
 * T-121/T-096 (the truthfulness guards flipped in the same change) ·
 * PUSH-103/T-036 (the auto-registration path this activates) · PUSH-100
 * (the FCM v1 send side — still owner-gated via
 * FIREBASE_SERVICE_ACCOUNT_JSON on the Supabase project).
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// T-520 / CONFIG-502: the owner-supplied Web Push certificate PUBLIC key
// (verbatim — 87 chars, base64url, no padding; the exact value the new
// Firebase console shows as the key pair's public half).
const OWNER_VAPID_PUBLIC_KEY =
  "BK08KLwqnYj-d6jPE3laBEHvBoR89iqE7i3u-Jssn1NhaiGnniNnUI3Ty_k4Sgqd0QEfWixfNSV4PoynuwWoEo8";

const FCM_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
] as const;

// ── Firebase SDK mocks (for the behavioural initFcm wire test) ─────────────
const { getTokenMock } = vi.hoisted(() => ({ getTokenMock: vi.fn() }));

vi.mock("firebase/app", () => ({
  initializeApp: vi.fn(() => ({ name: "[DEFAULT]" })),
  getApps: vi.fn(() => []),
}));

vi.mock("firebase/messaging", () => ({
  getMessaging: vi.fn(() => ({ _messagingStub: true })),
  isSupported: vi.fn(() => Promise.resolve(true)),
  getToken: getTokenMock,
  onMessage: vi.fn(() => () => {}),
}));

function readSource(relativePath: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 3; i++) {
    try {
      return readFileSync(path.join(dir, relativePath), "utf8");
    } catch {
      dir = path.dirname(dir);
    }
  }
  throw new Error(`source file not found from ${process.cwd()}: ${relativePath}`);
}

describe("T-520 / CONFIG-502 — the owner's Web Push certificate key wires web push live", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const key of FCM_ENV_KEYS) delete process.env[key];
    getTokenMock.mockReset();
  });

  afterEach(() => {
    for (const key of FCM_ENV_KEYS) delete process.env[key];
    getTokenMock.mockReset();
  });

  it("the committed VAPID default IS the owner-supplied Web Push certificate public key (exact pin + shape)", async () => {
    const { PUBLIC_CONFIG_DEFAULTS } = await import("../lib/public-config");
    expect(PUBLIC_CONFIG_DEFAULTS.NEXT_PUBLIC_FIREBASE_VAPID_KEY).toBe(OWNER_VAPID_PUBLIC_KEY);
    // Shape guard: a VAPID public key is an unpadded base64url-encoded
    // P-256 point — exactly 87 chars for the standard 65-byte encoding.
    // A truncated/mangled paste (the owner message carried typos around the
    // key itself) would fail here before it could break getToken at runtime.
    expect(OWNER_VAPID_PUBLIC_KEY).toMatch(/^[A-Za-z0-9_-]{87}$/);
  });

  it("fresh clone (no env vars): FCM is CONFIGURED — isFcmConfigured === true (web push enabled out of the box)", async () => {
    for (const key of FCM_ENV_KEYS) expect(process.env[key]).toBeUndefined();
    const { env, isFcmConfigured } = await import("../lib/env");
    expect(env.NEXT_PUBLIC_FIREBASE_VAPID_KEY).toBe(OWNER_VAPID_PUBLIC_KEY);
    expect(isFcmConfigured).toBe(true);
  });

  it("fresh clone (no env vars): NO FCM env warning — the owner-pasted live warning is silenced", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await import("../lib/env");
      // The production warning the owner pasted (naming ONLY
      // NEXT_PUBLIC_FIREBASE_VAPID_KEY, firing from the live chunk
      // 3rjb7kg1kmm8o.js) is the T-121 operator hint for a MISSING value —
      // with the key committed, it must never fire on a fresh clone again.
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it(".env.example ships the same VAPID key (parity with the committed default)", () => {
    const envExample = readSource(".env.example");
    expect(envExample).toContain(
      `NEXT_PUBLIC_FIREBASE_VAPID_KEY=${OWNER_VAPID_PUBLIC_KEY}`,
    );
  });

  it("initFcm() passes the resolved VAPID key to Firebase's getToken — the behavioural wire", async () => {
    getTokenMock.mockResolvedValue("fcm-token-e2e-stub");
    // jsdom has no service worker / Notification — stub the browser seams
    // initFcm() touches after the permission check (the t-030 pattern).
    // @ts-expect-error — minimal navigator.serviceWorker stub for jsdom
    globalThis.navigator.serviceWorker = {
      register: vi.fn(() => Promise.resolve({ scope: "/" })),
    };
    // @ts-expect-error — minimal Notification stub for jsdom
    globalThis.Notification = {
      permission: "default",
      requestPermission: vi.fn(() => Promise.resolve("granted")),
    };

    const { initFcm } = await import("../lib/fcm");
    const token = await initFcm();

    expect(token).toBe("fcm-token-e2e-stub");
    // The committed default must reach the FCM SDK call verbatim — this is
    // the wire that makes the key pair the owner generated actually usable.
    expect(getTokenMock).toHaveBeenCalledTimes(1);
    expect(getTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ _messagingStub: true }),
      { vapidKey: OWNER_VAPID_PUBLIC_KEY },
    );
  });
});
