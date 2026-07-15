import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { SettingsReplyTemplate } from '../../../settings/types'

interface DeleteLetterTemplateModalProps {
  open: boolean
  template: SettingsReplyTemplate | null
  onClose: () => void
  onConfirm: () => void | Promise<void>
  isDeleting?: boolean
}

export function DeleteLetterTemplateModal({
  open,
  template,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeleteLetterTemplateModalProps) {
  const { t } = useTranslation('common')

  const templateName = template ? t(template.nameKey, template.nameFallback) : ''

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <div className="flex flex-col gap-4">
        <DialogPrimitive.Title className="text-dark-500 text-lg font-semibold">
          {t('pages.lawyerWorkplace.settings.templates.deleteReplyTitle', 'Delete letter template')}
        </DialogPrimitive.Title>
        <p className="text-sm text-gray-700">
          {t(
            'pages.lawyerWorkplace.settings.templates.deleteReplyConfirm',
            'Are you sure you want to delete this letter template?'
          )}{' '}
          <span className="text-dark-500 font-medium">{templateName}</span>
        </p>
        <p className="text-xs text-gray-500">
          {t(
            'pages.lawyerWorkplace.settings.templates.deleteReplyWarning',
            'This action cannot be undone.'
          )}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button variant="danger" onClick={() => void onConfirm()} disabled={isDeleting}>
            {isDeleting ? t('actions.deleting', 'Deleting…') : t('actions.delete', 'Delete')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
