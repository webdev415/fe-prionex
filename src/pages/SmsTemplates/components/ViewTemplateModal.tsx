/**
 * ViewTemplateModal Component
 *
 * Modal for viewing SMS template details.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { ViewTemplateForm } from './ViewTemplateForm'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { useSMSTemplate } from '@/features/sms'
import { mapTemplateResponseToSmsTemplate } from '../utils'

interface ViewTemplateModalProps {
  open: boolean
  templateId: number
  onClose: () => void
}

export function ViewTemplateModal({ open, templateId, onClose }: ViewTemplateModalProps) {
  const { t } = useTranslation('common')

  const { data: apiTemplate, isLoading } = useSMSTemplate(templateId)
  const template = apiTemplate ? mapTemplateResponseToSmsTemplate(apiTemplate) : null

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.View size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.smsTemplates.modals.view.title')}
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : template ? (
          <ViewTemplateForm template={template} />
        ) : (
          <div className="py-8 text-center text-gray-600">
            {t('pages.smsTemplates.modals.templateNotFound')}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} className="h-[45px] flex-1">
          {t('actions.close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
