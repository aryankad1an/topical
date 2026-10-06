import * as React from "react"
import { Search, X } from "lucide-react"

import { Input, type InputProps } from "./input"
import { IconButton } from "./icon-button"

/**
 * A search box with a clear button that appears once there is something to
 * clear — without it, the only way out of a query that matches nothing is to
 * select the text and delete it, which is the state a search is most often
 * left in.
 */
export interface SearchFieldProps extends Omit<InputProps, "leading" | "trailing" | "onChange" | "value" | "type"> {
  value: string
  onValueChange: (value: string) => void
  /** Fill the rest of a toolbar row instead of sizing to its own width. */
  grow?: boolean
  /** Escape empties the field. Off inside a dialog, where Escape closes it. */
  clearOnEscape?: boolean
  clearLabel?: string
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ value, onValueChange, grow, clearOnEscape, clearLabel = "Clear search", className, onKeyDown, ...props }, ref) => (
    <Input
      ref={ref}
      type="text"
      value={value}
      onChange={e => onValueChange(e.target.value)}
      onKeyDown={e => {
        if (clearOnEscape && e.key === "Escape") onValueChange("")
        onKeyDown?.(e)
      }}
      leading={<Search className="h-[15px] w-[15px]" />}
      trailing={value ? (
        <IconButton size="sm" onClick={() => onValueChange("")} aria-label={clearLabel}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      ) : null}
      className={[grow ? "search-field--grow" : "", className ?? ""].join(" ").trim() || undefined}
      {...props}
    />
  )
)
SearchField.displayName = "SearchField"
