import * as React from "react"

import { cn } from "@/lib/utils"
import { inputClass } from "./field-class"

/**
 * A multi-line text field: the same well as `Input`, growing downward.
 *   sm — 12px, inside editor panels and popovers
 *   md — 15px, page forms
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: "sm" | "md"
  /** `none` for fixed-shape boxes; `vertical` lets the reader give themselves room. */
  resize?: "none" | "vertical"
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size = "md", resize = "none", ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(inputClass({ size, variant: "well" }), "input--multiline", resize === "vertical" && "input--resizable", className)}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

export { Textarea }
