import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Layout: the flex and grid arrangements every screen is built from.
 *
 * The values map to Tailwind's 4px spacing ladder (the same steps as the
 * `--space-*` tokens) through literal class tables — Tailwind only generates
 * classes it can read in source, so nothing here is built from a template.
 * Anything that positions the element within its parent (`flex-1`, `min-w-0`,
 * a margin) still goes in `className`; appearance never does.
 */

export type Space = 0 | 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 5 | 6 | 8 | 10 | 12

const GAP: Record<Space, string> = {
  0: "gap-0", 0.5: "gap-0.5", 1: "gap-1", 1.5: "gap-1.5", 2: "gap-2", 2.5: "gap-2.5", 3: "gap-3",
  3.5: "gap-3.5", 4: "gap-4", 5: "gap-5", 6: "gap-6", 8: "gap-8", 10: "gap-10", 12: "gap-12",
}
const GAP_X: Partial<Record<Space, string>> = { 1: "gap-x-1", 2: "gap-x-2", 3: "gap-x-3", 4: "gap-x-4", 6: "gap-x-6" }
const GAP_Y: Partial<Record<Space, string>> = { 1: "gap-y-1", 2: "gap-y-2", 3: "gap-y-3", 4: "gap-y-4", 6: "gap-y-6" }
const ALIGN = { start: "items-start", center: "items-center", end: "items-end", baseline: "items-baseline", stretch: "items-stretch" } as const
const JUSTIFY = { start: "justify-start", center: "justify-center", end: "justify-end", between: "justify-between" } as const

type Tag = "div" | "span" | "section" | "ul" | "ol" | "li" | "nav" | "header" | "footer" | "form" | "label"

interface FlexProps extends React.HTMLAttributes<HTMLElement>, Pick<React.FormHTMLAttributes<HTMLFormElement>, "noValidate"> {
  as?: Tag
  gap?: Space
  gapX?: Space
  gapY?: Space
  align?: keyof typeof ALIGN
  justify?: keyof typeof JUSTIFY
  wrap?: boolean
  inline?: boolean
}

function flex(dir: "row" | "col", { gap, gapX, gapY, align, justify, wrap, inline }: FlexProps) {
  return cn(
    inline ? "inline-flex" : "flex",
    dir === "col" && "flex-col",
    gap !== undefined && GAP[gap],
    gapX !== undefined && GAP_X[gapX],
    gapY !== undefined && GAP_Y[gapY],
    align && ALIGN[align],
    justify && JUSTIFY[justify],
    wrap && "flex-wrap",
  )
}

/** Children side by side. */
export const Row = React.forwardRef<HTMLElement, FlexProps>(
  ({ as: Tag = "div", gap, gapX, gapY, align, justify, wrap, inline, className, ...rest }, ref) =>
    React.createElement(Tag, { ref, className: cn(flex("row", { gap, gapX, gapY, align, justify, wrap, inline }), className), ...rest })
)
Row.displayName = "Row"

/** Children one above the other. */
export const Stack = React.forwardRef<HTMLElement, FlexProps>(
  ({ as: Tag = "div", gap, gapX, gapY, align, justify, wrap, inline, className, ...rest }, ref) =>
    React.createElement(Tag, { ref, className: cn(flex("col", { gap, gapX, gapY, align, justify, wrap, inline }), className), ...rest })
)
Stack.displayName = "Stack"

const COLS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" } as const
const SM = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" } as const
const MD = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" } as const
const LG = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" } as const
type Cols = 1 | 2 | 3 | 4

interface GridProps extends React.HTMLAttributes<HTMLElement> {
  as?: Tag
  /** Columns at each breakpoint; unset breakpoints inherit the smaller one. */
  cols?: { base?: Cols; sm?: Cols; md?: Cols; lg?: Cols }
  gap?: Space
}

/** A responsive column grid. */
export const Grid = React.forwardRef<HTMLElement, GridProps>(
  ({ as: Tag = "div", cols = {}, gap, className, ...rest }, ref) =>
    React.createElement(Tag, {
      ref,
      className: cn(
        "grid",
        cols.base && COLS[cols.base], cols.sm && SM[cols.sm], cols.md && MD[cols.md], cols.lg && LG[cols.lg],
        gap !== undefined && GAP[gap],
        className,
      ),
      ...rest,
    })
)
Grid.displayName = "Grid"
