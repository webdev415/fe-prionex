/**
 * Modal Component
 *
 * Global modal component with header (icon, title, close button) and footer (action buttons).
 * Built with Radix UI Dialog for consistency with other components.
 * Includes backdrop blur effect.
 */

import { type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Icon, Cancel01Icon } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-full',
}

export function Modal({ open, onClose, children, className, maxWidth = 'md' }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Backdrop with blur */}
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/30 backdrop-blur-xl" />

        {/* Full-screen container */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className={cn(
              'bg-light-50 relative z-50 max-h-[90vh] w-full rounded-lg p-10 shadow-xl',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
              'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
              'duration-200',
              maxWidthClasses[maxWidth],
              className
            )}
          >
            <DialogPrimitive.Close asChild>
              <button
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
                aria-label="Close modal"
              >
                <Icon icon={Cancel01Icon} size={20} className="text-dark-500" strokeWidth={1.5} />
              </button>
            </DialogPrimitive.Close>
            {children}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

interface ModalHeaderProps {
  icon?: ReactNode
  title: ReactNode
  onClose?: () => void
  className?: string
}

export function ModalHeader({ icon, title, className }: ModalHeaderProps) {
  return (
    <div className={cn('border-light-200 flex items-center border-b p-0 pb-2', className)}>
      <div className="flex items-center gap-3">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <DialogPrimitive.Title className="text-dark-500 text-2xl font-medium">
          {title}
        </DialogPrimitive.Title>
      </div>
    </div>
  )
}

interface ModalContentProps {
  children: ReactNode
  className?: string
}

export function ModalContent({ children, className }: ModalContentProps) {
  return (
    <div
      className={cn(
        'modal-content-scroll max-h-[calc(90vh-200px)] max-w-full overflow-auto px-1 py-6',
        className
      )}
    >
      {children}
    </div>
  )
}

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'border-light-200 flex items-center justify-end gap-3 border-t pt-3',
        className
      )}
    >
      {children}
    </div>
  )
}

export default Modal
