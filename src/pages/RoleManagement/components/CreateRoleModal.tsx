/**
 * CreateRoleModal Component
 *
 * Modal wrapper for CreateRoleForm using the same structure as CreateUserModal.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { CreateRoleForm } from '@/features/roles/components/CreateRoleForm'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { colors } from '@/lib/colors'

interface CreateRoleModalProps {
  open: boolean
  projectId: number
  onClose: () => void
  onSuccess: () => void
}

export function CreateRoleModal({ open, projectId, onClose, onSuccess }: CreateRoleModalProps) {
  const handleSuccess = () => {
    onSuccess()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary[400] }}
          >
            <Icons.Add size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
        }
        title="Create Role"
        onClose={onClose}
      />
      <ModalContent>
        <CreateRoleForm projectId={projectId} onSuccess={handleSuccess} onCancel={onClose} />
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
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-role-form"
          variant="primary"
          className="flex-1 rounded-md text-sm font-medium"
          style={{
            border: 'none',
            backgroundColor: colors.primary[300],
            color: colors.neutral.dark[500],
            height: '45px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Create Role
        </Button>
      </ModalFooter>
    </Modal>
  )
}
