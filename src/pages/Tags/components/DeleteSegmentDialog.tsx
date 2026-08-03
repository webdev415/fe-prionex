/**
 * Delete Segment Dialog
 *
 * Confirmation dialog for deleting segments.
 */

import { useTranslation } from 'react-i18next'
import { useDeleteSegment } from '@/features/tags'
import type { Segment } from '@/features/tags'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Icons } from '@/lib/icons'

interface DeleteSegmentDialogProps {
  open: boolean
  segment: Segment
  onClose: () => void
  onSuccess: () => void
}

export function DeleteSegmentDialog({
  open,
  segment,
  onClose,
  onSuccess,
}: DeleteSegmentDialogProps) {
  const { t } = useTranslation('common')
  const deleteMutation = useDeleteSegment()

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(segment.id)
      onSuccess()
    } catch (error) {
      console.error('Failed to delete segment:', error)
    }
  }

  const hasClients = (segment.cached_client_count || 0) > 0

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-error-100 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Cancel01 size={20} className="text-error-600" strokeWidth={2} />
          </div>
        }
        title={t('pages.tags.deleteSegment', 'Delete Segment')}
      />

      <ModalContent>
        <div className="space-y-4">
          <p className="text-foreground text-base font-light">
            {t(
              'pages.tags.deleteSegmentConfirmation',
              'Are you sure you want to delete the segment "{{name}}"?',
              { name: segment.name }
            )}
          </p>

          {hasClients && (
            <Alert variant="warning">
              <div className="space-y-2">
                <p className="font-medium">
                  {t('pages.tags.segmentInUse', 'This segment contains clients')}
                </p>
                <p className="text-sm">
                  {t(
                    'pages.tags.deleteSegmentWarningMessage',
                    'This segment currently includes {{count}} client(s). Deleting it will remove the segment definition. This action cannot be undone.',
                    { count: segment.cached_client_count }
                  )}
                </p>
              </div>
            </Alert>
          )}

          {!hasClients && (
            <Alert variant="info">
              <p className="text-sm">
                {t(
                  'pages.tags.deleteSegmentNotice',
                  'This action cannot be undone. The segment will be permanently removed.'
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
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {deleteMutation.isPending
            ? t('pages.tags.deleting', 'Deleting...')
            : t('actions.delete', 'Delete')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
