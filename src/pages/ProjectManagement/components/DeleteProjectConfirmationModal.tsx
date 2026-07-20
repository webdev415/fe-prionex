/**
 * DeleteProjectConfirmationModal Component
 *
 * Confirmation modal for deleting a project.
 * Uses the global Modal component for consistent styling.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

interface DeleteProjectConfirmationModalProps {
  open: boolean
  projectName: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function DeleteProjectConfirmationModal({
  open,
  projectName,
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteProjectConfirmationModalProps) {
  const { t } = useTranslation('common')

  return (
    <Modal open={open} onClose={onCancel} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Delete size={18} className="text-foreground" strokeWidth={2} />
          </div>
        }
        title={t('pages.projects.modals.delete.title', { projectName })}
      />
      <ModalContent>
        <p className="text-foreground text-base font-light">
          {t('pages.projects.modals.delete.confirmMessage')}
        </p>
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
            ? t('pages.projects.modals.delete.deleting')
            : t('pages.projects.modals.delete.deleteProject')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
