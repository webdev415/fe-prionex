/**
 * EditRoleModal Component
 *
 * Modal wrapper for EditRoleForm using the same structure as EditUserModal.
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
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
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.roles.modals.edit.title')}
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
          <EditRoleForm
            role={role}
            projectName={project.name}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
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
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="edit-role-form"
          variant="primary"
          disabled={isLoading}
          className="text-dark-500 bg-primary-300 h-[45px] flex-1 rounded-md border-none text-sm font-medium"
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
