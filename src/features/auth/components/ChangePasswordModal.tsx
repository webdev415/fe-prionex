/**
 * ChangePasswordModal Component
 *
 * Modal for changing user password with validation.
 * Uses Modal component pattern consistent with other modals.
 */

import { useState } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'

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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

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
    setShowCurrentPassword(false)
    setShowNewPassword(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="md">
      <ModalHeader
        icon={
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary[300] }}
          >
            <Icons.Lock size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
        }
        title="Change Password"
      />
      <ModalContent>
        <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password */}
          <div>
            <Label htmlFor="currentPassword" required>
              Current Password:
            </Label>
            <div className="relative mt-1">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                variant={errors.currentPassword ? 'error' : 'default'}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-3"
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                <Icons.Eye
                  size={18}
                  color={showCurrentPassword ? colors.primary[500] : colors.gray[400]}
                />
              </button>
            </div>
            {errors.currentPassword && (
              <p className="mt-1 text-sm text-red-500">{errors.currentPassword}</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <Label htmlFor="newPassword" required>
              New Password:
            </Label>
            <div className="relative mt-1">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                variant={errors.newPassword ? 'error' : 'default'}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-3"
                aria-label={showNewPassword ? 'Hide password' : 'Show password'}
              >
                <Icons.Eye
                  size={18}
                  color={showNewPassword ? colors.primary[500] : colors.gray[400]}
                />
              </button>
            </div>
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-500">{errors.newPassword}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <Label htmlFor="confirmPassword" required>
              Confirm New Password:
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              variant={errors.confirmPassword ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
            )}
          </div>
        </form>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isLoading}
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
          form="change-password-form"
          variant="primary"
          disabled={isLoading}
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
          {isLoading ? 'Changing...' : 'Change Password'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
