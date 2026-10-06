import { cn } from "@/lib/utils"

/**
 * A rule between groups. This system separates with a line, not a shadow.
 *   vertical   — between control groups in a bar (18px tall, `--ink-a06`)
 *   horizontal — between sections of a panel or menu (`--line-soft`)
 * `space` is the gap on either side along the bar or panel.
 */
export interface DividerProps {
  orientation?: "horizontal" | "vertical"
  space?: "xs" | "sm" | "md"
  className?: string
}

export function Divider({ orientation = "horizontal", space = "md", className }: DividerProps) {
  return (
    <span
      role="separator"
      aria-orientation={orientation}
      className={cn("divider", `divider--${orientation}`, `divider--${space}`, className)}
    />
  )
}
