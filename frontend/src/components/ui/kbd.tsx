import { cn } from "@/lib/utils"

/**
 * A key or a key combination.
 *   key  — a boxed keycap, for hints and the shortcuts sheet
 *   bare — the mono face only, for a key inside another control
 */
export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "key" | "bare"
}

export function Kbd({ variant = "key", className, ...rest }: KbdProps) {
  return <kbd className={cn("kbd", `kbd--${variant}`, className)} {...rest} />
}
