import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Button, Input, Label } from '@/components/ui'
import { Icons } from '@/lib/icons'

const loginSchema = z.object({
  username: z.string().min(1, 'validation.usernameRequired').min(3, 'validation.usernameMinLength'),
  password: z.string().min(1, 'validation.passwordRequired').min(8, 'validation.passwordMinLength'),
})

export type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>
  isLoading?: boolean
  error?: string | null
}

export function LoginForm({ onSubmit, isLoading = false, error }: LoginFormProps) {
  const { t } = useTranslation('auth')
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  })

  const handleFormSubmit = async (data: LoginFormData) => {
    await onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
      <Input
        {...register('username')}
        type="text"
        inputSize="xl"
        label={t('login.username') + ':'}
        placeholder={t('login.usernamePlaceholder')}
        error={errors.username ? t(errors.username.message as string) : undefined}
        autoComplete="username"
        disabled={isLoading}
      />

      <div>
        <Label htmlFor="password">{t('login.password') + ':'}</Label>
        <div className="relative mt-1.5">
          <div className="relative">
            <input
              {...register('password')}
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="text-dark-500 focus:border-primary-500 focus:ring-primary-500 flex h-[45px] w-full rounded-lg border border-gray-400 bg-white px-4 py-2 pr-12 text-sm font-light transition-all placeholder:text-gray-500 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              disabled={isLoading}
              aria-invalid={!!errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 z-10 flex items-center px-3 text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50"
              aria-label={
                showPassword
                  ? t('login.hidePassword') || 'Hide password'
                  : t('login.showPassword') || 'Show password'
              }
              disabled={isLoading}
              tabIndex={-1}
            >
              <Icons.Eye
                size={18}
                className={showPassword ? 'text-primary-500' : 'text-gray-400'}
              />
            </button>
          </div>
          {errors.password && (
            <p className="text-error-500 mt-1.5 text-xs" role="alert">
              {t(errors.password.message as string)}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-error-50 border-error-500 text-body-sm text-error-600 rounded-lg border p-3">
          {error}
        </div>
      )}

      <Button
        type="submit"
        size="xl"
        className="mt-6 w-full sm:mt-8"
        isLoading={isLoading}
        disabled={isLoading}
      >
        {t('login.submit')}
      </Button>
    </form>
  )
}

export default LoginForm
