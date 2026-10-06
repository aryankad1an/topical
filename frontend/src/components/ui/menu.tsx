import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

/**
 * Menus and the lists inside floating panels.
 *
 * Seven panels drew their own rows — the editor header's menus, the toolbar
 * overflow, the slash menu, the command palette, the inline AI list, the
 * lesson picker and the collaborators popover — with four group-caption
 * styles and three different "no results" lines. These are the parts; where
 * a panel sits (absolute under a trigger, fixed at a caret, inline) stays
 * with the component that measures it.
 */

/** The solid panel a menu sits in. Never glass: see project.md on nested glass. */
export interface MenuPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Where it grows from on entry — the corner nearest its trigger. `none` skips the entrance. */
  origin?: "top-left" | "top-right" | "none"
  /** `sm` 4px inset (a compact overflow menu), `md` 6px. */
  inset?: "sm" | "md"
}

export const MenuPanel = React.forwardRef<HTMLDivElement, MenuPanelProps>(
  ({ origin = "none", inset = "md", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("menu-panel", `menu-panel--${inset}`, origin !== "none" && `menu-panel--from-${origin}`, className)}
      {...props}
    />
  )
)
MenuPanel.displayName = "MenuPanel"

/** A group caption inside a menu. `md` for the command palette. */
export function MenuLabel({ size = "sm", className, ...props }: React.HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" }) {
  return <div className={cn("menu-label", size === "md" && "menu-label--md", className)} {...props} />
}

/** "Nothing matches" inside a menu. */
export function MenuEmpty({ size = "sm", className, ...props }: React.HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" }) {
  return <div className={cn("menu-empty", size === "md" && "menu-empty--md", className)} {...props} />
}

export interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** `sm` for popovers over the document, `md` for the command palette. */
  size?: "sm" | "md"
  icon?: React.ReactNode
  /** At the far end of the row: a shortcut, a check, a count. */
  trailing?: React.ReactNode
  /** The keyboard cursor is on this row (one marker for keys and pointer). */
  active?: boolean
  /** A setting this row toggles is on. */
  checked?: boolean
  /** Render the child element (a router `Link`) as the row. */
  asChild?: boolean
}

export const MenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(
  ({ size = "sm", icon, trailing, active, checked, asChild, className, children, ...props }, ref) => {
    const classes = cn("menu-item", size === "md" && "menu-item--md", className)
    const data = {
      "data-active": active ? "true" : undefined,
      "data-checked": checked ? "true" : undefined,
    }
    if (asChild) {
      return <Slot ref={ref} className={classes} {...data} {...props}>{children}</Slot>
    }
    return (
      <button ref={ref} type="button" className={classes} {...data} {...props}>
        {icon != null && <span className="menu-item-icon" aria-hidden="true">{icon}</span>}
        {children}
        {trailing != null && <span className="menu-item-trailing">{trailing}</span>}
      </button>
    )
  }
)
MenuItem.displayName = "MenuItem"
