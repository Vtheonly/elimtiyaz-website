/**
 * T-530 / UI-344 regression suite — the website port of the desktop
 * ParticleEngine (src/lib/particle-engine/, the verbatim §9 port).
 *
 * The engine files are byte-equivalent to the desktop's
 * `elimtiyaz-desktop/src/shared/particle-engine/**` — these tests pin the
 * ported BEHAVIOUR (pure functions only; the canvas-dependent pipeline
 * stages degrade gracefully in jsdom and are covered by the integration
 * suite in src/test/t-530-login-particle-identity.test.tsx):
 *
 *   1. SAMPLER — dark-pixel detection, density stepping, threshold, and
 *      the invalid-dimension guard.
 *   2. PROJECTOR — aspect-preserving uniform scale + centering (the
 *      geometry that makes the logo render undistorted).
 *   3. PHYSICS — spawn scatter bounds, spring convergence to target,
 *      pointer repulsion, frame rounding.
 *   4. MORPHING — logo-mode target reset (logoX/logoY authority).
 *   5. ENGINE — config validation + destroy semantics.
 *   6. ASSET — the brand pictogram public/intro-logo.png is the EXACT
 *      desktop asset, byte-identical (md5-pinned — replacing, re-encoding,
 *      or "fixing" the JPEG-under-.png-name file fails here).
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { samplePixels, type SamplePoint } from "./pipeline/sampler";
import { projectPoints } from "./pipeline/projector";
import { createParticle, updateParticle, toFrameData, DEFAULT_PHYSICS } from "./physics/particle";
import { updateTargets } from "./physics/morphing";
import { ParticleEngine } from "./engine";
import { ConfigError, ImageLoadError, SamplingError, ProjectionError } from "./errors";
import { DEFAULT_PALETTE, type Palette, type ParticleState } from "./types";
import { exciteColor, relaxColor, roundColor, luminance } from "./color-interpolator";
import { INTRO_LOGO_SRC } from "@/components/particle-canvas";

/* ─── 1. Sampler ─────────────────────────────────────────────────────────── */

/** Build a RGBA buffer: white everywhere except the given dark pixels. */
function whiteBufferWith(w: number, h: number, dark: Array<[number, number]>) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  for (const [x, y] of dark) {
    const idx = (y * w + x) * 4;
    data[idx] = 0;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
  }
  return data;
}

describe("T-530 — pipeline sampler (dark-pixel seeding)", () => {
  it("finds exactly the dark pixels at density 1", () => {
    const res = samplePixels(whiteBufferWith(4, 4, [[1, 1], [3, 2]]), 4, 4, {
      density: 1,
      luminanceThreshold: 128,
    });
    expect(res.darkPixelCount).toBe(2);
    expect(res.totalScanned).toBe(16);
    const pts = res.points.map((p: SamplePoint) => `${p.x},${p.y}`).sort();
    expect(pts).toEqual(["1,1", "3,2"]);
    expect(res.points[0].luminance).toBe(0);
  });

  it("steps by the density interval (density 2 on a 4×4 grid scans 4 pixels)", () => {
    const res = samplePixels(whiteBufferWith(4, 4, [[0, 0]]), 4, 4, { density: 2 });
    expect(res.totalScanned).toBe(4);
    expect(res.darkPixelCount).toBe(1);
  });

  it("treats threshold-adjacent luminance correctly (strictly below threshold)", () => {
    // Luminance 128 = (128+128+128)/3 → NOT below the 128 threshold.
    const data = new Uint8ClampedArray(4).fill(128);
    const res = samplePixels(data, 1, 1, { density: 1, luminanceThreshold: 128 });
    expect(res.darkPixelCount).toBe(0);
  });

  it("throws SamplingError on invalid dimensions", () => {
    expect(() => samplePixels(new Uint8ClampedArray(0), 0, 0)).toThrow(SamplingError);
  });
});

/* ─── 2. Projector ───────────────────────────────────────────────────────── */

