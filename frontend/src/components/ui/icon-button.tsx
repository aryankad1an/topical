import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * An icon-only control: the ghost tier, no chrome until it is pointed at.
 *
 * Eight class names drew this one control (`.toolbar-btn`, `.icon-btn`,
 * `.orow-tool`, `.vote-btn`, `.detail-close-btn`, `.theme-toggle`,
 * `.auth-reveal`, `.nav-kbd`), each with a size of its own declared in a page
 * stylesheet and most of those sizes overridden by the 40px touch floor. The
 * sizes here are what actually rendered:
 *   xs 18px — row tools inside a dense list
 *   sm 28px — card and panel tools
 *   md 30px — chrome tools (theme switch, password reveal)
 *   lg 40px — the shared control height
 *
 * An accessible name is required: pass `aria-label`.
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "xs" | "sm" | "md" | "lg"
  /** `narrow` is a 20px-wide affordance on the control beside it (a group's "more" chevron). */
  width?: "square" | "narrow"
  tone?: "neutral" | "danger"
  /**
   * Hidden until the nearest `.group` ancestor is hovered — on pointers that
   * can hover. On touch it is always visible, and keyboard focus always
   * reveals it, so hover is never the only way to reach it.
   */
  revealOnHover?: boolean
  /** Selected state, for toggles. */
  active?: boolean
  "aria-label": string
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = "sm", width = "square", tone = "neutral", revealOnHover, active, className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        "icon-btn",
        `icon-btn--${size}`,
        width === "narrow" && "icon-btn--narrow",
        tone === "danger" && "icon-btn--danger",
        revealOnHover && "reveal-on-hover",
        className,
      )}
      data-active={active === undefined ? undefined : String(active)}
      {...rest}
    />
  )
)
IconButton.displayName = "IconButton"

export { IconButton }
