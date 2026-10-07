import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

/**
 * A modal whose look belongs to its caller: a sheet, a palette, a full-screen
 * menu. The caller passes its own scrim class and its own panel element; Radix
 * supplies the behaviour every modal owes the keyboard and the screen reader:
 * focus moves in and is trapped, `role="dialog"` + `aria-modal`, Escape and a
 * click on the scrim close it, the page behind stops scrolling, and focus
 * returns to whatever opened it.
 *
 * Use `Dialog` for an ordinary centred dialog; use this when the surface has a
 * shape of its own. Five overlays were hand-rolled before this existed (LEDGER
 * A-10): none trapped focus, and the mobile menu ignored Escape.
 *
 * `label` names the dialog for assistive tech (a visually hidden title), so it
 * is required even when the panel shows its own heading.
 */
export function Modal({ label, onClose, overlayClassName, children }: {
  label: string
  onClose: () => void
  overlayClassName: string
  /** The panel: one element, which becomes the dialog. */
  children: React.ReactElement<{ children?: React.ReactNode }>
}) {
  const panel = React.Children.only(children)
  /* Radix returns focus to its own `Trigger`. These modals are opened by
     ordinary buttons and unmounted by their parent, so the element that had
     focus when this one mounted is remembered and given focus back. */
  const [returnTo] = React.useState(() => document.activeElement as HTMLElement | null)
  const mounted = React.useRef(false)
  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      // Deferred, and only if still unmounted: StrictMode remounts at once.
      setTimeout(() => { if (!mounted.current && returnTo?.isConnected) returnTo.focus() })
    }
  }, [returnTo])
  return (
    <DialogPrimitive.Root open onOpenChange={open => { if (!open) onClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClassName}>
          <DialogPrimitive.Content
            asChild
            aria-modal="true"
            aria-describedby={undefined}
            className="modal-panel"
            /* Focus lands on the panel itself, which screen readers announce
               by its label, unless something inside already took it
               (`autoFocus`). Radix's default, the first tabbable, put a focus
               ring on the close button the moment a mouse opened the dialog. */
            onOpenAutoFocus={event => {
              event.preventDefault()
              const panelEl = event.currentTarget as HTMLElement
              if (!panelEl.contains(document.activeElement)) panelEl.focus()
            }}
            onCloseAutoFocus={event => event.preventDefault()}
          >
            {React.cloneElement(panel, undefined, (
              <>
                <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
                {panel.props.children}
              </>
            ))}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
