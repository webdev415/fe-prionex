import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LoginForm, type LoginFormData } from '@/components/forms'

interface LoginCardProps {
  onSubmit: (data: LoginFormData) => Promise<void>
  isLoading?: boolean
  error?: string | null
  /** Rendered under the form — the «Увійти через підтвердження в Prionex» entry. */
  footer?: ReactNode
}

export function LoginCard({ onSubmit, isLoading, error, footer }: LoginCardProps) {
  const { t } = useTranslation('auth')

  return (
    <div className="w-full">
      <div className="mb-4 flex w-full flex-col items-center text-center sm:mb-6 md:mb-8">
        <h1 className="text-foreground flex items-center gap-1.5 text-2xl font-medium sm:gap-2 md:text-[30px]">
          {t('login.welcome')}
          <span className="text-xl md:text-2xl">👋🏻</span>
        </h1>
        <p className="text-muted-foreground md:text-body-md mt-1.5 px-2 text-sm font-light sm:mt-2 sm:px-0 sm:text-base">
          {t('login.subtitle')}
        </p>
      </div>
      <LoginForm onSubmit={onSubmit} isLoading={isLoading} error={error} />
      {footer}
    </div>
  )
}

export default LoginCard
