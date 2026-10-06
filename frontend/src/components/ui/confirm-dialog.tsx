import * as React from "react"

import { Button } from "./button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog"

/**
 * "Are you sure?" for an action that is hard to take back.
 *
 * Not dismissable while `busy`: the request is already on its way, and closing
 * would leave the screen showing a state nothing had confirmed. It stays open
 * on failure so the reader can try again or cancel.
 */
export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description: React.ReactNode
  confirmLabel: string
  /** Shown on the confirm button while `busy` ("Deleting…"). */
  busyLabel?: string
  /** `danger` for a destructive confirm (rose); `primary` otherwise. */
  tone?: "primary" | "danger"
  busy?: boolean
  onConfirm: () => void
}

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, busyLabel, tone = "primary", busy = false, onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next) }}>
      <DialogContent material="solid" size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="secondary" size="lg" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} size="lg" loading={busy} onClick={onConfirm}>
            {busy && busyLabel ? busyLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
