/**
 * EditRoleModal Component
 *
 * Modal wrapper for EditRoleForm using the same structure as EditUserModal.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { EditRoleForm } from '@/features/roles/components/EditRoleForm'
import { useRole } from '@/features/roles/hooks/useRole'
import { useProject } from '@/features/projects/hooks/useProject'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'

interface EditRoleModalProps {
  open: boolean
  roleId: number
  onClose: () => void
  onSuccess: () => void
}

export function EditRoleModal({ open, roleId, onClose, onSuccess }: EditRoleModalProps) {
  const { t } = useTranslation('common')
  const { data: role, isLoading: roleLoading } = useRole(roleId)
  // Only fetch project if we have a valid project_id
  const { data: project, isLoading: projectLoading } = useProject(role?.project_id ?? 0, {
    enabled: !!role?.project_id && role.project_id > 0,
  })

  const isLoading = roleLoading || (role?.project_id ? projectLoading : false)

  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.PencilEdit size={18} className="text-foreground" strokeWidth={2} />
          </div>
        }
        title={t('pages.roles.modals.edit.title')}
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : role && project ? (
          <EditRoleForm
            role={role}
            projectName={project.name}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
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
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="edit-role-form"
          variant="primary"
          disabled={isLoading}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
