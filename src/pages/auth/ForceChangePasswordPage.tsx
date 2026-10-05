import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { AuthLayout } from '@/components/layout'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { authApi } from '@/features/auth'
import { useAuthStore } from '@/stores/authStore'

export default function ForceChangePasswordPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const storeLogout = useAuthStore((state) => state.logout)
  const user = useAuthStore((state) => state.user)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!newPassword) {
      newErrors.newPassword = t('validation.passwordRequired')
    } else if (newPassword.length < 8) {
      newErrors.newPassword = t('validation.passwordMinLength')
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t('validation.passwordRequired')
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('changePassword.passwordsMismatch')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setApiError(null)

    if (!validate()) return

    setIsLoading(true)

    try {
      await authApi.changePassword({
        new_password: newPassword,
      })

      // Backend invalidates session on password change, so logout and redirect to login
      await storeLogout()
      queryClient.clear()
      navigate('/login')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string | { message?: string } } } }
      const detail = err.response?.data?.detail
      const errorMessage =
        typeof detail === 'object'
          ? detail?.message || 'Failed to change password'
          : detail || 'Failed to change password'
      setApiError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    await storeLogout()
    queryClient.clear()
    navigate('/login')
  }

  // Reached with a password that no longer has to change -- a refresh, a
  // bookmark, a stale redirect: there is nothing to set, so go on.
  if (user && !user.mustChangePassword) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <AuthLayout>
      <div className="w-full">
        {/* Header */}
        <div className="mb-4 flex w-full flex-col items-center text-center sm:mb-6 md:mb-8">
          <div className="bg-primary-300 mb-3 flex h-12 w-12 items-center justify-center rounded-full sm:mb-4">
            <Icons.LockSync01 size={24} className="text-primary-foreground" strokeWidth={2} />
          </div>
          <h1 className="text-foreground text-2xl font-medium md:text-[30px]">
            {t('changePassword.title')}
          </h1>
          <p className="text-muted-foreground md:text-body-md mt-1.5 px-2 text-sm font-light sm:mt-2 sm:px-0 sm:text-base">
            {t('changePassword.subtitle')}
          </p>
        </div>

        {/* Error */}
        {apiError && (
          <div className="bg-error-500/10 text-error-500 mb-4 rounded-lg px-4 py-3 text-sm">
            {apiError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            id="newPassword"
            label={t('changePassword.newPassword')}
            placeholder={t('changePassword.newPasswordPlaceholder')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            variant={errors.newPassword ? 'error' : 'default'}
            error={errors.newPassword}
            required
          />

          <PasswordInput
            id="confirmPassword"
            label={t('changePassword.confirmPassword')}
            placeholder={t('changePassword.confirmPasswordPlaceholder')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            variant={errors.confirmPassword ? 'error' : 'default'}
            error={errors.confirmPassword}
            required
          />

          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            className="h-[45px] w-full rounded-md"
          >
            {isLoading ? t('changePassword.changing') : t('changePassword.submit')}
          </Button>
        </form>

        {/* Logout link */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm font-light text-gray-500 underline hover:text-gray-700"
          >
            {t('changePassword.logout')}
          </button>
        </div>
      </div>
    </AuthLayout>
  )
}
