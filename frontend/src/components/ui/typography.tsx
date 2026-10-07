import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Text and headings.
 *
 * `size` is the one type ladder, the `--text-*` tokens that Tailwind's
 * `text-*` sizes now also resolve to: 3xs 10 · 2xs 11 · xs 12 · sm 13 ·
 * base 15 · md 17 · lg 20 · xl 24 · 2xl 30 (px).
 * `tone` is the ink ramp; `faint`/`ghost` are for metadata, never for body copy.
 */
const SIZE = {
  "3xs": "text-3xs", "2xs": "text-2xs", xs: "text-xs", sm: "text-sm", base: "text-base",
  md: "text-md", lg: "text-lg", xl: "text-xl", "2xl": "text-2xl",
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
  /**
   * A leading glyph, 6px from the text and centred on it — a count with its
   * icon, a meta item. Inline elements become inline-flex, blocks flex.
   */
  icon?: React.ReactNode
  dateTime?: string
}

const INLINE = new Set(["span", "small", "strong", "em", "time", "label"])

export const Text = React.forwardRef<HTMLElement, TextProps>(
  ({ as: Tag = "p", size, tone, weight, leading, italic, truncate, numeric, mono, icon, className, children, ...rest }, ref) =>
    React.createElement(Tag, {
      ref,
      className: cn(
        icon != null && (INLINE.has(Tag) ? "inline-flex" : "flex") + " items-center gap-1.5",
        size && SIZE[size], tone && TONE[tone], weight && WEIGHT[weight], leading && LEADING[leading],
        italic && "italic", truncate && "truncate", numeric && "tabular-nums", mono && "font-mono", className,
      ),
      ...rest,
    }, icon, children)
)
Text.displayName = "Text"

/**
 * A heading. `level` is the outline (h1–h4); `size` the voice:
 *   display    — the serif at page-title scale (what `PageHeader` prints)
 *   section    — the serif at marketing-section scale (`SectionHead`)
 *   subsection — the serif at --text-lg: a section inside an app screen
 *   group      — the serif at 1rem: a group inside such a section
 *   card       — the serif at card scale
 *   label      — the 10px caps caption over a group of controls
 */
const HEADING = {
  display: "page-title", section: "section-title",
  subsection: "section-title section-title--subsection", group: "section-title section-title--group",
  card: "card-heading", label: "heading--label",
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
