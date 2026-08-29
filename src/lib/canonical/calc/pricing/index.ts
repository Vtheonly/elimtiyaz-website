/**
 * Pricing calculation module — public barrel.
 *
 * Ported verbatim from the desktop's canonical barrel
 * (`elimtiyaz-desktop/src/domain/calc/pricing/index.ts`) — T-049
 * (ARCH-005 session): the website port omitted this barrel, so
 * `calc/ledger/charges.ts`'s `from "../pricing"` did not resolve.
 * Import paths are adapted to this repo's `@/lib/canonical` layout.
 *
 * Submodules:
 *   - `discount-rules`  — 5 canonical discount evaluators + legacy pricing-config
 *                         helpers (applyDiscount, findDiscountByCode,
 *                         computeSiblingDiscount)
 *   - `discount-engine` — evaluateAllSystemDiscounts, sumDiscounts
 *   - `tuition`         — tuitionForGradeLevel, tuitionForLevel,
 *                         tuitionTranchesForGrade, tuitionTranches
 *   - `transport`       — transportForDestination, transportForTier,
 *                         transportTranchesForDestination
 */
export * from "./discount-rules";
export * from "./discount-engine";
export * from "./tuition";
export * from "./transport";
// Re-export the pricing model types so callers can import everything
// (including `type PricingConfig`) from `@/lib/canonical/calc/pricing`.
export type {
  PricingConfig,
  PricingEntry,
  TuitionPricing,
  TransportPricing,
} from "@/lib/canonical/model/pricing";
