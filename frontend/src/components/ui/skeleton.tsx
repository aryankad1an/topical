import { cn } from "@/lib/utils"

/**
 * A placeholder in the shape of what is coming. Width and height are the
 * content's own geometry, so they are props rather than classes; the sweep
 * (a single pass of a lighter band, never a pulse that fades the whole block)
 * is defined once.
 *
 * `radius`: `sm` for text lines (the default), `md`/`lg` for tiles and cards,
 * `none` where the block butts against a card edge, `full` for a dot.
 */
export interface SkeletonProps {
  width?: number | string
  height?: number | string
  radius?: "none" | "sm" | "md" | "lg" | "full"
  className?: string
}

export function Skeleton({ width, height, radius = "sm", className }: SkeletonProps) {
  return (
    <span
      className={cn("skeleton", radius !== "sm" && `skeleton--${radius}`, className)}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}
