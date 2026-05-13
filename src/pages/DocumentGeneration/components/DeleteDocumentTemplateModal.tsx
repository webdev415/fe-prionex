/**
 * Confirmation modal for deleting a document template (KAN-403 Tab 2).
 */

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useDeleteDocumentTemplate, type DocumentTemplate } from '@/features/documents'

interface Props {
  open: boolean
  template: DocumentTemplate | null
  onClose: () => void
}

export function DeleteDocumentTemplateModal({ open, template, onClose }: Props) {
  const { t } = useTranslation('common')
  const mutation = useDeleteDocumentTemplate()

  const handleDelete = async () => {
    if (!template) return
    try {
      await mutation.mutateAsync(template.id)
      toast.success(t('pages.documentGeneration.templates.messages.deleted', 'Template deleted'))
      onClose()
    } catch {
      // toast handled by mutation onError
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <div className="flex flex-col gap-4">
        <DialogPrimitive.Title className="text-dark-500 text-lg font-semibold">
          {t('pages.documentGeneration.templates.modals.deleteTitle', 'Delete template')}
        </DialogPrimitive.Title>
        <p className="text-sm text-gray-700">
          {t(
            'pages.documentGeneration.templates.modals.deleteConfirm',
            'Are you sure you want to delete this template?'
          )}{' '}
          <span className="text-dark-500 font-medium">{template?.name}</span>
        </p>
        <p className="text-xs text-gray-500">
          {t(
            'pages.documentGeneration.templates.modals.deleteWarning',
            'This action cannot be undone.'
          )}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={mutation.isPending}>
            {mutation.isPending
              ? t('actions.deleting', 'Deleting…')
              : t('actions.delete', 'Delete')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
