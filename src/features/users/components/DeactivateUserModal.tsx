/**
 * DeactivateUserModal Component
 *
 * Confirmation modal for deactivating a user account.
 * Shows user information and requires confirmation.
 */

import { Dialog, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useDeactivateUser } from '../hooks/useDeactivateUser'
import type { ApiUser } from '../types'

interface DeactivateUserModalProps {
  open: boolean
  user: Pick<ApiUser, 'id' | 'username' | 'email' | 'first_name' | 'last_name' | 'status'>
  onSuccess: () => void
  onClose: () => void
}

export function DeactivateUserModal({ open, user, onSuccess, onClose }: DeactivateUserModalProps) {
  const { mutate, isPending, isError, error } = useDeactivateUser()

  const handleDeactivate = () => {
    mutate(
      { userId: user.id },
      {
        onSuccess: () => {
          onSuccess()
          onClose()
        },
      }
    )
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Deactivate User</DialogTitle>
      <DialogDescription>Are you sure you want to deactivate this user account?</DialogDescription>

      {/* User Information */}
      <div className="mt-4 rounded-lg bg-gray-50 p-4">
        <div className="space-y-1">
          <p className="text-sm">
            <span className="font-medium">Username:</span> {user.username}
          </p>
          <p className="text-sm">
            <span className="font-medium">Email:</span> {user.email}
          </p>
          <p className="text-sm">
            <span className="font-medium">Name:</span> {user.first_name} {user.last_name}
          </p>
        </div>
      </div>

      {/* Warning Message */}
      <div className="mt-4">
        <Alert variant="warning">
          <p className="text-sm">
            This user will no longer be able to log in or access the system. You can reactivate the
            account later if needed.
          </p>
        </Alert>
      </div>

      {/* API Error */}
      {isError && (
        <div className="mt-4">
          <Alert variant="error">
            <p className="text-sm">{error?.message || 'Failed to deactivate user'}</p>
          </Alert>
        </div>
      )}

      {/* Actions */}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleDeactivate} disabled={isPending}>
          {isPending ? 'Deactivating...' : 'Deactivate'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
