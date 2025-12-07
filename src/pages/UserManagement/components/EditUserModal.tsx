/**
 * EditUserModal Component
 *
 * Modal wrapper for EditUserForm.
 * Uses the same Modal structure as CreateUserModal.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { EditUserForm } from '@/features/users/components/EditUserForm'
import { useUser } from '@/features/users/hooks/useUser'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { colors } from '@/lib/colors'

interface EditUserModalProps {
  open: boolean
  userId: number
  onClose: () => void
  onSuccess: () => void
}

export function EditUserModal({ open, userId, onClose, onSuccess }: EditUserModalProps) {
  const { data: user, isLoading } = useUser(userId)

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
            style={{ backgroundColor: '#A0F229' }}
          >
            <Icons.PencilEdit size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
        }
        title="Edit User"
      />
      <ModalContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
            <span className="ml-3 text-gray-600">Loading user data...</span>
          </div>
        ) : user ? (
          <EditUserForm user={user} onSuccess={handleSuccess} onCancel={onClose} />
        ) : (
          <div className="py-8 text-center text-gray-600">User not found</div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1"
          style={{
            border: 'none',
            backgroundColor: colors.gray[500],
            color: '#FFFFFF',
            height: '45px',
            borderRadius: '8px',
            fontWeight: 500,
            fontSize: '14px',
          }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="edit-user-form"
          variant="primary"
          className="flex-1"
          style={{
            border: 'none',
            backgroundColor: colors.primary[300],
            color: colors.neutral.dark[500],
            borderRadius: '8px',
            fontWeight: 500,
            height: '45px',
            fontSize: '14px',
          }}
        >
          Save
        </Button>
      </ModalFooter>
    </Modal>
  )
}
