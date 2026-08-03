/**
 * Confirmation modal for deleting a document template (KAN-403 Tab 2).
 */

import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
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
      <ModalHeader
        icon={
          <div className="bg-destructive flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Delete
              size={18}
              className="text-destructive-foreground sm:size-5"
              strokeWidth={2}
            />
          </div>
        }
        title={t('pages.documentGeneration.templates.modals.deleteTitle', 'Delete template')}
      />
      <ModalContent>
        <div className="flex flex-col gap-2">
          <p className="text-foreground text-xs sm:text-sm">
            {t(
              'pages.documentGeneration.templates.modals.deleteConfirm',
              'Are you sure you want to delete this template?'
            )}{' '}
            <span className="text-foreground font-medium">{template?.name}</span>
          </p>
          <p className="text-muted-foreground text-xs">
            {t(
              'pages.documentGeneration.templates.modals.deleteWarning',
              'This action cannot be undone.'
            )}
          </p>
        </div>
      </ModalContent>
      <ModalFooter className="flex-col-reverse gap-2 sm:flex-row">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={mutation.isPending}
          className="h-10 w-full flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="danger"
          onClick={handleDelete}
          disabled={mutation.isPending}
          className="h-10 w-full flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {mutation.isPending ? t('actions.deleting', 'Deleting…') : t('actions.delete', 'Delete')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
