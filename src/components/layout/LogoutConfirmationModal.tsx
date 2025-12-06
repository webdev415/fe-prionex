/**
 * LogoutConfirmationModal Component
 *
 * Confirmation modal for logging out.
 */

import { Dialog, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'

interface LogoutConfirmationModalProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function LogoutConfirmationModal({
  open,
  onConfirm,
  onCancel,
  isLoading = false,
}: LogoutConfirmationModalProps) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <div className="w-full max-w-md rounded-lg bg-white px-6 py-6 shadow-xl">
        <DialogTitle className="text-xl font-semibold text-gray-900">Confirm Logout</DialogTitle>

        <DialogDescription className="mt-2 text-sm text-gray-600">
          Are you sure you want to logout? You will need to login again to access the system.
        </DialogDescription>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {isLoading ? 'Logging out...' : 'Logout'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
