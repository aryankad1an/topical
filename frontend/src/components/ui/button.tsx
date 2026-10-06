import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"
import { Spinner } from "./spinner"

/**
 * Every text button in the product.
 *
 * Three tiers and no fourth (see buttons.css): `primary` is the one filled
 * terracotta block on a view, `secondary` is paper on a hairline, `ghost` has
 * no chrome until it is pointed at. `dashed` is the secondary tier's "add
 * something here" form, and `danger` is the filled destructive confirm.
 *
 * This replaced a shadcn `Button` whose colours came from Tailwind's palette
 * and thirteen CSS class names (`.accent-btn`, `.glass-btn`, `.btn-subtle`,
 * `.orail-primary`, …) that were all one of the three tiers under another
 * name, each with its own size declared somewhere else.
 *
 * Sizes are measured, not invented — each is what a group of the old classes
 * actually rendered:
 *   xs   11px label, auto height (~30px) — dense side panels
 *   sm   11.5px label, auto height (~37px) — a panel's main action
 *   md   12px label, the 40px control height
 *   lg   13px label, the 40px control height — page-level actions
 *   xl   15px label, at least 44px — a form's single submit, the topic bar
 *   hero 17px label — the landing call to action
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "dashed" | "danger"
export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** `full` stretches to the container's width. */
  width?: "auto" | "full"
  /** `pill` only where the surrounding chrome is itself a pill (the nav). */
  shape?: "rounded" | "pill"
  /** Shows a spinner before the label, disables the button and sets aria-busy. */
  loading?: boolean
  /** Selected state, for buttons that toggle something on and off. */
  active?: boolean
  /** `tight` trims the side padding where a bar has no width to spare. */
  density?: "default" | "tight"
  /** `float` for a button that hovers over content rather than sitting in a layout. */
  elevation?: "flat" | "float"
  /** `danger` tints a secondary or ghost button rose — the first step of a two-step delete. */
  tone?: "neutral" | "danger"
  /** Render the child element (a router `Link`, an `<a>`) with button styling. */
  asChild?: boolean
}

function buttonClass({
  variant = "secondary", size = "lg", width = "auto", shape = "rounded", density = "default",
  elevation = "flat", tone = "neutral",
}: Pick<ButtonProps, "variant" | "size" | "width" | "shape" | "density" | "elevation" | "tone"> = {}) {
  return cn(
    "btn",
    `btn--${variant}`,
    `btn--${size}`,
    width === "full" && "btn--full",
    shape === "pill" && "btn--pill",
    density === "tight" && "btn--tight",
    elevation === "float" && "btn--float",
    tone === "danger" && "btn--tone-danger",
  )
}

/** The spinner a loading button shows, scaled to the label beside it. */
const SPINNER_FOR = {
  xs: "xs", sm: "xs", md: "sm", lg: "md", xl: "md", hero: "md",
} as const

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className, variant, size, width, shape, density, elevation, tone, loading = false, active,
    asChild = false, disabled, children, ...props
  }, ref) => {
    const classes = cn(buttonClass({ variant, size, width, shape, density, elevation, tone }), className)
    if (asChild) {
      return (
        <Slot ref={ref} className={classes} data-active={active || undefined} {...props}>
          {children}
        </Slot>
      )
    }
    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-active={active === undefined ? undefined : String(active)}
        {...props}
      >
        {loading && <Spinner size={SPINNER_FOR[size ?? "lg"]} />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
