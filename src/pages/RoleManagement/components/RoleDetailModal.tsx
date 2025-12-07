/**
 * RoleDetailModal Component
 *
 * Modal for viewing role details using the same structure as EditRoleModal.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ViewRoleForm } from '@/features/roles/components/ViewRoleForm'
import { useRole } from '@/features/roles/hooks/useRole'
import { useProject } from '@/features/projects/hooks/useProject'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { colors } from '@/lib/colors'

interface RoleDetailModalProps {
  open: boolean
  roleId: number
  onClose: () => void
}

export function RoleDetailModal({ open, roleId, onClose }: RoleDetailModalProps) {
  const { data: role, isLoading: roleLoading } = useRole(roleId)
  const { data: project, isLoading: projectLoading } = useProject(role?.project_id ?? 0, {
    enabled: !!role?.project_id && role.project_id > 0,
  })

  const isLoading = roleLoading || (role?.project_id ? projectLoading : false)

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary[400] }}
          >
            <Icons.View size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
        }
        title={role ? `View Role: ${role.name}${role.is_default ? ' (Default)' : ''}` : 'View Role'}
      />
      <ModalContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
            <span className="ml-3 text-gray-600">Loading role data...</span>
          </div>
        ) : role && project ? (
          <ViewRoleForm role={role} projectName={project.name} />
        ) : (
          <div className="py-8 text-center text-gray-600">Role not found</div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1 rounded-md text-sm font-medium"
          style={{
            border: 'none',
            backgroundColor: colors.gray[500],
            color: '#FFFFFF',
            height: '45px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Close
        </Button>
      </ModalFooter>
    </Modal>
  )
}
