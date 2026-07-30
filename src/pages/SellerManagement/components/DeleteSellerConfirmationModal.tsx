/**
 * DeleteSellerConfirmationModal Component
 *
 * Confirmation modal for deleting a seller.
 * Uses the global Modal component for consistent styling.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

interface DeleteSellerConfirmationModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function DeleteSellerConfirmationModal({
  open,
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteSellerConfirmationModalProps) {
  const { t } = useTranslation('common')

  return (
    <Modal open={open} onClose={onCancel} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Delete size={18} className="text-foreground" strokeWidth={2} />
          </div>
        }
        title={t('pages.sellers.modals.delete.title')}
      />
      <ModalContent>
        <div className="text-foreground space-y-2 text-base font-light">
          <p>{t('pages.sellers.modals.delete.confirmMessage.question')}</p>
          <p>{t('pages.sellers.modals.delete.confirmMessage.warning')}</p>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onCancel}
          disabled={isLoading}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={onConfirm}
          disabled={isLoading}
          className="h-[45px] flex-1 text-sm"
        >
          {isLoading
            ? t('pages.sellers.modals.delete.deleting')
            : t('pages.sellers.modals.delete.deleteSeller')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default DeleteSellerConfirmationModal
