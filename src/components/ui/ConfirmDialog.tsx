/**
 * ConfirmDialog Component
 *
 * A styled confirmation dialog that replaces the native `window.confirm`.
 * Built on the global Modal component for consistent styling. For the common
 * imperative flow (`if (!confirm(...)) return`) pair this with `useConfirm`.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

export type ConfirmTone = 'danger' | 'default'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` shows an alert icon + red confirm button (destructive actions). */
  tone?: ConfirmTone
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common')
  const isDanger = tone === 'danger'

  return (
    <Modal open={open} onClose={onCancel} maxWidth="md">
      <ModalHeader
        icon={
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              isDanger ? 'bg-error-100' : 'bg-primary-400'
            }`}
          >
            {isDanger ? (
              <Icons.Warning size={20} className="text-error-600" strokeWidth={2} />
            ) : (
              <Icons.Info size={20} className="text-dark-500" strokeWidth={2} />
            )}
          </div>
        }
        title={title}
      />
      {message && (
        <ModalContent>
          <p className="text-dark-500 text-base font-light">{message}</p>
        </ModalContent>
      )}
      <ModalFooter className={message ? undefined : 'pt-4'}>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
          className="h-[45px] flex-1 rounded-md border-none bg-gray-500 text-sm font-medium text-white"
        >
          {cancelLabel ?? t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          variant={isDanger ? 'danger' : 'primary'}
          className="h-[45px] flex-1 rounded-md border-none text-sm font-medium text-white"
        >
          {confirmLabel ?? t('actions.confirm', 'Confirm')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default ConfirmDialog
