import { useTranslation } from 'react-i18next'
import { LoginForm, type LoginFormData } from '@/components/forms'

interface LoginCardProps {
  onSubmit: (data: LoginFormData) => Promise<void>
  isLoading?: boolean
  error?: string | null
}

export function LoginCard({ onSubmit, isLoading, error }: LoginCardProps) {
  const { t } = useTranslation('auth')

  return (
    <div className="w-full">
      <div className="mb-6 flex w-full flex-col items-center text-center sm:mb-8">
        <h1 className="text-display-xs sm:text-display-sm text-primary-950 flex items-center gap-2 font-medium">
          Welcome to Prionex
          <span>👋🏻</span>
        </h1>
        <p className="text-body-sm sm:text-body-md mt-2 text-gray-500">{t('login.subtitle')}</p>
      </div>
      <LoginForm onSubmit={onSubmit} isLoading={isLoading} error={error} />
    </div>
  )
}

export default LoginCard
