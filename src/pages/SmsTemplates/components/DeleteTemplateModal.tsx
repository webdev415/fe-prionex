/**
 * DeleteTemplateModal Component
 *
 * Modal for confirming template deletion.
 */

import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert'
import { useDeleteTemplate, useSMSTemplate } from '@/features/sms'
import { mapTemplateResponseToSmsTemplate } from '../utils'
import { getErrorMessage } from '@/lib/errors'

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
  const deleteTemplateMutation = useDeleteTemplate()
  const { data: apiTemplate } = useSMSTemplate(templateId)
  const template = apiTemplate ? mapTemplateResponseToSmsTemplate(apiTemplate) : null

  const handleDelete = async () => {
    if (!template) return

    try {
      await deleteTemplateMutation.mutateAsync(template.id)
      toast.success(t('pages.smsTemplates.messages.templateDeleted') || 'Template deleted successfully')
      onSuccess()
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const isDeleting = deleteTemplateMutation.isPending

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
