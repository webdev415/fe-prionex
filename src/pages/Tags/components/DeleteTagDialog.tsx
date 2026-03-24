/**
 * Deactivate Tag Dialog
 *
 * Confirmation dialog for deactivating tags (soft-disable, not delete).
 * Tags can be reactivated later.
 */

import { useTranslation } from 'react-i18next'
import { useUpdateTag } from '@/features/tags'
import type { Tag } from '@/features/tags'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { TagBadge } from '@/components/ui/TagBadge'
import { Icons } from '@/lib/icons'

interface DeactivateTagDialogProps {
  open: boolean
  tag: Tag
  onClose: () => void
  onSuccess: () => void
}

export function DeactivateTagDialog({ open, tag, onClose, onSuccess }: DeactivateTagDialogProps) {
  const { t } = useTranslation('common')
  const updateMutation = useUpdateTag()

  const handleDeactivate = async () => {
    try {
      await updateMutation.mutateAsync({ id: tag.id, data: { is_active: false } })
      onSuccess()
    } catch (error) {
      console.error('Failed to deactivate tag:', error)
    }
  }

  const hasClients = (tag.client_count || 0) > 0

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
            <Icons.Cancel01 size={20} className="text-amber-600" strokeWidth={2} />
          </div>
        }
        title={t('pages.tags.deactivateTag', 'Деактивировать тег')}
      />

      <ModalContent>
        <div className="space-y-4">
          <p className="text-dark-500 text-base font-light">
            {t(
              'pages.tags.deactivateConfirmation',
              'Вы уверены, что хотите деактивировать тег "{{name}}"?',
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
                  {t('pages.tags.usageWarning', 'This tag is currently in use')}
                </p>
                <p className="text-sm">
                  {t(
                    'pages.tags.deactivateWarningMessage',
                    'Этот тег назначен {{count}} клиенту(ам). Деактивация скроет его, но сохранит историю.',
                    { count: tag.client_count }
                  )}
                </p>
              </div>
            </Alert>
          )}

          <Alert variant="info">
            <p className="text-sm">
              {t('pages.tags.deactivateNotice', 'Тег можно будет активировать позже.')}
            </p>
          </Alert>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={updateMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleDeactivate}
          disabled={updateMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {updateMutation.isPending
            ? t('pages.tags.deactivating', 'Деактивация...')
            : t('pages.tags.actions.deactivate', 'Деактивировать')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

// Keep backward-compatible export
export { DeactivateTagDialog as DeleteTagDialog }
