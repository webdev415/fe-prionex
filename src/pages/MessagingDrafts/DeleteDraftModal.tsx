import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useDeleteMessagingDraft } from '@/features/messaging'
import type { MessagingDraft } from '@/features/messaging'

export interface DeleteDraftModalProps {
  draft: MessagingDraft | null
  open: boolean
  onClose: () => void
}

export function DeleteDraftModal({ draft, open, onClose }: DeleteDraftModalProps) {
  const { t } = useTranslation('common')
  const deleteDraftMutation = useDeleteMessagingDraft()

  const handleDelete = async () => {
    if (!draft) return

    try {
      await deleteDraftMutation.mutateAsync(draft.id)
      onClose()
    } catch {
      // Error toast is handled by the mutation hook.
    }
  }

  const isDeleting = deleteDraftMutation.isPending

  if (!draft) {
    return null
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="md"
      className="w-[95%] max-w-[500px] sm:w-[500px]"
    >
      <ModalHeader
        icon={
          <div className="bg-error-500 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Delete size={18} className="text-white sm:size-5" strokeWidth={2} />
          </div>
        }
        title={t('pages.messagingDrafts.delete.title', 'Delete draft')}
      />
      <ModalContent>
        <div className="space-y-4">
          <p className="text-dark-500 text-xs sm:text-sm">
            {t('pages.messagingDrafts.delete.confirmMessage', {
              name: draft.name,
              defaultValue: `Are you sure you want to delete the draft "${draft.name}"?`,
            })}
          </p>
          <Alert variant="warning">
            <AlertTitle>
              {t('pages.messagingDrafts.delete.cannotUndo', 'This action cannot be undone')}
            </AlertTitle>
            <AlertDescription>
              {t(
                'pages.messagingDrafts.delete.permanentRemoval',
                'The draft will be permanently removed.'
              )}
            </AlertDescription>
          </Alert>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={isDeleting}
          className="h-10 w-full flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          disabled={isDeleting}
          isLoading={isDeleting}
          className="h-10 w-full flex-1 text-xs sm:h-[45px] sm:text-sm"
        >
          {t('actions.delete', 'Delete')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
