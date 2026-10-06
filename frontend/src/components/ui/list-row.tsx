import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * One item in a short list inside a panel or dialog: something to identify
 * it (an avatar, an icon), its name, and the one action that applies to it.
 *   plain  — a search result: no chrome until hovered
 *   filled — an item already chosen: a quiet well with a hairline
 */
export interface ListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  leading?: React.ReactNode
  trailing?: React.ReactNode
  variant?: "plain" | "filled"
}

export const ListRow = React.forwardRef<HTMLDivElement, ListRowProps>(
  ({ leading, trailing, variant = "plain", className, children, ...rest }, ref) => (
    <div ref={ref} className={cn("list-row", `list-row--${variant}`, className)} {...rest}>
      {leading}
      <span className="list-row-label">{children}</span>
      {trailing}
    </div>
  ),
)
ListRow.displayName = "ListRow"
