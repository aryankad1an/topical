import * as React from "react"

import { cn } from "@/lib/utils"
import { inputClass } from "./field-class"

/**
 * A single-line text field.
 *
 * `well` is the recessed field the whole product uses — shaded at the top so
 * it reads as cut into the page, which is what says it takes typing. `bare`
 * has no chrome of its own, for a field inside a composite control that draws
 * the chrome and the focus ring around itself (the topic bar, the command
 * palette's row, a title in a header bar).
 *
 * This replaced `.glass-input`, `.auth-input`, `.search-input`, `.orail-input`,
 * `.find-input`, `.ai-assist-input` and a shadcn `Input` that rendered the
 * first of those under Tailwind utilities that lost to it.
 *   sm 32px · 12.5px — fields inside editor panels and popovers
 *   md 40px · 15px   — the shared control height
 *   lg 44px · 15px   — a form's fields (sign-in)
 *
 * `leading` (an icon) and `trailing` (a control, such as a reveal or clear
 * button) are placed inside the field; `className` then lands on the wrapper.
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "sm" | "md" | "lg"
  /** `file` is the browser's own file picker, set in the field-note face. */
  variant?: "well" | "bare" | "file"
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, variant, leading, trailing, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        className={cn(inputClass({ size, variant, leading, trailing }), leading == null && trailing == null && className)}
        {...props}
      />
    )
    if (leading == null && trailing == null) return input
    return (
      <span className={cn("input-wrap", className)}>
        {leading != null && <span className="input-icon" aria-hidden="true">{leading}</span>}
        {input}
        {trailing != null && <span className="input-trailing">{trailing}</span>}
      </span>
    )
  }
)
Input.displayName = "Input"

export { Input }
