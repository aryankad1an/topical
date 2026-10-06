import * as React from "react"

import { cn } from "@/lib/utils"
import { Label, type LabelProps } from "./label"

/**
 * A labelled field: the label, the control, then a hint or an error under it.
 * The control is whatever is passed as children and must carry `id={id}`.
 * The error replaces the hint and is announced; the hint stays quiet.
 */
export interface FieldProps {
  id: string
  label: React.ReactNode
  requirement?: LabelProps["requirement"]
  aside?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  /** A right-aligned length counter under the control, for capped fields. */
  count?: { value: number; max: number }
  size?: "sm" | "md"
  className?: string
  children: React.ReactNode
}

export function Field({ id, label, requirement, aside, hint, error, count, size = "md", className, children }: FieldProps) {
  return (
    <div className={cn("field", className)}>
      <Label htmlFor={id} requirement={requirement} aside={aside} size={size}>{label}</Label>
      {children}
      {error
        ? <p className="field-note field-note--error" id={`${id}-error`} role="alert">{error}</p>
        : hint && <p className="field-note" id={`${id}-hint`}>{hint}</p>}
      {count && (
        <p className="field-note field-note--count" aria-live="polite">{count.value}/{count.max}</p>
      )}
    </div>
  )
}

/** For a group of controls (radio chips, checkboxes) with one visible heading. */
export function FieldGroup({ label, className, children }: { label: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("field", className)}>
      <span className="label">{label}</span>
      {children}
    </div>
  )
}
