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
      <div className="mb-6 flex w-full flex-col items-center text-center sm:mb-8">
        <h1 className="text-display-xs sm:text-display-sm text-dark-500 font-medium">
          {t('accountLocked.title')}
        </h1>
      </div>

      <div className="space-y-4">
        <span className="text-error-500 text-body-sm flex w-full items-center justify-center gap-2 font-medium">
          <TbInfoTriangle className="h-5 w-5 flex-shrink-0" />
          {t('accountLocked.message')}
        </span>

        <div className="text-body-sm flex flex-col items-center text-center text-gray-800">
          <span>{t('accountLocked.autoUnlock', { minutes })}</span>
          <span>{t('accountLocked.contact')}</span>
        </div>

        <Button variant="light" size="xl" className="mt-6 w-full sm:mt-8" onClick={onBackToLogin}>
          {t('accountLocked.backToLogin')}
        </Button>
      </div>
    </div>
  )
}

export default AccountLockedCard
