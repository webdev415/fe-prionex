import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'

export function LawyersTabSkeleton() {
  const { t } = useTranslation('common')
  const { isCompact, isWide } = useLawyerWorkplaceLayout()
  const loadingLabel = t('pages.lawyerWorkplace.settings.lawyers.loading', 'Loading lawyers…')

  return (
    <div
      className="space-y-5 px-4 pb-6 sm:px-5 lg:px-7"
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      <span className="sr-only">{loadingLabel}</span>

      <div className="rounded-xl bg-white/50 p-5 sm:p-6">
        <div className="mb-2 h-4 w-40 animate-pulse rounded bg-gray-200" />
        <div className="mb-5 h-3 w-full max-w-3xl animate-pulse rounded bg-gray-200" />
        <div
          className={cn(
            'grid gap-3',
            isWide ? 'grid-cols-3' : isCompact ? 'grid-cols-1' : 'grid-cols-2'
          )}
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2 rounded-xl bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                <div className="h-5 w-14 animate-pulse rounded-full bg-gray-200" />
              </div>
              <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
              <div className="h-3 max-w-[80%] animate-pulse rounded bg-gray-200" />
            </div>
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
            {Array.from({ length: 5 }).map((_, index) => (
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
              <div className="flex min-w-[160px] flex-1 items-center gap-3">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-gray-200" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
              <div className="flex gap-1.5">
                <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
              </div>
              <div className="min-w-[132px] space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
                <div className="h-1.5 w-full animate-pulse rounded-full bg-gray-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
              </div>
              <div className="h-8 w-24 animate-pulse rounded-full bg-gray-200" />
              <div className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 sm:px-5 lg:px-6">
          <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
    </div>
  )
}
