/**
 * ArchiveGroupModal - Archive (soft delete) a group.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { useGroup, useArchiveGroup } from '@/features/groups'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

interface ArchiveGroupModalProps {
  open: boolean
  groupId: number
  onClose: () => void
  onSuccess: () => void
}

export function ArchiveGroupModal({ open, groupId, onClose, onSuccess }: ArchiveGroupModalProps) {
  const { t } = useTranslation('common')
  const { data: group, isLoading, error } = useGroup(groupId)
  const archiveMutation = useArchiveGroup()

  const handleArchive = () => {
    if (!group) return
    archiveMutation.mutate(
      { id: group.id },
      {
        onSuccess: () => {
          onSuccess()
          onClose()
        },
      }
    )
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Delete size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={
          group
            ? t('pages.groups.modals.archive.title', { groupName: group.name })
            : t('pages.groups.modals.archive.defaultTitle')
        }
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : error ? (
          <Alert variant="error">
            <p className="text-sm">
              {error?.message || t('pages.groups.modals.archive.failedToLoad')}
            </p>
          </Alert>
        ) : group ? (
          <div className="space-y-6">
            <p className="text-sm font-light text-gray-950">
              {t('pages.groups.modals.archive.confirmMessage', { groupName: group.name })}
            </p>
            {(group.assigned_operators_count ?? 0) > 0 && (
              <Alert variant="warning">
                <p className="text-sm">
                  {t('pages.groups.modals.archive.hasAssignedOperators', {
                    count: group.assigned_operators_count,
                  })}
                </p>
              </Alert>
            )}
            {archiveMutation.isError && (
              <Alert variant="error">
                <p className="text-sm">
                  {archiveMutation.error?.message ||
                    t('pages.groups.modals.archive.failedToArchive')}
                </p>
              </Alert>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">{t('pages.groups.modals.archive.groupNotFound')}</p>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleArchive}
          className="h-[45px] flex-1 text-sm"
          disabled={archiveMutation.isPending || isLoading || !group}
        >
          {archiveMutation.isPending
            ? t('pages.groups.modals.archive.archiving')
            : t('pages.groups.modals.archive.archiveGroup')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
