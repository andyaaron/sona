import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'

import Button from '@/components/button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  confirmLabel?: string
  cancelLabel?: string
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
  /** Optional body between the title and the buttons (details, an attestation checkbox). */
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  title,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmDisabled = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Initial focus lands on the safe action, not Confirm
  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        data-testid="confirm-dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 text-left shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id={titleId} data-testid="confirm-dialog-title" className="font-medium text-gray-900">
          {title}
        </p>
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            ref={cancelRef}
            data-testid="confirm-dialog-cancel"
            variant="secondary"
            size="sm"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            data-testid="confirm-dialog-confirm"
            variant="primary"
            size="sm"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
