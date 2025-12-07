/**
 * UserDetailModal Component
 *
 * Modal wrapper for viewing user details.
 * Uses the same Modal structure as CreateUserModal.
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ViewUserForm } from '@/features/users/components/ViewUserForm'
import { useUser } from '@/features/users/hooks/useUser'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { colors } from '@/lib/colors'

interface UserDetailModalProps {
  open: boolean
  userId: number
  onClose: () => void
}

export function UserDetailModal({ open, userId, onClose }: UserDetailModalProps) {
  const { data: user, isLoading } = useUser(userId)

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: '#A0F229' }}
          >
            <Icons.View size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
        }
        title="View User"
      />
      <ModalContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
            <span className="ml-3 text-gray-600">Loading user data...</span>
          </div>
        ) : user ? (
          <ViewUserForm user={user} />
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
          Close
        </Button>
      </ModalFooter>
    </Modal>
  )
}
