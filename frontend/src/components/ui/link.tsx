import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * A link that reads as text, not as a button.
 *   quiet     — faint until pointed at (back links, a secondary action in a panel)
 *   underline — a hairline under it, warming to the accent (a link inside a sentence)
 * `size`: 2xs 10.5px · xs 12px · inherit. `asChild` wraps a router `Link`; without
 * it this is a `<button>`, for text-weight actions ("Discard", "Add URL").
 */
export interface TextLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "quiet" | "underline"
  size?: "2xs" | "xs" | "inherit"
  asChild?: boolean
}

export const TextLink = React.forwardRef<HTMLButtonElement, TextLinkProps>(
  ({ variant = "quiet", size = "inherit", asChild, className, type = "button", ...props }, ref) => {
    const classes = cn("link", `link--${variant}`, size !== "inherit" && `link--${size}`, className)
    return asChild
      ? <Slot ref={ref} className={classes} {...props} />
      : <button ref={ref} type={type} className={classes} {...props} />
  }
)
TextLink.displayName = "TextLink"

/** "← Back to …" above a page header. Wrap a router `Link` as the child. */
export function BackLink({ children }: { children: React.ReactElement<{ children?: React.ReactNode }> }) {
  const child = React.Children.only(children)
  return (
    <TextLink asChild size="xs" className="back-link">
      {React.cloneElement(child, undefined, <><ArrowLeft className="h-3.5 w-3.5" />{child.props.children}</>)}
    </TextLink>
  )
}
