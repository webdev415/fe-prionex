import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'

export function MailboxesTabSkeleton() {
  const { t } = useTranslation('common')
  const { isCompact, isWide } = useLawyerWorkplaceLayout()
  const loadingLabel = t('pages.lawyerWorkplace.settings.mailboxes.loading', 'Loading mailboxes…')

  return (
    <div
      className="space-y-5 px-4 pb-6 sm:px-5 lg:px-7"
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      <span className="sr-only">{loadingLabel}</span>
      <div className="rounded-xl bg-white/50 p-5 sm:p-6">
        <div
          className={cn(
            'mb-4 flex gap-3',
            isCompact ? 'flex-col' : 'flex-row items-start justify-between'
          )}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-full max-w-md animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-3 w-32 shrink-0 animate-pulse rounded bg-gray-200" />
        </div>
        <div
          className={cn(
            'grid gap-2',
            isWide
              ? 'grid-cols-5'
              : isCompact
                ? 'grid-cols-1'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
          )}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-md bg-gray-200" />
          ))}
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div
          className={cn(
            'flex gap-3 border-b border-gray-100 px-4 py-4 sm:px-5 lg:px-6',
            isCompact ? 'flex-col' : 'flex-row items-center justify-between'
          )}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-44 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-full max-w-sm animate-pulse rounded bg-gray-200" />
          </div>
          <div className={cn('flex shrink-0 gap-2', isCompact && 'w-full')}>
            <div
              className={cn('h-9 w-24 animate-pulse rounded-md bg-gray-200', isCompact && 'flex-1')}
            />
            <div
              className={cn('h-9 w-28 animate-pulse rounded-md bg-gray-200', isCompact && 'flex-1')}
            />
          </div>
        </div>
        <div className="space-y-0 px-4 py-2 sm:px-5 lg:px-6">
          <div className="flex gap-4 border-b border-gray-100 py-3">
            {Array.from({ length: 6 }).map((_, index) => (
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
              <div className="min-w-[180px] flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-44 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-8 animate-pulse rounded bg-gray-200" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
              <div className="h-8 w-16 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
