/**
 * [T-530 / UI-344 — VERBATIM WEBSITE PORT] Ported byte-equivalent from the
 * hub repository `AgentGithubUplaod`, file
 * `elimtiyaz-desktop/src/shared/particle-engine/index.ts`
 * (introduced b25e6caa, last touched 6bba62b4). Per hub AGENTS.md §9 this
 * is a VERBATIM port, NOT a fork: any logic change here MUST be mirrored in
 * the desktop engine (or reverted). Website-specific adaptations are
 * confined to the React wrapper `src/components/particle-canvas.tsx`.
 */
/**
 * Particle engine — public barrel export.
 *
 * Re-exports the engine class, all types, errors, and the pipeline / physics
 * building blocks so consumers can compose them directly if needed.
 */
export { ParticleEngine } from "./engine";
export { DEFAULT_PALETTE } from "./types";
export type {
  LogoMode,
  RGB,
  Palette,
  ParticleState,
  ImageSource,
  PipelineConfig,
  InteractionConfig,
  PhysicsConfig,
  CircularModeConfig,
  LinearModeConfig,
  ParticleEngineConfig,
  SimulationFrame,
  LoadedImage,
} from "./types";

export {
  ParticleEngineError,
  ImageLoadError,
  SamplingError,
  ProjectionError,
  ConfigError,
} from "./errors";
export type { ParticleErrorCode } from "./errors";

export { createParticle, updateParticle, toFrameData, DEFAULT_PHYSICS } from "./physics/particle";
export { updateTargets, DEFAULT_CIRCULAR, DEFAULT_LINEAR } from "./physics/morphing";
export {
  exciteColor,
  relaxColor,
  waveColorShift,
  roundColor,
  luminance,
} from "./color-interpolator";

export { samplePixels } from "./pipeline/sampler";
export type { SamplePoint, SamplingResult, SamplerConfig } from "./pipeline/sampler";

export { projectPoints } from "./pipeline/projector";
export type {
  ProjectedPoint,
  ProjectionResult,
  ProjectionConfig,
} from "./pipeline/projector";

export { loadImage } from "./pipeline/image-loader";
export { generateFallbackPattern, FALLBACK_SIZE } from "./pipeline/fallback";
export { executePipeline } from "./pipeline/pipeline";
export type { PipelineResult, ProgressCallback } from "./pipeline/pipeline";
