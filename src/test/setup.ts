/**
 * Vitest setup file — referenced by vitest.config.ts (`setupFiles`).
 *
 * NOTE (DEAD-012): this file was referenced by vitest.config.ts since commit
 * e90dbf7 but never committed, which broke the ENTIRE website test suite
 * ("Cannot find module …/src/test/setup.ts"). It was (re)created as a minimal
 * prerequisite so task T-009's regression test could run; the full testing
 * infrastructure cleanup (RTL setup, polyfills audit, strict `next build`)
 * remains task T-049.
 *
 * Environment: jsdom (see vitest.config.ts). Tests that render React
 * components would need @testing-library/react + the usual matchMedia /
 * IntersectionObserver / ResizeObserver polyfills here; the current suite is
 * pure-function unit tests, so this file intentionally stays minimal.
 */
