import { cn } from "@/lib/utils"

/** The class list every text field shares; see input.tsx for the variants. */
export function inputClass({ size = "md", variant = "well", leading, trailing }: {
  size?: "sm" | "md" | "lg"
  variant?: "well" | "bare" | "file"
  leading?: unknown
  trailing?: unknown
}) {
  return cn(
    "input",
    `input--${variant}`,
    variant === "well" && `input--${size}`,
    leading != null && "input--leading",
    trailing != null && "input--trailing",
  )
}
