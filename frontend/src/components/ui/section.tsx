import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * The marketing pages' rhythm: full-width bands, a centred 64rem column, a
 * section head, and feature cards. App screens use `Page` and `PageHeader`
 * instead — the split is deliberate (project.md, standing rules).
 */

/** A full-width band holding one 64rem column. `hero` opens a page; `tight` follows another band closely. */
export function Band({ spacing = "default", className, innerClassName, children, ...rest }:
  React.HTMLAttributes<HTMLElement> & { spacing?: "default" | "tight" | "hero"; innerClassName?: string }) {
  return (
    <section className={cn("band", spacing !== "default" && `band--${spacing}`, className)} {...rest}>
      <div className={cn("band-inner", innerClassName)}>{children}</div>
    </section>
  )
}

/**
 * A section's title and the line under it. `hero` is the page-opening scale
 * (the about page's h1); `align="center"` only for a closing call to action.
 */
export function SectionHead({ title, subtitle, eyebrow, level = 2, size = "section", align = "start", flush, className }: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  eyebrow?: React.ReactNode
  level?: 1 | 2
  size?: "section" | "hero"
  align?: "start" | "center"
  /** No space below — when the next thing is not a grid but the head's own action. */
  flush?: boolean
  className?: string
}) {
  const Title = `h${level}` as "h1" | "h2"
  return (
    <div className={cn("section-head", size === "hero" && "section-head--hero", align === "center" && "section-head--center", flush && "section-head--flush", className)}>
      {eyebrow}
      <Title className={cn("section-title", size === "hero" && "section-title--hero")}>{title}</Title>
      {subtitle && <p className="section-sub">{subtitle}</p>}
    </div>
  )
}

/**
 * A card that states one feature or step: an optional step number, an icon
 * well that warms when the card is pointed at, a title and a line of copy.
 *   step    — the three-step rail and the about page's cards
 *   bento   — a tile in the feature grid (`wide` spans half of it)
 *   feature — the one lead tile, washed in the accent
 */
export function FeatureCard({ variant = "step", step, icon, title, children, footer, className }: {
  variant?: "step" | "bento" | "wide" | "feature"
  step?: React.ReactNode
  icon?: React.ReactNode
  title: React.ReactNode
  children: React.ReactNode
  /** After the copy: tags, a link. */
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(
      variant === "step" ? "step-card" : "bento-item",
      variant === "wide" && "bento-item--wide",
      variant === "feature" && "bento-item--feature",
      className,
    )}>
      {step != null && <span className="step-num">{step}</span>}
      {icon && <div className="bento-icon">{icon}</div>}
      <h3 className={cn("card-title", variant === "feature" && "card-title--lead")}>{title}</h3>
      <div className="card-body">{children}</div>
      {footer}
    </div>
  )
}
