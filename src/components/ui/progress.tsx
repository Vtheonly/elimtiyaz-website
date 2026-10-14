import { cn } from "@/lib/utils";

/**
 * Progress — T-531 (UI-345): the ONE shared determinate progress bar.
 *
 * Extracted from the financial view's two hand-rolled inline bars (the
 * tranche rows and the installment cards — two parallel implementations of
 * the same visual, the exact §9 anti-pattern). The computation of the
 * percentage stays at the call sites (domain logic); this component owns
 * ONLY the presentation:
 *
 *   - a recessed track (.progress-track) and an animated gradient fill
 *     (.progress-fill / .progress-fill-success) defined once in
 *     globals.css — brand tokens only (#349BD4 → #6EC1E4, success #3FA66E);
 *   - a travelling light streak (the ::after shimmer) so the bar reads as
 *     live even when the value is static (e.g. a half-paid installment);
 *   - the width transition (600ms) so value changes animate smoothly;
 *   - full progressbar semantics: role, aria-valuenow/min/max, and an
 *     accessible label (the installment/tranche label at the call sites);
 *   - every animation is disabled under prefers-reduced-motion by the
 *     global CSS guard (globals.css) — the bar still renders its value.
 *
 * Indeterminate waits (the splash screen) do NOT use this component — they
 * use the .progress-track + .progress-bar-sweep pair directly, because an
 * unknown value must not announce aria-valuenow (the splash passes
 * aria-busy on its own track).
 */

export interface ProgressProps {
  /** The percentage 0–100 (clamped; NaN/Infinity degrade to 0). */
  value: number;
  /** Track sizing classes (e.g. "h-1.5", "mt-4") — width defaults to full. */
  className?: string;
  /** "brand" (blue gradient) or "success" (green gradient, settled rows). */
  tone?: "brand" | "success";
  /** The accessible label — required when the bar has no visible label. */
  "aria-label"?: string;
}

export function Progress({
  value,
  className,
  tone = "brand",
  ...aria
}: ProgressProps) {
  const numeric = Number(value);
  const clamped = Number.isFinite(numeric)
    ? Math.min(100, Math.max(0, numeric))
    : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={aria["aria-label"]}
      className={cn(
        "progress-track h-2 w-full overflow-hidden rounded-full",
        className,
      )}
    >
      <div
        className={cn(
          "progress-fill h-full rounded-full",
          tone === "success" && "progress-fill-success",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