describe("T-530 — projector (aspect-preserving scale + centering)", () => {
  it("scales uniformly and centers the sampled image on the canvas", () => {
    const pts: SamplePoint[] = [
      { x: 0, y: 0, luminance: 0 },
      { x: 10, y: 0, luminance: 0 },
      { x: 0, y: 10, luminance: 0 },
    ];
    const res = projectPoints(pts, 10, 10, { canvasWidth: 100, canvasHeight: 100, fillRatio: 0.7 });
    expect(res.scale).toBe(7); // min(100*0.7/10, 100*0.7/10)
    expect(res.offsetX).toBe(15); // (100 - 10*7) / 2
    expect(res.offsetY).toBe(15);
    expect(res.points[0]).toMatchObject({ x: 15, y: 15 });
    expect(res.points[1]).toMatchObject({ x: 85, y: 15 }); // 10*7 + 15
    expect(res.points[2]).toMatchObject({ x: 15, y: 85 });
  });

  it("preserves the aspect ratio with a non-square canvas (uniform scale = the min)", () => {
    const pts: SamplePoint[] = [
      { x: 0, y: 0, luminance: 0 },
      { x: 20, y: 10, luminance: 0 },
    ];
    // 20×10 source onto 200×80 canvas at 0.7: scale = min(140/20=7, 56/10=5.6) = 5.6
    const res = projectPoints(pts, 20, 10, { canvasWidth: 200, canvasHeight: 80, fillRatio: 0.7 });
    expect(res.scale).toBeCloseTo(5.6, 10);
    // The projected width is 20*5.6 = 112 → offset (200-112)/2 = 44.
    expect(res.offsetX).toBeCloseTo(44, 10);
    expect(res.points[1].x - res.points[0].x).toBeCloseTo(20 * 5.6, 10);
    expect(res.points[1].y - res.points[0].y).toBeCloseTo(10 * 5.6, 10);
  });

  it("throws ProjectionError on invalid canvas dimensions", () => {
    expect(() =>
      projectPoints([{ x: 0, y: 0, luminance: 0 }], 10, 10, { canvasWidth: 0, canvasHeight: 10 }),
    ).toThrow(ProjectionError);
  });
});

/* ─── 3. Physics ─────────────────────────────────────────────────────────── */

describe("T-530 — particle physics (spring + repulsion)", () => {
  it("spawns scattered around the target within ±100px and records the logo position", () => {
    for (let i = 0; i < 50; i++) {
      const p = createParticle(i, 500, 400, DEFAULT_PALETTE, {});
      expect(Math.abs(p.x - 500)).toBeLessThanOrEqual(100);
      expect(Math.abs(p.y - 400)).toBeLessThanOrEqual(100);
      expect(p.targetX).toBe(500);
      expect(p.targetY).toBe(400);
      expect(p.logoX).toBe(500); // logo authority for morph-back
      expect(p.logoY).toBe(400);
      expect(p.baseSize).toBeGreaterThanOrEqual(DEFAULT_PHYSICS.sizeRange[0]);
      expect(p.baseSize).toBeLessThanOrEqual(DEFAULT_PHYSICS.sizeRange[1]);
    }
  });

  it("assigns base colors from the palette only", () => {
    const palette: Palette = { primary: [1, 2, 3], deep: [4, 5, 6], accent: [7, 8, 9] };
    for (let i = 0; i < 60; i++) {
      const p = createParticle(i, 0, 0, palette, {});
      expect([palette.primary, palette.deep, palette.accent]).toContainEqual(p.baseColor);
    }
  });

  it("converges toward its target under the spring force (no interaction)", () => {
    const p = createParticle(0, 300, 300, DEFAULT_PALETTE, {});
    const dist0 = Math.hypot(p.x - p.targetX, p.y - p.targetY);
    const none = { radius: 90, force: 5, pointerX: null, pointerY: null, active: false };
    for (let i = 0; i < 200; i++) updateParticle(p, none, {});
    const dist1 = Math.hypot(p.x - p.targetX, p.y - p.targetY);
    expect(dist1).toBeLessThan(dist0);
    expect(dist1).toBeLessThan(1); // settled on the target
  });

  it("repels from an active pointer inside the radius", () => {
    const p: ParticleState = createParticle(0, 100, 100, DEFAULT_PALETTE, {});
    p.x = 100;
    p.y = 100;
    p.vx = 0;
    p.vy = 0;
    const pointer = { radius: 90, force: 5, pointerX: 100, pointerY: 100, active: true };
    // Pointer exactly on the particle: force = (90-0)/90 = 1 → strong push.
    updateParticle(p, pointer, {});
    expect(Math.hypot(p.vx, p.vy)).toBeGreaterThan(0);
    // Pushed AWAY from the pointer: position moved off (100,100).
    expect(Math.hypot(p.x - 100, p.y - 100)).toBeGreaterThan(0);
  });

  it("relaxes colour and size back to base when the pointer is inactive", () => {
    const p: ParticleState = createParticle(0, 0, 0, DEFAULT_PALETTE, {});
    p.color = [255, 255, 255];
    p.size = p.baseSize * 5;
    const none = { radius: 90, force: 5, pointerX: null, pointerY: null, active: false };
    for (let i = 0; i < 300; i++) updateParticle(p, none, {});
    // The relax lerp is asymptotic — assert convergence, not exact equality.
    for (let c = 0; c < 3; c++) {
      expect(p.color[c]).toBeCloseTo(p.baseColor[c], 5);
    }
    expect(p.size).toBeCloseTo(p.baseSize, 5);
  });

  it("rounds frame colours to integers", () => {
    const p: ParticleState = createParticle(0, 0, 0, DEFAULT_PALETTE, {});
    p.color = [1.4, 2.5, 3.6];
    const f = toFrameData(p);
    expect(f.color).toEqual([1, 3, 4]); // Math.round per channel
    expect(f).toMatchObject({ id: 0, x: p.x, y: p.y, size: p.size });
  });
});

