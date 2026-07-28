/**
 * RoleDetailModal Component
 *
 * Modal for viewing role details using the same structure as EditRoleModal.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
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
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.View size={18} className="text-foreground" strokeWidth={2} />
          </div>
        }
        title={t('pages.roles.modals.view.title')}
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : role && project ? (
          <ViewRoleForm role={role} projectName={project.name} />
        ) : (
          <div className="text-muted-foreground py-8 text-center">
            {t('pages.roles.modals.archive.failedToLoad')}
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
