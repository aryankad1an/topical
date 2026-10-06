import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * "This is blocked until something finishes." For a background refresh of
 * content already on screen use `Refreshing` instead — a spinner says wait.
 *
 * Twenty call sites drew this as `<Loader2 className="h-4 w-4 animate-spin" />`
 * at nine different sizes with three different colour overrides.
 *   2xs 10 · xs 12 — inline in a dense row
 *   sm 14 · md 16  — inside a button (Button's `loading` picks one)
 *   lg 20 · xl 24  — a panel's loading state
 *   2xl 28 · 3xl 48 — a page's loading state
 * Colour follows the surrounding text unless `tone` says otherwise.
 */
export interface SpinnerProps {
  size?: "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"
  tone?: "current" | "accent" | "faint" | "ink" | "brand"
  /** Announced to assistive tech. Omit when a visible label says the same. */
  label?: string
  className?: string
}

const SIZE = {
  "2xs": "h-2.5 w-2.5",
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
  "2xl": "h-7 w-7",
  "3xl": "h-12 w-12",
} as const

export function Spinner({ size = "md", tone = "current", label, className }: SpinnerProps) {
  return (
    <Loader2
      className={cn("spinner animate-spin", SIZE[size], tone !== "current" && `spinner--${tone}`, className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "status" : undefined}
    />
  )
}

/**
 * The whole of a screen or region that is waiting on its first load.
 *   page   — a route's first paint: a large accent spinner and a line saying why
 *   region — a panel or sub-route: a quieter spinner, no words needed
 *   inline — inside an open sheet or dialog, with room above and below
 * For a re-fetch of content already on screen use `Refreshing`, not this.
 */
export function LoadingState({ size = "region", label, className }: {
  size?: "page" | "region" | "inline"
  label?: string
  className?: string
}) {
  return (
    <div className={cn("loading-state", `loading-state--${size}`, className)} role="status" aria-live="polite">
      <Spinner
        size={size === "page" ? "3xl" : size === "region" ? "xl" : "lg"}
        tone={size === "region" ? "faint" : "accent"}
        label={label ? undefined : "Loading"}
      />
      {label && <p className="loading-state-label">{label}</p>}
    </div>
  )
}
