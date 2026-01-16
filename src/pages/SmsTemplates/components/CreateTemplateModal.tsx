/**
 * CreateTemplateModal Component
 *
 * Modal for creating a new SMS template.
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { CreateTemplateForm } from '@/pages/SmsTemplates/components/CreateTemplateForm'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'

interface CreateTemplateModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateTemplateModal({ open, onClose, onSuccess }: CreateTemplateModalProps) {
  const { t } = useTranslation('common')
  const [exceedsLimit, setExceedsLimit] = React.useState(false)

  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  const handleLimitChange = (exceeds: boolean) => {
    setExceedsLimit(exceeds)
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
          <div className="bg-primary-300 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Add size={18} className="text-dark-500 sm:size-5" strokeWidth={2} />
          </div>
        }
        title={t('pages.smsTemplates.modals.create.title')}
      />
      <ModalContent>
        <CreateTemplateForm
          onSuccess={handleSuccess}
          onCancel={onClose}
          onLimitChange={handleLimitChange}
        />
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
          form="create-template-form"
          variant="primary"
          className="h-10 w-full flex-1 text-xs sm:h-[45px] sm:text-sm"
          disabled={exceedsLimit}
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
