/**
 * Delete Tag Dialog
 *
 * Confirmation dialog for deleting tags with warning if tag is assigned to clients.
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
            <Icons.Cancel01 size={20} className="text-red-600" strokeWidth={2} />
          </div>
        }
        title={t('pages.tags.deleteTag', 'Удалить тег')}
      />

      <ModalContent>
        <div className="space-y-4">
          <p className="text-dark-500 text-base font-light">
            {t(
              'pages.tags.deleteTagConfirmation',
              'Вы уверены, что хотите удалить тег "{{name}}"?',
              { name: tag.name }
            )}
          </p>

          {/* Tag Preview */}
          <TagBadge name={tag.name} color={tag.color} size="md" />

          {/* Usage Warning */}
          {hasClients && (
            <Alert variant="warning">
              <div className="space-y-2">
                <p className="font-medium">
                  {t('pages.tags.usageWarning', 'Этот тег используется')}
                </p>
                <p className="text-sm">
                  {t(
                    'pages.tags.deleteTagWarningMessage',
                    'Этот тег назначен {{count}} клиенту(ам). Удаление снимет тег со всех клиентов. Это действие необратимо.',
                    { count: tag.client_count }
                  )}
                </p>
              </div>
            </Alert>
          )}

          {!hasClients && (
            <Alert variant="info">
              <p className="text-sm">
                {t(
                  'pages.tags.deleteTagNotice',
                  'Это действие необратимо. Тег будет удалён из системы.'
                )}
              </p>
            </Alert>
          )}
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
          {t('actions.cancel', 'Отмена')}
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {deleteMutation.isPending
            ? t('pages.tags.deleting', 'Удаление...')
            : t('actions.delete', 'Удалить')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
