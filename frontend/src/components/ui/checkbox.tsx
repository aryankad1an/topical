import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A labelled checkbox: the browser's own box (so it keeps every native
 * behaviour), in the accent, top-aligned with a label that may wrap, and an
 * optional note saying what ticking it costs — a trade-off explained only in
 * a tooltip is a trade-off nobody knows they took.
 */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode
  note?: React.ReactNode
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, note, className, ...props }, ref) => (
    <label className={cn("checkbox", className)}>
      <input ref={ref} type="checkbox" className="checkbox-box" {...props} />
      <span>
        {label}
        {note && <span className="checkbox-note">{note}</span>}
      </span>
    </label>
  )
)
Checkbox.displayName = "Checkbox"
