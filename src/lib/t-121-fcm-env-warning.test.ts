/**
 * T-121 — actionable FCM env warning regression suite (20th session, 2026-09-02).
 *
 * Problem (owner-pasted console evidence from the production Vercel
 * deployment):
 *   [env] Firebase env vars are incomplete. Push notifications will be disabled.
 * The generic "incomplete" message named NOTHING — the operator could not
 * tell WHICH variables to set or WHERE to set them. For this project the
 * genuinely missing values are the Firebase WEB app id (the known app id is
 * the ANDROID one — a different app in the same Firebase project) and the
 * web-push VAPID key; both are set as deployment-host environment variables
 * (Vercel → Settings → Environment Variables).
 *
 * Fixed: the warning names the EXACT missing variables and says where to set
 * them. Fully-configured FCM (all four vars non-placeholder) stays silent;
 * fully-absent Firebase (no API key) stays silent (push simply disabled).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const FCM_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_VAPID_KEY",
] as const;

describe("T-121 — the FCM env warning is actionable (names the missing vars)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    for (const key of FCM_KEYS) delete process.env[key];
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("fresh-clone defaults (API key set, WEB app id + VAPID missing): warning names both missing vars", async () => {
    await import("./env");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0][0] as string;
    // The two genuinely missing vars are named…
    expect(message).toContain("NEXT_PUBLIC_FIREBASE_APP_ID");
    expect(message).toContain("NEXT_PUBLIC_FIREBASE_VAPID_KEY");
    // …the two PRESENT vars are NOT named (no noise)…
    expect(message).not.toContain("NEXT_PUBLIC_FIREBASE_API_KEY,");
    // …and the operator is told WHERE to set them.
    expect(message).toContain("Vercel");
    expect(message).toContain("Missing:");
  });

  it("fully configured FCM (web app id + VAPID provided): NO warning", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:259221439109:web:abc123";
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = "BP_vapid_test_key_value";
    await import("./env");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("Firebase intentionally unconfigured (API key explicitly placeholder): NO warning — push simply disabled", async () => {
    // The committed default supplies a REAL API key, so "fully absent" is
    // only reachable by explicitly overriding it with a placeholder — e.g.
    // a test/staging build that deliberately opts out of Firebase.
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "your_firebase_api_key_placeholder";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "elimtiyaz-android";
    await import("./env");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
