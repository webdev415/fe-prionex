/**
 * DeleteTemplateModal Component
 *
 * Modal for confirming template deletion.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert'
import { mockSmsTemplates } from '../mockSmsTemplates'

interface DeleteTemplateModalProps {
  open: boolean
  templateId: number
  onClose: () => void
  onSuccess: () => void
}

export function DeleteTemplateModal({
  open,
  templateId,
  onClose,
  onSuccess,
}: DeleteTemplateModalProps) {
  const { t } = useTranslation('common')
  const [isDeleting, setIsDeleting] = useState(false)
  // TODO: Replace with actual API hook
  const template = mockSmsTemplates.find((t) => t.id === templateId)

  const handleDelete = async () => {
    if (!template) return

    setIsDeleting(true)
    try {
      // TODO: Replace with actual API call
      console.log('Deleting template:', template.id)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))
      onSuccess()
    } catch (error) {
      console.error('Failed to delete template:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!template) {
    return null
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-error-500 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Delete size={20} className="text-white" strokeWidth={2} />
          </div>
        }
        title={t('pages.smsTemplates.modals.delete.title')}
      />
      <ModalContent>
        <div className="space-y-4">
          <p className="text-dark-500 text-sm">
            {t('pages.smsTemplates.modals.delete.confirmMessage')}{' '}
            <strong>"{template.name}"</strong>?
          </p>
          {template.isSystem && (
            <Alert variant="error">
              <AlertTitle>
                {t('pages.smsTemplates.modals.delete.cannotDeleteSystemTemplate')}
              </AlertTitle>
              <AlertDescription>
                {t('pages.smsTemplates.modals.delete.systemTemplateCannotBeDeleted')}
              </AlertDescription>
            </Alert>
          )}
          {!template.isSystem && (
            <Alert variant="warning">
              <AlertTitle>{t('pages.smsTemplates.modals.delete.actionCannotBeUndone')}</AlertTitle>
              <AlertDescription>
                {t('pages.smsTemplates.modals.delete.templateWillBePermanentlyRemoved')}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={isDeleting}
          className="h-[45px] flex-1"
        >
          {t('actions.cancel')}
        </Button>
        {!template.isSystem && (
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-[45px] flex-1"
          >
            {isDeleting ? t('pages.smsTemplates.modals.delete.deleting') : t('actions.delete')}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  )
}
