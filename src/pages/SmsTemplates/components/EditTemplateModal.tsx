/**
 * EditTemplateModal Component
 *
 * Modal for editing an existing SMS template.
 */

import React from 'react'
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
  const [exceedsLimit, setExceedsLimit] = React.useState(false)

  const { data: apiTemplate, isLoading } = useSMSTemplate(templateId)
  const template = apiTemplate ? mapTemplateResponseToSmsTemplate(apiTemplate) : null

  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  const handleLimitChange = (exceeds: boolean) => {
    setExceedsLimit(exceeds)
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.smsTemplates.modals.edit.title')}
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : template ? (
          <EditTemplateForm
            template={template}
            onSuccess={handleSuccess}
            onCancel={onClose}
            onLimitChange={handleLimitChange}
          />
        ) : (
          <div className="py-8 text-center text-gray-600">
            {t('pages.smsTemplates.modals.templateNotFound')}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} className="h-[45px] flex-1">
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="edit-template-form"
          variant="primary"
          className="h-[45px] flex-1"
          disabled={exceedsLimit}
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