/* ─── 4. Morphing ────────────────────────────────────────────────────────── */

describe("T-530 — morphing (logo-mode authority)", () => {
  it("logo mode resets every target to the sampled logo position", () => {
    const particles = [createParticle(0, 10, 20, DEFAULT_PALETTE, {}), createParticle(1, 30, 40, DEFAULT_PALETTE, {})];
    // Scatter the targets first via circular mode.
    updateTargets(particles, "circular", 200, 200, Date.now(), {}, {}, { value: 0 });
    updateTargets(particles, "logo", 200, 200, Date.now(), {}, {}, { value: 0 });
    expect(particles[0].targetX).toBe(10);
    expect(particles[0].targetY).toBe(20);
    expect(particles[1].targetX).toBe(30);
    expect(particles[1].targetY).toBe(40);
  });

  it("circular mode produces finite targets distinct from the logo layout", () => {
    const particles = Array.from({ length: 40 }, (_, i) => createParticle(i, 5, 5, DEFAULT_PALETTE, {}));
    updateTargets(particles, "circular", 300, 300, 1000, {}, {}, { value: 0 });
    for (const p of particles) {
      expect(Number.isFinite(p.targetX)).toBe(true);
      expect(Number.isFinite(p.targetY)).toBe(true);
    }
    const moved = particles.some((p) => p.targetX !== 5 || p.targetY !== 5);
    expect(moved).toBe(true);
  });
});

/* ─── 5. Engine contract ─────────────────────────────────────────────────── */

describe("T-530 — engine config validation + lifecycle", () => {
  it("rejects a non-positive canvas width with ConfigError", async () => {
    const engine = new ParticleEngine();
    await expect(
      engine.initialize({
        pipeline: { source: { fallback: true }, canvasWidth: 0, canvasHeight: 100 },
      }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it("rejects a config with no image source", async () => {
    const engine = new ParticleEngine();
    await expect(
      engine.initialize({ pipeline: { source: {}, canvasWidth: 100, canvasHeight: 100 } }),
    ).rejects.toBeInstanceOf(ConfigError);
  });

  it("is destroyed after destroy() (ENGINE_DESTROYED)", async () => {
    const engine = new ParticleEngine();
    engine.destroy();
    await expect(
      engine.initialize({
        pipeline: { source: { fallback: true }, canvasWidth: 100, canvasHeight: 100 },
      }),
    ).rejects.toThrow(/destroyed/i);
  });

  it("error classes carry their stable codes", () => {
    expect(new ImageLoadError("x").code).toBe("IMAGE_LOAD_FAILED");
    expect(new SamplingError("x").code).toBe("SAMPLING_FAILED");
    expect(new ProjectionError("x").code).toBe("PROJECTION_FAILED");
    expect(new ConfigError("x").code).toBe("INVALID_CONFIG");
  });
});

/* ─── 6. Colour helpers ──────────────────────────────────────────────────── */

describe("T-530 — colour interpolators (reference math)", () => {
  it("excite lerps toward the target", () => {
    const c = [0, 0, 0];
    exciteColor(c as [number, number, number], [100, 100, 100], 0.5);
    expect(c).toEqual([50, 50, 50]);
  });
  it("relax lerps back toward the base", () => {
    const c = [100, 100, 100];
    relaxColor(c as [number, number, number], [0, 0, 0], 0.25);
    expect(c).toEqual([75, 75, 75]);
  });
  it("roundColor returns a NEW rounded array", () => {
    const c = [1.2, 2.5, 3.9];
    const r = roundColor(c as [number, number, number]);
    expect(r).toEqual([1, 3, 4]);
    expect(r).not.toBe(c);
  });
  it("luminance is the channel mean", () => {
    expect(luminance([30, 30, 30])).toBe(30);
  });
});

/* ─── 7. Brand asset byte-identity ───────────────────────────────────────── */

describe("T-530 — the brand pictogram is the EXACT desktop asset", () => {
  it("public/intro-logo.png is byte-identical to the desktop's logo (md5-pinned)", () => {
    const logo = readFileSync(join(process.cwd(), "public", "intro-logo.png"));
    const md5 = createHash("md5").update(logo).digest("hex");
    // md5 of elimtiyaz-desktop/public/intro-logo.png (hub AgentGithubUplaod,
    // verified 2026-10-14): replacing/re-encoding/"fixing" the asset fails here.
    expect(md5).toBe("a1efb238f3c433968f6b267db9b8cb9e");
    expect(logo.length).toBe(159357);
  });

  it("the wrapper's default source is the brand asset path", () => {
    expect(INTRO_LOGO_SRC).toBe("/intro-logo.png");
  });
});
