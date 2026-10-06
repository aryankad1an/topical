import * as React from "react"

import { cn } from "@/lib/utils"
import { Input, type InputProps } from "./input"

/**
 * The filter row across the top of a menu or palette: an icon, a bare input,
 * and an optional trailing hint, ruled off from the list below.
 *
 * The command palette (`.cmdk-input-row`) and the inline AI panel
 * (`.ai-assist-search`) each drew this row themselves.
 *   md — a page-level palette (15px)
 *   sm — a popover over the document (12.5px)
 */
export interface MenuSearchProps extends Omit<InputProps, "variant" | "size" | "leading" | "trailing"> {
  icon: React.ReactNode
  size?: "sm" | "md"
  /** The icon in the accent — for a row that starts an AI action. */
  accentIcon?: boolean
  trailing?: React.ReactNode
}

export const MenuSearch = React.forwardRef<HTMLInputElement, MenuSearchProps>(
  ({ icon, size = "md", accentIcon, trailing, className, ...props }, ref) => (
    <div className={cn("menu-search", `menu-search--${size}`, className)}>
      <span className={cn("menu-search-icon", accentIcon && "menu-search-icon--accent")} aria-hidden="true">{icon}</span>
      <Input ref={ref} variant="bare" className="menu-search-input" {...props} />
      {trailing}
    </div>
  )
)
MenuSearch.displayName = "MenuSearch"
