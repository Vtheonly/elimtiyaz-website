import { cn } from "@/lib/utils"

/* T-531 (UI-345): the flat `animate-pulse` was swapped for the shimmer
 * sweep (.skeleton-shimmer, globals.css) — a light streak travelling across
 * a faint brand-neutral surface, the same motion language as the progress
 * fill. The sweep freezes into a static gradient under
 * prefers-reduced-motion (the global CSS guard). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
