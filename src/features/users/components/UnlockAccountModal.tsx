/**
 * UnlockAccountModal Component
 *
 * Confirmation modal for unlocking a locked user account.
 * Shows user information and lock details.
 */

import { Dialog, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useUnlockAccount } from '../hooks/useUnlockAccount'
import type { ApiUser } from '../types'

interface UnlockAccountModalProps {
  open: boolean
  user: Pick<
    ApiUser,
    | 'id'
    | 'username'
    | 'email'
    | 'first_name'
    | 'last_name'
    | 'failed_login_attempts'
    | 'locked_until'
  >
  onSuccess: () => void
  onClose: () => void
}

export function UnlockAccountModal({ open, user, onSuccess, onClose }: UnlockAccountModalProps) {
  const { mutate, isPending, isError, error } = useUnlockAccount()

  const handleUnlock = () => {
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
      <DialogTitle>Unlock Account</DialogTitle>
      <DialogDescription>Are you sure you want to unlock this user account?</DialogDescription>

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
          <p className="text-sm">
            <span className="font-medium">Failed Login Attempts:</span> {user.failed_login_attempts}
          </p>
          {user.locked_until && (
            <p className="text-sm">
              <span className="font-medium">Locked Until:</span>{' '}
              {new Date(user.locked_until).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Info Message */}
      <div className="mt-4">
        <Alert variant="info">
          <p className="text-sm">
            This user will be able to log in again immediately. Failed login attempts will be reset
            to zero.
          </p>
        </Alert>
      </div>

      {/* API Error */}
      {isError && (
        <div className="mt-4">
          <Alert variant="error">
            <p className="text-sm">{error?.message || 'Failed to unlock account'}</p>
          </Alert>
        </div>
      )}

      {/* Actions */}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleUnlock} disabled={isPending}>
          {isPending ? 'Unlocking...' : 'Unlock'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
