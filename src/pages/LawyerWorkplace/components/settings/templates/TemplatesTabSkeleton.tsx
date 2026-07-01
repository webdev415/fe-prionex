import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'

export function TemplatesTabSkeleton() {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()
  const loadingLabel = t('pages.lawyerWorkplace.settings.templates.loading', 'Loading templates…')

  return (
    <div
      className="space-y-5 px-4 pb-6 sm:px-5 lg:px-7"
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      <span className="sr-only">{loadingLabel}</span>
      <div className="min-w-0 overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div
          className={cn(
            'flex gap-3 border-b border-gray-100 px-4 py-4 sm:px-5 lg:px-6',
            isCompact ? 'flex-col' : 'flex-row items-center justify-between'
          )}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-full max-w-md animate-pulse rounded bg-gray-200" />
          </div>
          <div
            className={cn(
              'h-9 w-28 shrink-0 animate-pulse rounded-md bg-gray-200',
              isCompact && 'w-full'
            )}
          />
        </div>
        <div className="space-y-0 px-4 py-2 sm:px-5 lg:px-6">
          <div className="flex gap-4 border-b border-gray-100 py-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-3 flex-1 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className={cn(
                'flex items-center gap-4 py-4',
                rowIndex < 2 && 'border-b border-gray-100'
              )}
            >
              <div className="h-4 min-w-[120px] flex-1 animate-pulse rounded bg-gray-200" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
              <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
