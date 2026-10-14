"use client";

/**
 * ParticleCanvas — website port of the desktop's React wrapper around the
 * `ParticleEngine` (T-530 / UI-344).
 *
 * Verbatim port of `AgentGithubUplaod/elimtiyaz-desktop/src/shared/ui/
 * particle-canvas.tsx` (introduced b25e6caa, last touched 6bba62b4) with
 * exactly FOUR documented website-specific adaptations — the engine itself
 * (src/lib/particle-engine/) is byte-equivalent and must stay so:
 *
 *   1. `cn` resolves from `@/lib/utils` (the portal's tailwind-merge helper,
 *      same behaviour as the desktop's `shared/ui/cn`).
 *   2. `INTRO_LOGO_SRC` is the Next.js public-asset absolute path
 *      `/intro-logo.png` — the EXACT desktop brand asset copied
 *      byte-identical (md5 a1efb238f3c433968f6b267db9b8cb9e) into this
 *      repo's `public/` folder. Never recreate, replace, or approximate it.
 *   3. Pointer events (`pointermove` / `pointerleave` / `pointercancel`)
 *      instead of the desktop's mouse events — the portal is mobile-first;
 *      pointer events cover mouse, touch, and pen with one code path.
 *   4. `prefers-reduced-motion` + resize resilience, both WEBSITE-ONLY
 *      gates at this wrapper level (the desktop does not need them):
 *      reduced-motion users get no animation loop at all (the field is
 *      purely decorative and `aria-hidden`), and a significant container
 *      resize (orientation change / breakpoint crossing) tears the engine
 *      down and re-initializes at the new dimensions.
 *
 * The component degrades gracefully: if the host environment cannot provide
 * a 2D canvas context (jsdom during tests), it renders an empty canvas and
 * skips the engine setup — no errors thrown.
 */

import { useEffect, useRef, useState } from "react";
import { ParticleEngine, DEFAULT_PALETTE } from "@/lib/particle-engine";
import type { ImageSource, LogoMode, Palette, PhysicsConfig } from "@/lib/particle-engine";
import { cn } from "@/lib/utils";

/**
 * The brand pictogram — `public/intro-logo.png`, the byte-identical copy of
 * the desktop's `elimtiyaz-desktop/public/intro-logo.png`. NOTE: the file is
 * JPEG data under a `.png` name — intentional, browsers content-sniff the
 * real format, do NOT "fix" the extension (re-encoding would break the
 * byte-identity the brand mandate requires).
 */
export const INTRO_LOGO_SRC = "/intro-logo.png";

export interface ParticleCanvasProps {
  /**
   * Optional URL of the image whose dark pixels seed the particle field.
   * Defaults to the brand asset (`/intro-logo.png` — the desktop's exact
   * logo). Pass `""` (or an explicit `source`) to skip the static file — an
   * empty string resolves to `source` when provided, else the built-in EI
   * monogram fallback.
   */
  imageSrc?: string;
  /** Full image source object ({ url, buffer, fallback }) — used when `imageSrc` is absent. */
  source?: ImageSource;
  /** Initial animation mode (default `logo`). */
  mode?: LogoMode;
  /** Palette override (defaults to the brand palette). */
  palette?: Palette;
  /** Physics overrides. */
  physics?: PhysicsConfig;
  /** Sample density (lower = more particles, default 3). */
  density?: number;
  /** Canvas fill ratio (0–1, default 0.7). */
  fillRatio?: number;
  /** Luminance threshold (0-255, default 128). Pixels darker than this become particles. */
  luminanceThreshold?: number;
  /** Enable pointer-reactive repulsion (default true). */
  interactive?: boolean;
  /** Optional className for the canvas element. */
  className?: string;
  /** Called once when particles are seeded and the first frame is rendered. */
  onReady?: () => void;
}

/** A resize larger than this fraction (in either dimension) re-inits the engine. */
const RESIZE_THRESHOLD = 0.2;

