import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'

/**
 * Pickers and details open here: full height on a phone, a side panel on desktop
 * (DESIGN.md, "Phone"). Focus is trapped and Escape closes it.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col bg-panel shadow-float md:inset-y-0 md:right-0 md:left-auto md:w-[min(560px,100vw)] md:border-l md:border-rule"
          // Radix links the description automatically; with none, say so explicitly.
          {...(description ? {} : { 'aria-describedby': undefined })}
          // Focus the field marked data-autofocus (a picker's search box) instead of the close button.
          onOpenAutoFocus={(event) => {
            const target = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[data-autofocus]')
            if (target) {
              event.preventDefault()
              target.focus()
            }
          }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3 md:px-6">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-20">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-ink-2">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink-2 hover:bg-raised hover:text-ink md:size-9"
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">{children}</div>
          {footer ? <div className="border-t border-rule px-4 py-3 md:px-6">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
