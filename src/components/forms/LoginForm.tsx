import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Button, Input, PasswordInput } from '@/components/ui'

const loginSchema = z.object({
  username: z.string().min(1, 'validation.usernameRequired'),
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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3 sm:space-y-4" noValidate>
      <Input
        {...register('username')}
        type="text"
        inputSize="xl"
        label={t('login.username') + ':'}
        placeholder={t('login.usernamePlaceholder')}
        error={errors.username ? t(errors.username.message as string) : undefined}
        autoComplete="username"
        disabled={isLoading}
        className="text-sm sm:text-base"
      />

      <PasswordInput
        {...register('password')}
        id="password"
        inputSize="xl"
        label={t('login.password') + ':'}
        placeholder={t('login.passwordPlaceholder')}
        error={errors.password ? t(errors.password.message as string) : undefined}
        autoComplete="current-password"
        disabled={isLoading}
        className="text-sm sm:text-base"
      />

      {error && (
        <div className="bg-error-50 border-error-500 text-body-xs sm:text-body-sm text-error-600 rounded-md border p-2.5 sm:rounded-lg sm:p-3">
          {error}
        </div>
      )}

      <Button
        type="submit"
        size="xl"
        className="mt-4 w-full text-sm sm:mt-6 sm:text-base md:mt-8"
        isLoading={isLoading}
        disabled={isLoading}
      >
        {t('login.submit')}
      </Button>
    </form>
  )
}

export default LoginForm
