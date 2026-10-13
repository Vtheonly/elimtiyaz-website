/**
 * T-121 — actionable FCM env warning regression suite (20th session, 2026-09-02).
 *
 * Problem (owner-pasted console evidence from the production Vercel
 * deployment):
 *   [env] Firebase env vars are incomplete. Push notifications will be disabled.
 * The generic "incomplete" message named NOTHING — the operator could not
 * tell WHICH variables to set or WHERE to set them. For this project the
 * genuinely missing value is now (since the T-519 / CONFIG-501 cutover to the
 * `elimtiyaz-production` Firebase project, 2026-10-13) ONLY the web-push VAPID
 * key: the WEB app id is committed in public-config.ts. Before T-519 BOTH the
 * web app id and the VAPID key were missing (the old `elimtiyaz-android`
 * project had no web app registered).
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

  it("fresh-clone defaults (API key + project id + WEB app id set, VAPID missing): warning names ONLY the VAPID key", async () => {
    await import("./env");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0][0] as string;
    // T-519 / CONFIG-501 (2026-10-13): the committed defaults now carry the
    // NEW project's web app id — the one genuinely missing var is named…
    expect(message).toContain("NEXT_PUBLIC_FIREBASE_VAPID_KEY");
    // …the three PRESENT vars are NOT named (no noise — the app id was the
    // co-missing var before the T-519 cutover; asserting its absence pins
    // the cutover against regression)…
    expect(message).not.toContain("NEXT_PUBLIC_FIREBASE_APP_ID");
    expect(message).not.toContain("NEXT_PUBLIC_FIREBASE_API_KEY,");
    // …and the operator is told WHERE to set it.
    expect(message).toContain("Vercel");
    expect(message).toContain("Missing:");
  });

  it("fully configured FCM (web app id + VAPID provided): NO warning", async () => {
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:944201689219:web:abc123";
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY = "BP_vapid_test_key_value";
    await import("./env");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("Firebase intentionally unconfigured (API key explicitly placeholder): NO warning — push simply disabled", async () => {
    // The committed default supplies a REAL API key, so "fully absent" is
    // only reachable by explicitly overriding it with a placeholder — e.g.
    // a test/staging build that deliberately opts out of Firebase.
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "your_firebase_api_key_placeholder";
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "another-firebase-project";
    await import("./env");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
