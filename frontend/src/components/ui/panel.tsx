import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { IconButton } from "./icon-button"

/**
 * The strip across the top of a popover or dialog: an icon, what this panel
 * is, and the way out. Six panels drew their own.
 *   sm — a popover over the document (AI assist, write a section, a proposal)
 *   md — a sheet or dialog (export, new post, a post opened)
 */
export function PanelHeader({ icon, title, onClose, closeLabel = "Close", size = "sm", className }: {
  icon?: React.ReactNode
  title?: React.ReactNode
  onClose?: () => void
  closeLabel?: string
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <div className={cn("panel-header", `panel-header--${size}`, className)}>
      {icon && <span className="panel-header-icon" aria-hidden="true">{icon}</span>}
      {title != null && <span className="panel-header-title">{title}</span>}
      {onClose && (
        <IconButton type="button" size={size === "md" ? "lg" : "sm"} className="ml-auto" onClick={onClose} aria-label={closeLabel}>
          <X className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        </IconButton>
      )}
    </div>
  )
}

/**
 * How much of something is done. `value` is 0–1. `sm` is a 2px hairline
 * (coverage at rest), `md` a 3px bar (a run in progress).
 */
export function Progress({ value, size = "sm", label, className }: {
  value: number
  size?: "sm" | "md"
  label?: string
  className?: string
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div
      className={cn("progress", `progress--${size}`, className)}
      role={label ? "progressbar" : "presentation"}
      aria-label={label}
      aria-valuenow={label ? Math.round(pct) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
    >
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}
