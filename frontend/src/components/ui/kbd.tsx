import { cn } from "@/lib/utils"

/**
 * A key or a key combination.
 *   key  — a small boxed key inside a line of text or a menu row
 *   cap  — a raised keycap, for the shortcuts sheet
 *   fill — a key printed on a filled (primary) button
 *   bare — the mono face only, for a key inside another control
 */
export interface KbdProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "key" | "cap" | "fill" | "bare"
}

export function Kbd({ variant = "key", className, ...rest }: KbdProps) {
  return <kbd className={cn("kbd", `kbd--${variant}`, className)} {...rest} />
}
