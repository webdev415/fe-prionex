/**
 * ArchiveDepartmentModal Component
 *
 * Modal for archiving a department.
 * Simpler than role archive since departments don't have direct user assignment.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { useDepartment, useArchiveDepartment } from '@/features/departments'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

interface ArchiveDepartmentModalProps {
  open: boolean
  departmentId: number
  onClose: () => void
  onSuccess: () => void
}

export function ArchiveDepartmentModal({
  open,
  departmentId,
  onClose,
  onSuccess,
}: ArchiveDepartmentModalProps) {
  const { t } = useTranslation('common')
  const { data: department, isLoading, error } = useDepartment(departmentId)
  const archiveMutation = useArchiveDepartment()

  const handleArchive = () => {
    if (!department) return

    archiveMutation.mutate(
      { id: department.id },
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
          department
            ? t('pages.departments.modals.archive.title', { departmentName: department.name })
            : t('pages.departments.modals.archive.defaultTitle')
        }
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : error ? (
          <Alert variant="error">
            <p className="text-sm">
              {error?.message || t('pages.departments.modals.archive.failedToLoad')}
            </p>
          </Alert>
        ) : department ? (
          <div className="space-y-6">
            {/* Warning message */}
            <div>
              <p className="text-sm font-light text-gray-950">
                {t('pages.departments.modals.archive.confirmMessage', {
                  departmentName: department.name,
                })}
              </p>
            </div>

            {/* Show assigned roles count if any */}
            {(department.assigned_roles_count ?? 0) > 0 && (
              <Alert variant="warning">
                <p className="text-sm">
                  {t('pages.departments.modals.archive.hasAssignedRoles', {
                    count: department.assigned_roles_count,
                  })}
                </p>
              </Alert>
            )}

            {/* Error from API */}
            {archiveMutation.isError && (
              <Alert variant="error">
                <p className="text-sm">
                  {archiveMutation.error?.message ||
                    t('pages.departments.modals.archive.failedToArchive')}
                </p>
              </Alert>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-600">
            {t('pages.departments.modals.archive.departmentNotFound')}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={archiveMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleArchive}
          disabled={
            archiveMutation.isPending || isLoading || (department?.assigned_roles_count ?? 0) > 0
          }
          className="text-dark-500 bg-primary-300 h-[45px] flex-1 text-sm"
        >
          {archiveMutation.isPending
            ? t('pages.departments.modals.archive.archiving')
            : t('pages.departments.modals.archive.archiveDepartment')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