export function ParticleCanvas({
  imageSrc = INTRO_LOGO_SRC,
  source,
  mode = "logo",
  palette = DEFAULT_PALETTE,
  physics,
  density = 3,
  fillRatio = 0.7,
  luminanceThreshold = 128,
  interactive = true,
  className,
  onReady,
}: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  /* Re-mount tick for the resize path (adaptation 4): bumping this state
   * re-runs the effect below with a fresh engine at the new dimensions. */
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    /* Website-only gate (adaptation 4): respect prefers-reduced-motion —
     * the particle field is decorative, so reduced-motion users simply get
     * no animation (blank transparent canvas, page background shows). */
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let width = 0;
    let height = 0;

    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let engine: ParticleEngine | null = null;
    let rafId = 0;
    let disposed = false;
    let readyFired = false;

    // Resolve image source: `imageSrc` string → custom source → fallback pattern.
    // Default is the brand asset (`/intro-logo.png` in `public/`). Until that
    // file exists the load fails and we retry with the built-in EI monogram
    // so the canvas never blanks. An empty string skips the static file and
    // resolves to `source` when provided, else the monogram.
    const trimmedSrc = imageSrc?.trim() ?? "";
    const primarySource: ImageSource =
      trimmedSrc.length > 0 ? { url: trimmedSrc } : (source ?? { fallback: true });
    const canFallBack = !primarySource.fallback;

    const physicsConfig = physics ?? {
      damping: 0.86,
      stiffnessRange: [0.06, 0.1] as [number, number],
      sizeRange: [1.4, 2.6] as [number, number],
      colorProbabilities: [0.7, 0.18, 0.12] as [number, number, number],
    };

    const startLoop = () => {
      if (disposed) return;
      setReady(true);
      if (!readyFired) {
        readyFired = true;
        onReady?.();
      }

      const loop = () => {
        if (disposed) return;
        const frame = engine?.step();
        if (frame && engine) {
          ctx.fillStyle = "rgba(36, 37, 38, 0.22)";
          ctx.fillRect(0, 0, width, height);
          for (const p of frame.particles) {
            const [r, g, b] = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.92)`;
            ctx.fill();
          }
        }
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    };

    const measure = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(rect.width, 240);
      height = Math.max(rect.height, 240);
    };

    const sizeCanvas = () => {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const initWithFallback = async () => {
      engine = new ParticleEngine();
      try {
        await engine.initialize({
          pipeline: {
            source: primarySource,
            canvasWidth: width,
            canvasHeight: height,
            density,
            luminanceThreshold,
            fillRatio,
            palette,
          },
          physics: physicsConfig,
          interaction: {
            radius: 90,
            force: 5,
            pointerX: null,
            pointerY: null,
            active: false,
          },
          initialMode: mode,
          background: "rgba(36, 37, 38, 0.22)",
        });
      } catch (err) {
        if (!canFallBack || disposed) {
          // No canvas support (jsdom) or already unmounted — degrade to an
          // empty canvas; the host screen renders its own brand overlay.
          console.error("ParticleEngine init failed:", err);
          return;
        }
        // Static asset missing/unloadable — retry with the built-in monogram.
        console.warn(
          `ParticleCanvas: image "${trimmedSrc}" failed to load, falling back to EI monogram.`,
          err,
        );
        try {
          await engine.initialize({
            pipeline: {
              source: { fallback: true },
              canvasWidth: width,
              canvasHeight: height,
              density,
              luminanceThreshold,
              fillRatio,
              palette,
            },
            physics: physicsConfig,
            interaction: {
              radius: 90,
              force: 5,
              pointerX: null,
              pointerY: null,
              active: false,
            },
            initialMode: mode,
            background: "rgba(36, 37, 38, 0.22)",
          });
        } catch (fallbackErr) {
          // Fallback needs canvas 2D too (jsdom) — degrade to empty canvas.
          console.error("ParticleEngine fallback init failed:", fallbackErr);
          return;
        }
      }
      startLoop();
    };

    measure();
    sizeCanvas();
    void initWithFallback();

    /* Website-only (adaptation 4): re-initialize on a significant container
     * resize (orientation change, breakpoint crossing). The desktop wrapper
     * measures once and never re-measures; the portal is responsive, so a
     * >20% dimension change tears the engine down and rebuilds it at the
     * new size. Debounced one animation frame. */
    let resizeRaf = 0;
    const onResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        if (disposed) return;
        const rect = container.getBoundingClientRect();
        const nextW = Math.max(rect.width, 240);
        const nextH = Math.max(rect.height, 240);
        const dw = Math.abs(nextW - width) / Math.max(width, 1);
        const dh = Math.abs(nextH - height) / Math.max(height, 1);
        if (dw < RESIZE_THRESHOLD && dh < RESIZE_THRESHOLD) return;
        disposed = true;
        cancelAnimationFrame(rafId);
        engine?.destroy();
        // Re-enter the setup path with a fresh closure via a state tick.
        setReady(false);
        readyFired = false;
        setResizeTick((n) => n + 1);
      });
    };
    /* Guarded: ResizeObserver is missing in jsdom (tests) and very old
     * browsers — without the guard the component would throw there. */
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(onResize);
      observer.observe(container);
    }

    const onPointerMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      engine?.setInteraction({
        pointerX: e.clientX - r.left,
        pointerY: e.clientY - r.top,
        active: true,
      });
    };
    const onPointerLeave = () => {
      engine?.setInteraction({ pointerX: null, pointerY: null, active: false });
    };
    const onPointerCancel = () => {
      engine?.setInteraction({ pointerX: null, pointerY: null, active: false });
    };
    if (interactive) {
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerleave", onPointerLeave);
      canvas.addEventListener("pointercancel", onPointerCancel);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      observer?.disconnect();
      if (interactive) {
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        canvas.removeEventListener("pointercancel", onPointerCancel);
      }
      engine?.destroy();
    };
  }, [imageSrc, source, mode, palette, physics, density, fillRatio, luminanceThreshold, interactive, onReady, resizeTick]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className={cn("block h-full w-full", ready && "transition-opacity duration-700", className)}
        aria-hidden
      />
    </div>
  );
}
