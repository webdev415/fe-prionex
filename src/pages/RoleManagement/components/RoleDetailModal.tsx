/**
 * RoleDetailModal Component
 *
 * Modal for viewing role details using the same structure as EditRoleModal.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ViewRoleForm } from '@/features/roles/components/ViewRoleForm'
import { useRole } from '@/features/roles/hooks/useRole'
import { useProject } from '@/features/projects/hooks/useProject'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'

interface RoleDetailModalProps {
  open: boolean
  roleId: number
  onClose: () => void
}

export function RoleDetailModal({ open, roleId, onClose }: RoleDetailModalProps) {
  const { t } = useTranslation('common')
  const { data: role, isLoading: roleLoading } = useRole(roleId)
  const { data: project, isLoading: projectLoading } = useProject(role?.project_id ?? 0, {
    enabled: !!role?.project_id && role.project_id > 0,
  })

  const isLoading = roleLoading || (role?.project_id ? projectLoading : false)

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.View size={20} color="#05040D" strokeWidth={2} />
          </div>
        }
        title={t('pages.roles.modals.view.title')}
      />
      <ModalContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
            <span className="ml-3 text-gray-600">
              {t('pages.roles.modals.archive.loadingRoleData')}
            </span>
          </div>
        ) : role && project ? (
          <ViewRoleForm role={role} projectName={project.name} />
        ) : (
          <div className="py-8 text-center text-gray-600">
            {t('pages.roles.modals.archive.failedToLoad')}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          className="h-[45px] flex-1 rounded-md border-none bg-gray-500 text-sm font-medium text-white"
        >
          {t('actions.close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
