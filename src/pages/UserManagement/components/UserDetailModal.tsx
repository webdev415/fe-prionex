/**
 * UserDetailModal Component
 *
 * Modal wrapper for UserDetail with action modals integration.
 */

import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { UserDetail } from '@/features/users/components/UserDetail'
import { DeactivateUserModal } from '@/features/users/components/DeactivateUserModal'
import { ResetPasswordModal } from '@/features/users/components/ResetPasswordModal'
import { UnlockAccountModal } from '@/features/users/components/UnlockAccountModal'
import { ReactivateUserModal } from '@/features/users/components/ReactivateUserModal'
import { EditUserModal } from './EditUserModal'
import { useUser } from '@/features/users/hooks/useUser'

interface UserDetailModalProps {
  open: boolean
  userId: number
  onClose: () => void
}

type ActionModal = 'edit' | 'deactivate' | 'reactivate' | 'resetPassword' | 'unlock' | null

export function UserDetailModal({ open, userId, onClose }: UserDetailModalProps) {
  const { data: user, isLoading } = useUser(userId)
  const [activeModal, setActiveModal] = useState<ActionModal>(null)

  const handleActionSuccess = () => {
    setActiveModal(null)
    // Optionally refetch user data or show success message
  }

  if (isLoading || !user) {
    return (
      <Dialog open={open} onClose={onClose} className="max-w-4xl">
        <div className="p-8 text-center text-gray-400">Loading user details...</div>
      </Dialog>
    )
  }

  return (
    <>
      <Dialog open={open && activeModal === null} onClose={onClose} className="max-w-4xl">
        <UserDetail
          user={user}
          onEdit={() => setActiveModal('edit')}
          onDeactivate={() => setActiveModal('deactivate')}
          onReactivate={() => setActiveModal('reactivate')}
          onResetPassword={() => setActiveModal('resetPassword')}
          onUnlock={() => setActiveModal('unlock')}
          onBack={onClose}
        />
      </Dialog>

      {/* Action Modals */}
      {activeModal === 'edit' && (
        <EditUserModal
          open={true}
          user={user}
          onSuccess={handleActionSuccess}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'deactivate' && (
        <DeactivateUserModal
          open={true}
          user={user}
          onSuccess={handleActionSuccess}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'reactivate' && (
        <ReactivateUserModal
          open={true}
          user={user}
          onSuccess={handleActionSuccess}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'resetPassword' && (
        <ResetPasswordModal
          open={true}
          user={user}
          onSuccess={handleActionSuccess}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'unlock' && (
        <UnlockAccountModal
          open={true}
          user={user}
          onSuccess={handleActionSuccess}
          onClose={() => setActiveModal(null)}
        />
      )}
    </>
  )
}
