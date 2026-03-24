/**
 * Delete Tag Dialog
 *
 * Confirmation dialog for deleting tags with usage warning.
 */

import { useTranslation } from 'react-i18next'
import { useDeleteTag } from '@/features/tags'
import type { Tag } from '@/features/tags'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { TagBadge } from '@/components/ui/TagBadge'
import { Icons } from '@/lib/icons'

interface DeleteTagDialogProps {
  open: boolean
  tag: Tag
  onClose: () => void
  onSuccess: () => void
}

export function DeleteTagDialog({ open, tag, onClose, onSuccess }: DeleteTagDialogProps) {
  const { t } = useTranslation('common')
  const deleteMutation = useDeleteTag()

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(tag.id)
      onSuccess()
    } catch (error) {
      console.error('Failed to delete tag:', error)
    }
  }

  const hasClients = (tag.client_count || 0) > 0

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Delete size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.tags.deleteTag', 'Delete Tag')}
      />

      <ModalContent>
        <div className="space-y-4">
          <p className="text-dark-500 text-base font-light">
            {t('pages.tags.deleteConfirmation', 'Are you sure you want to delete this tag?')}
          </p>

          {/* Tag Preview */}
          <TagBadge name={tag.name} color={tag.color} size="md" />

          {/* Usage Warning */}
          {hasClients && (
            <Alert variant="warning">
              <div className="space-y-2">
                <p className="font-medium">
                  {t('pages.tags.usageWarning', 'This tag is currently in use')}
                </p>
                <p className="text-sm">
                  {t(
                    'pages.tags.deleteWarningMessage',
                    'This tag is assigned to {{count}} client(s). Deleting it will remove the tag from all clients.',
                    { count: tag.client_count }
                  )}
                </p>
              </div>
            </Alert>
          )}

          <p className="text-dark-500 text-sm font-light">
            {t('pages.tags.deleteNotice', 'This action cannot be undone.')}
          </p>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={deleteMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {deleteMutation.isPending ? t('pages.tags.deleting', 'Deleting...') : t('actions.delete')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
