import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui'

interface AlreadyLoggedInCardProps {
  onForceLogout: () => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function AlreadyLoggedInCard({
  onForceLogout,
  onCancel,
  isLoading,
}: AlreadyLoggedInCardProps) {
  const { t } = useTranslation('auth')

  return (
    <div className="w-full">
      <div className="mb-6 flex w-full flex-col items-center text-center sm:mb-8">
        <h1 className="text-display-xs sm:text-display-sm text-primary-950 font-medium">
          {t('alreadyLoggedIn.title')}
        </h1>
      </div>

      <div className="space-y-4">
        <span className="text-body-sm flex w-full items-center justify-center gap-2 font-normal text-gray-700">
          {t('alreadyLoggedIn.message')}
        </span>

        <Button
          variant="primary"
          size="xl"
          className="mt-6 w-full sm:mt-8"
          onClick={onForceLogout}
          isLoading={isLoading}
        >
          {t('alreadyLoggedIn.forceLogout')}
        </Button>

        <Button
          variant="light"
          size="xl"
          className="w-full"
          onClick={onCancel}
          disabled={isLoading}
        >
          {t('alreadyLoggedIn.cancel')}
        </Button>
      </div>
    </div>
  )
}

export default AlreadyLoggedInCard
