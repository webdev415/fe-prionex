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

export function Modal({ open, onClose, children, className, maxWidth = 'md' }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Backdrop with blur */}
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/30 backdrop-blur-xl" />

        {/* Full-screen container - responsive padding */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className={cn(
              'bg-light-50 relative z-50 max-h-[90vh] w-full rounded-lg shadow-xl',
              'p-4 sm:p-6 md:p-8 lg:p-10', // Responsive padding
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
              'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
              'duration-200',
              // Responsive max-width - smaller on mobile, larger on desktop
              maxWidth === 'sm' && 'max-w-sm',
              maxWidth === 'md' && 'max-w-md sm:max-w-lg',
              maxWidth === 'lg' && 'max-w-md sm:max-w-lg md:max-w-xl',
              maxWidth === 'xl' && 'max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl',
              maxWidth === '2xl' && 'max-w-[95%] sm:max-w-lg md:max-w-xl lg:max-w-2xl',
              maxWidth === 'full' && 'max-w-[95%] sm:max-w-full',
              className
            )}
          >
            <DialogPrimitive.Close asChild>
              <button
                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100 sm:top-4 sm:right-4"
                aria-label="Close modal"
              >
                <Icon icon={Cancel01Icon} size={18} className="text-dark-500" strokeWidth={1.5} />
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
    <div className={cn('border-light-200 flex items-center border-b p-0 pb-2 sm:pb-3', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <DialogPrimitive.Title className="text-dark-500 min-w-0 text-lg font-medium break-words sm:text-xl md:text-2xl">
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
        'modal-content-scroll max-h-[calc(90vh-140px)] max-w-full overflow-auto sm:max-h-[calc(90vh-180px)] md:max-h-[calc(90vh-200px)]',
        'px-0 py-4 sm:px-1 sm:py-5 md:py-6', // Responsive padding
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
        'border-light-200 flex flex-row items-stretch justify-end gap-2 border-t sm:flex-row sm:items-center sm:gap-3',
        'pt-3 sm:pt-4', // Responsive padding
        className
      )}
    >
      {children}
    </div>
  )
}

export default Modal
