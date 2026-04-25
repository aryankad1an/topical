import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    /**
     * Optional prop to control font size scaling with zoom
     */
    scaleWithZoom?: boolean;
}

const Textarea = React.forwardRef<
    HTMLTextAreaElement,
    TextareaProps
>(({ className, scaleWithZoom = true, ...props }, ref) => {
    return (
        <textarea
            className={cn(
                "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                scaleWithZoom ? "text-base sm:text-sm md:text-base" : "text-sm",
                className
            )}
            ref={ref}
            {...props}
        />
    )
})
Textarea.displayName = "Textarea"

export { Textarea }
