/**
 * ResetPasswordModal Component
 *
 * Modal for resetting a user's password and displaying the temporary password.
 */

import { useState } from 'react'
import { Dialog, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useResetPassword } from '../hooks/useResetPassword'
import type { ApiUser } from '../types'

interface ResetPasswordModalProps {
  open: boolean
  user: Pick<ApiUser, 'id' | 'username' | 'email' | 'first_name' | 'last_name'>
  onSuccess: () => void
  onClose: () => void
}

export function ResetPasswordModal({ open, user, onSuccess, onClose }: ResetPasswordModalProps) {
  const { mutate, isPending, isError, error, data } = useResetPassword()
  const [copied, setCopied] = useState(false)

  const handleReset = () => {
    mutate(
      { userId: user.id },
      {
        onSuccess: () => {
          onSuccess()
        },
      }
    )
  }

  const handleCopy = async () => {
    if (data?.temporary_password) {
      await navigator.clipboard.writeText(data.temporary_password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const temporaryPassword = data?.temporary_password

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Reset Password</DialogTitle>
      <DialogDescription>
        {temporaryPassword
          ? 'Password has been reset successfully'
          : 'Generate a temporary password for this user'}
      </DialogDescription>

      {/* User Information */}
      {!temporaryPassword && (
        <>
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

          {/* Info Message */}
          <div className="mt-4">
            <Alert variant="info">
              <p className="text-sm">
                A temporary password will be generated. The user must change this password on their
                first login.
              </p>
            </Alert>
          </div>
        </>
      )}

      {/* Temporary Password Display */}
      {temporaryPassword && (
        <div className="mt-4">
          <Alert variant="success">
            <div className="space-y-3">
              <p className="text-sm font-medium">Password has been reset successfully.</p>
              <div className="rounded-md bg-white p-3">
                <div className="flex items-center justify-between">
                  <code className="font-mono text-lg font-semibold text-gray-900">
                    {temporaryPassword}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleCopy} className="ml-2">
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                Save this password securely. The user must change this password on their first
                login.
              </p>
            </div>
          </Alert>
        </div>
      )}

      {/* API Error */}
      {isError && (
        <div className="mt-4">
          <Alert variant="error">
            <p className="text-sm">{error?.message || 'Failed to reset password'}</p>
          </Alert>
        </div>
      )}

      {/* Actions */}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          {temporaryPassword ? 'Close' : 'Cancel'}
        </Button>
        {!temporaryPassword && (
          <Button onClick={handleReset} disabled={isPending}>
            {isPending ? 'Resetting...' : 'Reset Password'}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  )
}
