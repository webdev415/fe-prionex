/**
 * DepartmentDetailModal Component
 *
 * Modal for viewing department details.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { useDepartment } from '@/features/departments'
import { useProject } from '@/features/projects/hooks/useProject'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'

interface DepartmentDetailModalProps {
  open: boolean
  departmentId: number
  onClose: () => void
}

export function DepartmentDetailModal({ open, departmentId, onClose }: DepartmentDetailModalProps) {
  const { t } = useTranslation('common')
  const { data: department, isLoading: departmentLoading } = useDepartment(departmentId)
  const { data: project, isLoading: projectLoading } = useProject(department?.project_id ?? 0, {
    enabled: !!department?.project_id && department.project_id > 0,
  })

  const isLoading = departmentLoading || (department?.project_id ? projectLoading : false)

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.View size={20} className="text-white" strokeWidth={2} />
          </div>
        }
        title={t('pages.departments.modals.view.title')}
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : department && project ? (
          <div className="space-y-6">
            {/* Project Name */}
            <div>
              <Label>{t('pages.departments.forms.project')}</Label>
              <div className="mt-2 text-gray-900">{project.name}</div>
            </div>

            {/* Department Name */}
            <div>
              <Label>{t('pages.departments.forms.name')}</Label>
              <div className="mt-2 text-gray-900">{department.name}</div>
            </div>

            {/* Description */}
            <div>
              <Label>{t('pages.departments.forms.description')}</Label>
              <div className="mt-2 text-gray-900">{department.description || '—'}</div>
            </div>

            {/* Assigned Roles Count */}
            <div>
              <Label>{t('pages.departments.forms.assignedRoles')}</Label>
              <div className="mt-2 text-gray-900">{department.assigned_roles_count || 0}</div>
            </div>

            {/* Status */}
            <div>
              <Label>{t('pages.departments.forms.status')}</Label>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
                    department.is_active
                      ? 'bg-success-100 text-success-700'
                      : 'bg-error-100 text-error-700'
                  }`}
                >
                  {department.is_active
                    ? t('pages.departments.status.active')
                    : t('pages.departments.status.inactive')}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-600">
            {t('pages.departments.modals.view.failedToLoad')}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
