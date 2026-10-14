/**
 * T-531 / UI-345 regression suite — the visual-polish + widescreen layer.
 *
 * The owner's mandate (presentation-only): polish the portal's appearance,
 * give it a proper desktop-widescreen layout, and bring the loading
 * animation + progress bars up to the same standard — preserving branding,
 * logo, colours, functionality, and the underlying logic.
 *
 * This suite pins the INTEGRATION contracts:
 *
 *   1. BEHAVIORAL — the splash (auth "loading" state) renders the BRAND
 *      mark (the particle canvas, decorative) + the static fallback layer
 *      (the same byte-identical asset) + an indeterminate progress bar with
 *      progressbar semantics (aria-busy, NO aria-valuenow — the value is
 *      unknown during auth bootstrap) + the localized loading label.
 *   2. BEHAVIORAL — the splash renders for prefers-reduced-motion users
 *      (no animation loop, no crash — the static mark is the presentation).
 *   3. BEHAVIORAL — the shared Progress component: progressbar role, the
 *      clamped aria-valuenow, the accessible label, the tone variant, and
 *      the width style (the fill percentage).
 *   4. SOURCE — the login's widescreen split (the desktop-mirrored two
 *      panel layout) + the polish layer (ambient grid, entrance, card
 *      glow, button glow, the desktop-style version footer) while the
 *      T-530 skeleton pins (brand-gradient + min-h-[100dvh]) still hold.
 *   5. SOURCE — the financial view uses the ONE shared Progress component
 *      (both inline hand-rolled bars retired; the domain computation —
 *      progress = … — stays at the call sites).
 *   6. SOURCE — the widescreen container ladder across the eight views
 *      (progressive max-w at xl/2xl + responsive gutters; the standard
 *      width max-w-5xl/6xl/7xl bases preserved for T-327 parity).
 *   7. SOURCE — the CSS layer: the motion keyframes, the shared progress
 *      utilities, the skeleton shimmer, and the GLOBAL prefers-reduced-
 *      motion guard that freezes every animation this task introduced.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The auth provider is fully stubbed: the LOADING state (the splash branch).
vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({
    state: "loading",
    signInWithGoogle: vi.fn(async () => {}),
    configured: true,
    error: null,
    user: null,
    children: [],
    refresh: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
  }),
}));

// The translation hook is stubbed identity — the dictionary keys ARE the
// assertions' vocabulary here (i18n parity itself is guarded by t-385).
vi.mock("@/lib/i18n/use-t", () => ({
  useT: () => ({ t: (k: string) => k, locale: "fr", dir: "ltr", isRtl: false }),
}));

import Home from "@/app/page";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

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

describe("T-531 — the splash screen (the branded loading state)", () => {
  it("renders the particle brand mark + the static fallback layer (the same asset)", () => {
    const { container } = render(<Home />);
    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute("aria-hidden")).toBe("true");
    // The static brand-mark layer: the byte-identical asset, CSS-blended.
    const img = container.querySelector('img[src="/intro-logo.png"]');
    expect(img).not.toBeNull();
    expect(img?.getAttribute("aria-hidden") === null || img?.alt === "").toBe(
      true,
    );
  });

  it("renders the indeterminate progress bar with progressbar semantics (no aria-valuenow)", () => {
    const { getByRole, getByText } = render(<Home />);
    const bar = getByRole("progressbar");
    expect(bar.getAttribute("aria-busy")).toBe("true");
    expect(bar.getAttribute("aria-label")).toBe("app.loading");
    // Indeterminate by definition — a fabricated value would be a lie.
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    // The sweeping bar (the motion) + the localized label.
    expect(bar.querySelector(".progress-bar-sweep")).not.toBeNull();
    expect(getByText("app.loading")).toBeTruthy();
    expect(getByText("app.portal")).toBeTruthy();
  });

  it("renders for prefers-reduced-motion users (no loop, no crash — the static mark is the presentation)", () => {
    matchMediaMatches = true;
    const { container } = render(<Home />);
    expect(container.querySelector("canvas")).not.toBeNull();
    expect(
      container.querySelector('img[src="/intro-logo.png"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("app.loading");
  });

  it("SOURCE — the GraduationCap placeholder is retired from the splash; the shell keeps its pins", () => {
    const src = read(join("app", "page.tsx"));
    expect(src).not.toMatch(/import[^\n]*GraduationCap/);
    expect(src).not.toMatch(/<[^\n]*GraduationCap/);
    expect(src).toContain("ParticleCanvas");
    expect(src).toContain("brand-gradient");
    expect(src).toContain("min-h-[100dvh]");
    expect(src).toContain("brand-grid-overlay");
    expect(src).toContain("progress-bar-sweep");
    // No new i18n keys: the loading state reuses the existing dictionary.
    expect(src).toContain('t("app.loading")');
    expect(src).toContain('t("app.portal")');
  });
});

describe("T-531 — the shared Progress component (the one determinate bar)", () => {
  it("exposes progressbar semantics: role, clamped aria-valuenow, label, width", () => {
    const { getByRole } = render(
      <Progress value={42} aria-label="Tranche 1" />,
    );
    const bar = getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-label")).toBe("Tranche 1");
    const fill = bar.querySelector(".progress-fill");
    expect(fill).not.toBeNull();
    expect(fill?.getAttribute("style")).toContain("width: 42%");
  });

  it("clamps out-of-range and non-finite values (the fill can never overflow the track)", () => {
    const { getByRole, rerender } = render(
      <Progress value={150} aria-label="x" />,
    );
    expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
    rerender(<Progress value={-10} aria-label="x" />);
    expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    rerender(<Progress value={Number.NaN} aria-label="x" />);
    expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    rerender(<Progress value={Number.POSITIVE_INFINITY} aria-label="x" />);
    expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });

  it("carries the success tone variant (the settled rows)", () => {
    const { container } = render(
      <Progress value={100} tone="success" aria-label="x" />,
    );
    expect(container.querySelector(".progress-fill-success")).not.toBeNull();
  });
});

describe("T-531 — the login's widescreen split + polish (source contract)", () => {
  const src = read(join("features", "auth", "login-screen.tsx"));

  it("mirrors the DESKTOP's full-bleed side-panel split at lg", () => {
    // The grid split (the desktop's `lg:grid-cols-[1fr_400px]` mirrored —
    // the brand panel OWNS its column edge-to-edge, full height).
    expect(src).toMatch(/lg:grid-cols-\[/);
    expect(src).toContain("lg:grid");
    expect(src).toContain("lg:h-full lg:justify-between");
    // The panel surface + the divider (the desktop's bordered bg-surface
    // side-panel, translated to the portal's card tokens).
    expect(src).toContain("lg:border-r");
    expect(src).toContain("lg:bg-card/40");
    // The field grows with the viewport HEIGHT (the desktop's h-[50vh]
    // rhythm) and the wordmark scales up on big displays.
    expect(src).toContain("lg:h-[44vh]");
    expect(src).toContain("2xl:text-5xl");
    // The wordmark rises above the field on desktop (the desktop's header
    // pattern) via the order flip.
    expect(src).toMatch(/order-2 lg:order-1/);
    expect(src).toMatch(/lg:order-2 lg:h-\[44vh\]/);
  });

  it("carries the polish layer: ambient grid, entrance, card glow, button glow, static mark, version footer", () => {
    expect(src).toContain("brand-grid-overlay");
    expect(src).toContain("animate-fade-up");
    expect(src).toContain("card-glow");
    expect(src).toContain("btn-glow");
    expect(src).toContain("brand-text-gradient");
    expect(src).toContain('src="/intro-logo.png"');
    expect(src).toContain("invert mix-blend-screen");
    expect(src).toContain('t("app.version")');
  });

  it("keeps the T-530 contract pins (the shell + the brand field)", () => {
    expect(src).toContain("brand-gradient");
    expect(src).toContain("min-h-[100dvh]");
    expect(src).toContain("ParticleCanvas");
    expect(src).toContain('t("app.name")');
    expect(src).toContain('t("app.tagline")');
    expect(src).not.toMatch(/import[^\n]*GraduationCap/);
  });
});

describe("T-531 — the financial view's two inline bars retired (the §9 reuse rule)", () => {
  const src = read(join("features", "financial", "financial-view.tsx"));

  it("imports and renders the ONE shared Progress component twice", () => {
    expect(src).toContain('from "@/components/ui/progress"');
    expect(src.match(/<Progress\b/g)?.length).toBe(2);
  });

  it("retires both hand-rolled inline track/fill pairs (no parallel implementation)", () => {
    expect(src).not.toMatch(/className="[^"]*rounded-full bg-muted"/);
    expect(src).not.toMatch(/bg-primary transition-all duration-500/);
  });

  it("keeps the domain computation at the call sites (presentation-only swap)", () => {
    expect(src).toMatch(/const progress =/);
    expect(src).toMatch(/tone=\{settled \? "success" : "brand"\}/);
  });
});

describe("T-531 — the widescreen container ladder (the eight views)", () => {
  const ladder = [
    "features/academic/academic-view.tsx",
    "features/attendance/attendance-view.tsx",
    "features/homework/homework-view.tsx",
    "features/calendar/calendar-view.tsx",
    "features/timetable/timetable-view.tsx",
    "features/messages/messages-view.tsx",
  ];
  const widened = [
    "features/financial/financial-view.tsx",
    "features/dashboard/dashboard-view.tsx",
  ];

  it.each(ladder)("progressive widths + responsive gutters: %s", (p) => {
    const src = read(p);
    expect(src).toContain("xl:max-w-6xl");
    expect(src).toContain("2xl:max-w-7xl");
    expect(src).toContain("sm:px-6");
    expect(src).toContain("lg:px-8");
    // The T-327 base width survives (standard screens unchanged).
    expect(src).toContain("max-w-5xl");
  });

  it.each(widened)("the already-wide views widen further at 2xl: %s", (p) => {
    const src = read(p);
    expect(src).toContain("2xl:max-w-[1440px]");
    expect(src).toContain("lg:px-8");
  });
});

describe("T-531 — the CSS layer (motion, shared progress utilities, the global guard)", () => {
  const css = read(join("app", "globals.css"));

  it("defines the motion keyframes", () => {
    expect(css).toContain("@keyframes fade-up");
    expect(css).toContain("@keyframes progress-sweep");
    expect(css).toContain("@keyframes progress-shimmer");
  });

  it("defines the shared utilities (the one progress language + the polish surfaces)", () => {
    expect(css).toMatch(/\.brand-grid-overlay\s*\{/);
    expect(css).toMatch(/\.brand-text-gradient\s*\{/);
    expect(css).toMatch(/\.card-glow\s*\{/);
    expect(css).toMatch(/\.btn-glow\s*\{/);
    expect(css).toMatch(/\.progress-track\s*\{/);
    expect(css).toMatch(/\.progress-bar-sweep\s*\{/);
    expect(css).toMatch(/\.progress-fill\s*\{/);
    expect(css).toMatch(/\.progress-fill-success\s*\{/);
    expect(css).toMatch(/\.skeleton-shimmer\s*\{/);
    expect(css).toMatch(/\.animate-fade-up\s*\{/);
  });

  it("the brand-gradient keeps its identity (the tokens) and gains the bottom anchor glow", () => {
    // The two original radials byte-identical…
    expect(css).toContain(
      "radial-gradient(1200px 600px at 10% -10%, color-mix(in srgb, var(--primary) 25%, transparent), transparent)",
    );
    expect(css).toContain(
      "radial-gradient(900px 500px at 110% 10%, color-mix(in srgb, var(--info) 18%, transparent), transparent)",
    );
    // …plus the third (T-531).
    expect(css).toContain(
      "radial-gradient(1100px 700px at 50% 118%, color-mix(in srgb, var(--primary) 14%, transparent), transparent)",
    );
  });

  it("the GLOBAL prefers-reduced-motion guard freezes every introduced animation", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.progress-bar-sweep[\s\S]*animation: none/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*skeleton-shimmer::after/,
    );
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*scroll-behavior: auto/,
    );
  });

  it("the skeleton swapped the flat pulse for the brand shimmer sweep", () => {
    const skeleton = read(join("components", "ui", "skeleton.tsx"));
    expect(skeleton).toContain('cn("skeleton-shimmer rounded-md", className)');
    // The CLASS is retired (the doc comment may mention the history — that
    // is not usage).
    expect(skeleton).not.toMatch(/className=\{cn\([^)]*animate-pulse/);
    // Behavioral: the rendered element carries the shimmer, not the pulse.
    const { container } = render(<Skeleton className="h-4 w-full" />);
    const el = container.querySelector("[data-slot=skeleton]");
    expect(el?.className).toContain("skeleton-shimmer");
    expect(el?.className).not.toContain("animate-pulse");
  });
});
