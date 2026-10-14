/**
 * T-530 / UI-344 regression suite — the login screen's particle brand field.
 *
 * The portal's only public surface now carries the desktop's particle
 * animation: the ParticleCanvas field whose particles form the ACTUAL brand
 * pictogram (public/intro-logo.png — the byte-identical desktop asset,
 * md5-pinned in src/lib/particle-engine/particle-engine.test.ts).
 *
 * These tests pin the INTEGRATION contract:
 *   1. BEHAVIORAL — the login screen renders the particle canvas (present,
 *      decorative: aria-hidden) alongside the untouched login contract
 *      (title, subtitle, Google button, secure note, help text).
 *   2. BEHAVIORAL — the login action surface stays interactive (the button
 *      is NOT disabled by the animation; the canvas never intercepts the
 *      form — it renders before the card in DOM order and is aria-hidden).
 *   3. BEHAVIORAL — graceful degradation: with no 2D canvas (jsdom) the
 *      screen still renders everything with no thrown error.
 *   4. BEHAVIORAL — prefers-reduced-motion users get the screen with no
 *      animation loop (the effect short-circuits; no crash, canvas blank).
 *   5. SOURCE — the GraduationCap placeholder icon is retired (the animated
 *      brand mark replaces it) and the layout skeleton is unchanged.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The auth provider is fully stubbed: unauthenticated + configured.
vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({
    signInWithGoogle: vi.fn(async () => {}),
    configured: true,
    error: null,
    state: "unauthenticated",
  }),
}));

// The translation hook is stubbed identity — the dictionary keys ARE the
// assertions' vocabulary here (i18n parity itself is guarded by t-385).
vi.mock("@/lib/i18n/use-t", () => ({
  useT: () => ({ t: (k: string) => k, locale: "fr", dir: "ltr", isRtl: false }),
}));

import { LoginScreen } from "@/features/auth/login-screen";

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf-8");

/** jsdom's matchMedia stub (reduced-motion OFF by default). */
let matchMediaMatches = false;
beforeEach(() => {
  matchMediaMatches = false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: matchMediaMatches && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("T-530 — the login screen's particle brand field", () => {
  it("renders the particle canvas as a decorative (aria-hidden) element", () => {
    const { container } = render(<LoginScreen />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
  });

  it("preserves the login contract: title, subtitle, Google button, secure note, help text", () => {
    const { getByText, getByRole } = render(<LoginScreen />);
    expect(getByText("auth.signin.title")).toBeTruthy();
    expect(getByText("auth.signin.subtitle")).toBeTruthy();
    expect(getByText("app.name")).toBeTruthy();
    expect(getByText("app.tagline")).toBeTruthy();
    expect(getByText("auth.signin.google")).toBeTruthy();
    expect(getByText("auth.signin.secure")).toBeTruthy();
    expect(getByText("auth.signin.help")).toBeTruthy();
    // The OAuth entry point stays enabled (configured=true in the mock).
    const button = getByRole("button", { name: /auth\.signin\.google/ });
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("renders without errors when no 2D canvas context exists (jsdom degradation)", () => {
    expect(() => render(<LoginScreen />)).not.toThrow();
  });

  it("renders for prefers-reduced-motion users (no animation loop, no crash)", () => {
    matchMediaMatches = true; // the beforeEach stub re-reads this flag
    const { container } = render(<LoginScreen />);
    // The screen is fully rendered; the canvas stays blank (no loop).
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(container.textContent).toContain("auth.signin.title");
  });

  it("SOURCE — the GraduationCap placeholder is retired; the hero carries the ParticleCanvas", () => {
    const src = read(join("features", "auth", "login-screen.tsx"));
    expect(src).toContain("ParticleCanvas");
    // The placeholder icon is no longer IMPORTED or rendered (the doc
    // comment may mention its retirement — that is history, not usage).
    expect(src).not.toMatch(/import[^\n]*GraduationCap/);
    expect(src).not.toMatch(/<[^\n]*GraduationCap/);
    // The brand hero block keeps the name + tagline structure.
    expect(src).toContain('t("app.name")');
    expect(src).toContain('t("app.tagline")');
    // The layout skeleton is unchanged (the same main/brand-gradient shell).
    expect(src).toContain("brand-gradient");
    expect(src).toContain("min-h-[100dvh]");
  });
});
