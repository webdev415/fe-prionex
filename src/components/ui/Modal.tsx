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
import { colors } from '@/lib/colors'
import { cn } from '@/lib/utils'

interface ModalProps {
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
        <DialogPrimitive.Overlay
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"
          style={{
            backgroundColor: '#05040D4D',
            backdropFilter: 'blur(14px)',
          }}
        />

        {/* Full-screen container */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Content
            className={cn(
              'relative z-50 w-full rounded-lg shadow-xl',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
              'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
              'duration-200',
              maxWidthClasses[maxWidth],
              className
            )}
            style={{
              backgroundColor: colors.light[50],
              padding: '40px',
              boxShadow:
                '0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 5px 8px -2px rgba(0, 0, 0, 0.08)',
              maxHeight: '90vh',
            }}
          >
            <DialogPrimitive.Close asChild>
              <button
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
                aria-label="Close modal"
              >
                <Icon
                  icon={Cancel01Icon}
                  size={20}
                  color={colors.neutral.dark[500]}
                  strokeWidth={1.5}
                />
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
  title: string
  onClose?: () => void
  className?: string
}

export function ModalHeader({ icon, title, className }: ModalHeaderProps) {
  return (
    <div
      className={cn('flex items-center border-b', className)}
      style={{ borderColor: colors.light[100], padding: '0' }}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <DialogPrimitive.Title
          className="font-medium"
          style={{
            fontSize: '30px',
            fontWeight: 500,
            color: colors.neutral.dark[500],
          }}
        >
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
      className={cn('modal-content-scroll overflow-auto', className)}
      style={{
        maxHeight: 'calc(90vh - 200px)',
        maxWidth: '100%',
        padding: '0',
      }}
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
      className={cn('flex items-center justify-end gap-3 border-t', className)}
      style={{ borderColor: colors.light[100], padding: '12px 0 0 0' }}
    >
      {children}
    </div>
  )
}

export default Modal
