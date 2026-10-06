import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Something the reader needs to know about what just happened — usually that
 * it failed, and what to do next. Announced (`role="alert"`) when it is an error.
 *   well   — a tinted box, for a form-level failure
 *   inline — coloured text only, under the control it concerns
 */
export interface NoticeProps extends React.HTMLAttributes<HTMLParagraphElement> {
  tone?: "danger" | "warning" | "success" | "info"
  variant?: "well" | "inline"
  icon?: React.ReactNode
}

export function Notice({ tone = "danger", variant = "well", icon, className, children, ...props }: NoticeProps) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={cn("notice", `notice--${variant}`, `notice--${tone}`, className)}
      {...props}
    >
      {icon && <span className="notice-icon" aria-hidden="true">{icon}</span>}
      {icon ? <span>{children}</span> : children}
    </p>
  )
}
