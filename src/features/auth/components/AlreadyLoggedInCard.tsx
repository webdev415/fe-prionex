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
      <div className="mb-4 flex w-full flex-col items-center text-center sm:mb-6 md:mb-8">
        <h1 className="sm:text-display-xs md:text-display-sm text-foreground text-xl font-medium">
          {t('alreadyLoggedIn.title')}
        </h1>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <span className="text-body-xs sm:text-body-sm text-muted-foreground flex w-full items-center justify-center gap-1.5 px-2 font-normal sm:gap-2 sm:px-0">
          {t('alreadyLoggedIn.message')}
        </span>

        <Button
          variant="primary"
          size="xl"
          className="mt-4 w-full text-sm sm:mt-6 sm:text-base md:mt-8"
          onClick={onForceLogout}
          isLoading={isLoading}
        >
          {t('alreadyLoggedIn.forceLogout')}
        </Button>

        <Button
          variant="light"
          size="xl"
          className="w-full text-sm sm:text-base"
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
