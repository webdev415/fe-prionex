/**
 * CreateTemplateModal Component
 *
 * Modal for creating a new SMS template.
 */

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

  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Add size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.smsTemplates.modals.create.title')}
      />
      <ModalContent>
        <CreateTemplateForm onSuccess={handleSuccess} onCancel={onClose} />
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} className="h-[45px] flex-1">
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="create-template-form"
          variant="primary"
          className="h-[45px] flex-1"
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
