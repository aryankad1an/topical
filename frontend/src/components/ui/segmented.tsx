import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * One-of-N: section tabs, a view switch, a sort order, a mode.
 *
 *   tray  — a recessed tray with the chosen item raised out of it (section
 *           tabs, grid/list, the editor's Write/Split/Read)
 *   pills — no tray, the chosen item in the accent's quiet form: one level
 *           below a tab, so it must not look like one (sort order)
 *
 * Five implementations drew these (`.segmented`, `.community-tabs`,
 * `.sort-pill`, `.topic-format`, `.method-switch`).
 *   md 13px · sm 12px · xs 11.5px labels; `iconOnly` items are 36px squares.
 *
 * Each item is a toggle button that reports its state with `aria-pressed`.
 */
export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
  /** An icon element, sized by the caller. */
  icon?: React.ReactNode
  title?: string
  /** Accessible name when the label is not text (or is hidden). */
  "aria-label"?: string
}

export interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: NoInfer<T>) => void
  options: SegmentedOption<NoInfer<T>>[]
  variant?: "tray" | "pills"
  size?: "md" | "sm" | "xs"
  /** Icons only; each option's `aria-label` (or `title`) names it. */
  iconOnly?: boolean
  /** Items share the width equally. */
  fill?: boolean
  "aria-label": string
  className?: string
}

export function Segmented<T extends string>({
  value, onChange, options, variant = "tray", size = "md", iconOnly, fill, className, ...rest
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={rest["aria-label"]}
      className={cn("segmented", `segmented--${variant}`, `segmented--${size}`, iconOnly && "segmented--icons", fill && "segmented--fill", className)}
    >
      {options.map(option => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className="segmented-item"
            data-active={active}
            aria-pressed={active}
            title={option.title}
            aria-label={option["aria-label"]}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
            {!iconOnly && option.label}
          </button>
        )
      })}
    </div>
  )
}
