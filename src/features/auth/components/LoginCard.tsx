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
      <div className="mb-4 flex w-full flex-col items-center text-center sm:mb-6 md:mb-8">
        <h1 className="sm:text-display-xs md:text-display-sm text-dark-500 flex items-center gap-1.5 text-xl font-medium sm:gap-2">
          {t('login.welcome')}
          <span className="text-lg sm:text-xl md:text-2xl">👋🏻</span>
        </h1>
        <p className="text-body-xs sm:text-body-sm md:text-body-md mt-1.5 px-2 text-gray-500 sm:mt-2 sm:px-0">
          {t('login.subtitle')}
        </p>
      </div>
      <LoginForm onSubmit={onSubmit} isLoading={isLoading} error={error} />
    </div>
  )
}

export default LoginCard
