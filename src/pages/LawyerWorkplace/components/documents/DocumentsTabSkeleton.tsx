import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'

export function DocumentsTabSkeleton() {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()
  const loadingLabel = t('pages.lawyerWorkplace.documents.loading', 'Loading documents…')

  return (
    <div
      className="min-w-0 px-4 sm:px-5 lg:px-7"
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      <span className="sr-only">{loadingLabel}</span>

      <div
        className={cn(
          'grid gap-3 pt-3 lg:pt-5',
          isCompact ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-4'
        )}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-xl border border-gray-100 bg-white"
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-8 w-20 animate-pulse rounded-full bg-gray-200" />
          ))}
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-36 animate-pulse rounded-md bg-gray-200" />
          <div className="h-9 w-32 animate-pulse rounded-md bg-gray-200" />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-100 bg-white">
        <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
          <div className="flex gap-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="h-3 flex-1 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="flex items-center gap-4 border-b border-gray-50 px-4 py-4 sm:px-5"
          >
            {Array.from({ length: 7 }).map((__, cellIndex) => (
              <div key={cellIndex} className="h-3 flex-1 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
