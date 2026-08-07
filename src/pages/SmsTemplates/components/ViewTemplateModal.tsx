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
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="2xl"
      className="w-[95%] max-w-[900px] sm:w-[900px]"
    >
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.View size={18} className="text-primary-foreground sm:size-5" strokeWidth={2} />
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
          <div className="text-muted-foreground py-8 text-center">
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
          {t('actions.close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
