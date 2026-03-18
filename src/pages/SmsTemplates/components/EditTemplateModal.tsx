/**
 * EditTemplateModal Component
 *
 * Modal for editing an existing SMS template.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { EditTemplateForm } from './EditTemplateForm'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { useSMSTemplate } from '@/features/sms'
import { mapTemplateResponseToSmsTemplate } from '../utils'

interface EditTemplateModalProps {
  open: boolean
  templateId: number
  onClose: () => void
  onSuccess: () => void
}

export function EditTemplateModal({
  open,
  templateId,
  onClose,
  onSuccess,
}: EditTemplateModalProps) {
  const { t } = useTranslation('common')
  const { data: apiTemplate, isLoading } = useSMSTemplate(templateId)
  const template = apiTemplate ? mapTemplateResponseToSmsTemplate(apiTemplate) : null

  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="2xl"
      className="w-[95%] max-w-[900px] sm:w-[900px]"
    >
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.PencilEdit size={18} className="text-dark-500 sm:size-5" strokeWidth={2} />
          </div>
        }
        title={t('pages.smsTemplates.modals.edit.title')}
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : template ? (
          <EditTemplateForm template={template} onSuccess={handleSuccess} onCancel={onClose} />
        ) : (
          <div className="py-8 text-center text-gray-600">
            {t('pages.smsTemplates.modals.templateNotFound')}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          className="h-10 w-full flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="edit-template-form"
          variant="primary"
          className="h-10 w-full flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
