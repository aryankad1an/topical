import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "@/lib/utils"

/**
 * A form label. One face for every field in the product — it was four:
 * `.auth-label`, `.dialog-label`, `.pdf-field-label` and shadcn's, which set
 * its fields in a different size and weight from every other form.
 *
 * `requirement` states the word, not an asterisk: `Title*` put the marker in
 * the placeholder, the one piece of text guaranteed to vanish first.
 * `aside` sits at the far end of the row (a "Forgot?" link, a counter).
 */
export interface LabelProps extends React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> {
  requirement?: "required" | "optional"
  aside?: React.ReactNode
  size?: "sm" | "md"
}

const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
  ({ className, requirement, aside, size = "md", children, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn("label", size === "sm" && "label--sm", aside != null && "label--split", className)}
      {...props}
    >
      {aside != null ? <span>{children}{requirement && <> <Requirement kind={requirement} /></>}</span> : children}
      {aside == null && requirement && <Requirement kind={requirement} />}
      {aside}
    </LabelPrimitive.Root>
  )
)
Label.displayName = LabelPrimitive.Root.displayName

function Requirement({ kind }: { kind: "required" | "optional" }) {
  return <span className={cn("label-req", kind === "required" && "label-req--required")}>{kind}</span>
}

export { Label }
