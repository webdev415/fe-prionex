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
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full'
  showCloseButton?: boolean
  preventOutsideClose?: boolean
  /**
   * Skip the overlay's backdrop blur.
   *
   * The default `backdrop-filter: blur(24px)` promotes the overlay to its own
   * compositing layer and degrades sub-pixel sharpness on adjacent rasterised
   * content for some screen-capture paths (browser QR-scan extensions, in
   * particular). Opt out here when the modal contains a scannable image.
   */
  noBackdropBlur?: boolean
  /**
   * Render in non-modal mode (Radix `modal={false}`).
   *
   * Disables focus trap, body scroll lock, and pointer-event capture on the
   * overlay so external tools (e.g. browser QR-scan extensions that drag a
   * region across the viewport) can interact with the page underneath. We
   * still render a `pointer-events: none` dim layer so the modal stays
   * visually prominent.
   */
  nonModal?: boolean
}

export function Modal({
  open,
  onClose,
  children,
  className,
  maxWidth = 'md',
  showCloseButton = true,
  preventOutsideClose = false,
  noBackdropBlur = false,
  nonModal = false,
}: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(open) => !open && onClose()} modal={!nonModal}>
      <DialogPrimitive.Portal>
        {nonModal ? (
          // Radix returns null for <Overlay /> when modal=false, so we paint
          // our own dim layer that does not capture pointer events.
          <div
            aria-hidden
            className={cn(
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 pointer-events-none fixed inset-0 z-50 bg-black/30',
              !noBackdropBlur && 'backdrop-blur-xl'
            )}
            data-state={open ? 'open' : 'closed'}
          />
        ) : (
          <DialogPrimitive.Overlay
            className={cn(
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/30',
              !noBackdropBlur && 'backdrop-blur-xl'
            )}
          />
        )}

        {/* Modal Content.
            - Modal mode: wrapped in a full-screen flex container that centers
              the Content (Content uses w-full + max-w-*).
            - nonModal mode: the wrapper would sit between Content and the
              Portal as a `pointer-events-none` ancestor, which empirically
              causes a first-click-swallow on Chrome (pointer events get
              delivered to a state-transitioning ancestor instead of the
              button). We skip the wrapper and absolutely-position Content
              directly so its hit-test box is the only interactive layer in
              the Portal. */}
        {nonModal ? (
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onInteractOutside={preventOutsideClose ? (e) => e.preventDefault() : undefined}
            onEscapeKeyDown={preventOutsideClose ? (e) => e.preventDefault() : undefined}
            className={cn(
              'bg-card fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg shadow-xl sm:w-[calc(100%-2rem)]',
              'p-4 sm:p-6 md:p-8 lg:p-10',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              'duration-200',
              maxWidth === 'sm' && 'max-w-sm',
              maxWidth === 'md' && 'max-w-md sm:max-w-lg',
              maxWidth === 'lg' && 'max-w-md sm:max-w-lg md:max-w-xl',
              maxWidth === 'xl' && 'max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl',
              maxWidth === '2xl' && 'max-w-[95%] sm:max-w-lg md:max-w-xl lg:max-w-2xl',
              maxWidth === '3xl' && 'max-w-[95%] sm:max-w-xl md:max-w-3xl lg:max-w-4xl',
              maxWidth === 'full' && 'max-w-[95%] sm:max-w-full',
              className
            )}
          >
            {showCloseButton && (
              <DialogPrimitive.Close asChild>
                <button
                  className="hover:bg-muted absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md transition-colors sm:top-4 sm:right-4"
                  aria-label="Close modal"
                >
                  <Icon
                    icon={Cancel01Icon}
                    size={18}
                    className="text-foreground"
                    strokeWidth={1.5}
                  />
                </button>
              </DialogPrimitive.Close>
            )}
            {children}
          </DialogPrimitive.Content>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <DialogPrimitive.Content
              aria-describedby={undefined}
              onInteractOutside={preventOutsideClose ? (e) => e.preventDefault() : undefined}
              onEscapeKeyDown={preventOutsideClose ? (e) => e.preventDefault() : undefined}
              className={cn(
                'bg-card relative z-50 max-h-[90vh] w-full rounded-lg shadow-xl',
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
                maxWidth === '3xl' && 'max-w-[95%] sm:max-w-xl md:max-w-3xl lg:max-w-4xl',
                maxWidth === 'full' && 'max-w-[95%] sm:max-w-full',
                className
              )}
            >
              {showCloseButton && (
                <DialogPrimitive.Close asChild>
                  <button
                    className="hover:bg-muted absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-md transition-colors sm:top-4 sm:right-4"
                    aria-label="Close modal"
                  >
                    <Icon
                      icon={Cancel01Icon}
                      size={18}
                      className="text-foreground"
                      strokeWidth={1.5}
                    />
                  </button>
                </DialogPrimitive.Close>
              )}
              {children}
            </DialogPrimitive.Content>
          </div>
        )}
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
    <div className={cn('border-border flex items-center border-b p-0 pb-2 sm:pb-3', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <DialogPrimitive.Title className="text-foreground min-w-0 text-lg font-medium break-words sm:text-xl md:text-2xl">
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
        'border-border flex flex-row items-stretch justify-end gap-2 border-t sm:flex-row sm:items-center sm:gap-3',
        'pt-3 sm:pt-4', // Responsive padding
        className
      )}
    >
      {children}
    </div>
  )
}

/** Accessible dialog title — required by Radix inside DialogContent. */
export const ModalTitle = DialogPrimitive.Title

export default Modal
