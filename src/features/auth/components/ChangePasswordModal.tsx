/**
 * ChangePasswordModal Component
 *
 * Modal for changing user password with validation.
 * Uses Modal component pattern consistent with other modals.
 */

import { useState } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

export interface ChangePasswordModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { current_password: string; new_password: string }) => void
  isLoading?: boolean
}

export function ChangePasswordModal({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required'
    }

    if (!newPassword) {
      newErrors.newPassword = 'New password is required'
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters'
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (validate()) {
      onSubmit({
        current_password: currentPassword,
        new_password: newPassword,
      })
    }
  }

  const handleClose = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setErrors({})
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#A7E8BD]">
            <Icons.Lock size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title="Change Password"
      />
      <ModalContent>
        <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <PasswordInput
            id="currentPassword"
            label="Current Password:"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            variant={errors.currentPassword ? 'error' : 'default'}
            error={errors.currentPassword}
            required
          />

          {/* New Password */}
          <PasswordInput
            id="newPassword"
            label="New Password:"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            variant={errors.newPassword ? 'error' : 'default'}
            error={errors.newPassword}
            required
          />

          {/* Confirm Password */}
          <PasswordInput
            id="confirmPassword"
            label="Confirm New Password:"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            variant={errors.confirmPassword ? 'error' : 'default'}
            error={errors.confirmPassword}
            required
          />
        </form>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isLoading}
          className="h-[45px] flex-1 rounded-md border-none bg-gray-500 text-sm font-medium text-white"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="change-password-form"
          variant="primary"
          disabled={isLoading}
          className="text-dark-500 h-[45px] flex-1 rounded-md border-none bg-[#A7E8BD] text-sm font-medium"
        >
          {isLoading ? 'Changing...' : 'Change Password'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
