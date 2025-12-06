/**
 * ReactivateUserModal Component
 *
 * Confirmation modal for reactivating a deactivated user account.
 */

import { Dialog, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { useReactivateUser } from '../hooks/useReactivateUser'
import type { User } from '@/types/api'

interface ReactivateUserModalProps {
  open: boolean
  user: User
  onSuccess: () => void
  onClose: () => void
}

export function ReactivateUserModal({ open, user, onSuccess, onClose }: ReactivateUserModalProps) {
  const reactivateMutation = useReactivateUser()

  const handleReactivate = async () => {
    try {
      await reactivateMutation.mutateAsync({ userId: Number(user.id) })
      onSuccess()
      onClose()
    } catch (error) {
      // Error handling is done by the mutation
      console.error('Failed to reactivate user:', error)
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white px-6 py-6 shadow-xl">
        <DialogTitle className="text-xl font-semibold text-gray-900">
          Reactivate User Account
        </DialogTitle>

        <DialogDescription className="mt-2 text-sm text-gray-600">
          Are you sure you want to reactivate <strong>{user.username}</strong>? This will restore
          their access to the system.
        </DialogDescription>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={reactivateMutation.isPending}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReactivate}
            disabled={reactivateMutation.isPending}
            className="rounded-md border border-transparent bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate User'}
          </button>
        </div>

        {reactivateMutation.isError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-800">Failed to reactivate user. Please try again.</p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
