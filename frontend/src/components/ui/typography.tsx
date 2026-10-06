import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Text and headings.
 *
 * `size` is the scale the markup renders today (Tailwind's: xs 12/16, sm 14/20,
 * base 16/24, lg 18/28, xl 20/28, 2xl 24/32) plus the small steps the product
 * uses for metadata (2xs 11px, 3xs 10px). The token scale in tokens.css is a
 * second, slightly different ladder — LEDGER A-11 asks to unify them.
 * `tone` is the ink ramp; `faint`/`ghost` are for metadata, never for body copy.
 */
const SIZE = {
  "3xs": "text-[10px]", "2xs": "text-[11px]", xs: "text-xs", sm: "text-sm", base: "text-base",
  lg: "text-lg", xl: "text-xl", "2xl": "text-2xl",
} as const
const TONE = {
  ink: "text-[var(--ink)]", "ink-2": "text-[var(--ink-2)]", muted: "text-[var(--ink-muted)]",
  faint: "text-[var(--ink-faint)]", ghost: "text-[var(--ink-ghost)]", accent: "text-[var(--accent-600)]",
  danger: "text-[var(--status-danger)]", success: "text-[var(--status-success)]",
} as const
const WEIGHT = { regular: "font-normal", medium: "font-medium", semibold: "font-semibold", bold: "font-bold" } as const
const LEADING = { none: "leading-none", tight: "leading-tight", snug: "leading-snug", normal: "leading-normal", relaxed: "leading-relaxed" } as const

export interface TextProps extends React.HTMLAttributes<HTMLElement> {
  as?: "p" | "span" | "div" | "label" | "small" | "strong" | "em" | "time" | "dt" | "dd" | "li" | "h2" | "h3" | "h4"
  size?: keyof typeof SIZE
  tone?: keyof typeof TONE
  weight?: keyof typeof WEIGHT
  leading?: keyof typeof LEADING
  italic?: boolean
  truncate?: boolean
  /** Figures that line up in columns. */
  numeric?: boolean
  /** The mono face — counts, ids, code-like values. */
  mono?: boolean
  dateTime?: string
}

export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ as: Tag = "p", size, tone, weight, leading, italic, truncate, numeric, mono, className, ...rest }, ref) =>
    React.createElement(Tag, {
      ref,
      className: cn(
        size && SIZE[size], tone && TONE[tone], weight && WEIGHT[weight], leading && LEADING[leading],
        italic && "italic", truncate && "truncate", numeric && "tabular-nums", mono && "font-mono", className,
      ),
      ...rest,
    })
)
Text.displayName = "Text"

/**
 * A heading. `level` is the outline (h1–h4); `size` the voice:
 *   display — the serif at page-title scale   section — the serif at section scale
 *   card    — the serif at card scale           label  — a small sans heading
 */
const HEADING = {
  display: "heading heading--display", section: "heading heading--section",
  card: "card-heading", label: "heading heading--label",
} as const

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4
  size?: keyof typeof HEADING
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level, size = "section", className, ...rest }, ref) =>
    React.createElement(`h${level}`, { ref, className: cn(HEADING[size], className), ...rest })
)
Heading.displayName = "Heading"
