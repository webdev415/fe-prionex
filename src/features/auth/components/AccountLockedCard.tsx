import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui'
import { TbInfoTriangle } from 'react-icons/tb'

interface AccountLockedCardProps {
  lockoutMinutes?: number | null
  onBackToLogin: () => void
}

export function AccountLockedCard({ lockoutMinutes, onBackToLogin }: AccountLockedCardProps) {
  const { t } = useTranslation('auth')
  const minutes = lockoutMinutes ?? 18

  return (
    <div className="w-full">
      <div className="mb-4 flex w-full flex-col items-center text-center sm:mb-6 md:mb-8">
        <h1 className="sm:text-display-xs md:text-display-sm text-dark-500 text-xl font-medium">
          {t('accountLocked.title')}
        </h1>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <span className="text-error-500 text-body-xs sm:text-body-sm flex w-full items-center justify-center gap-1.5 px-2 font-medium sm:gap-2 sm:px-0">
          <TbInfoTriangle className="h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5" />
          {t('accountLocked.message')}
        </span>

        <div className="text-body-xs sm:text-body-sm flex flex-col items-center space-y-1 px-2 text-center text-gray-800 sm:space-y-0 sm:px-0">
          <span>{t('accountLocked.autoUnlock', { minutes })}</span>
          <span>{t('accountLocked.contact')}</span>
        </div>

        <Button
          variant="light"
          size="xl"
          className="mt-4 w-full text-sm sm:mt-6 sm:text-base md:mt-8"
          onClick={onBackToLogin}
        >
          {t('accountLocked.backToLogin')}
        </Button>
      </div>
    </div>
  )
}

export default AccountLockedCard
