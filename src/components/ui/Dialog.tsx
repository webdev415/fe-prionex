/**
 * Dialog Component
 *
 * Modal dialog built with Radix UI.
 * Used for confirmations, forms, and other modal interactions.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/30" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Content
            className={cn(
              'z-50 mx-auto max-w-md rounded-lg bg-white p-6 shadow-xl',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
              'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
              'duration-200',
              className
            )}
          >
            {children}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

interface DialogTitleProps {
  children: React.ReactNode
  className?: string
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title className={cn('text-lg font-semibold text-gray-900', className)}>
      {children}
    </DialogPrimitive.Title>
  )
}

interface DialogDescriptionProps {
  children: React.ReactNode
  className?: string
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description className={cn('mt-2 text-sm text-gray-600', className)}>
      {children}
    </DialogPrimitive.Description>
  )
}

interface DialogFooterProps {
  children: React.ReactNode
  className?: string
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return <div className={cn('mt-6 flex justify-end gap-3', className)}>{children}</div>
}
