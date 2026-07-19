import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'

export function LetterTypesTabSkeleton() {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()
  const loadingLabel = t(
    'pages.lawyerWorkplace.settings.letterTypes.loading',
    'Loading letter types…'
  )

  return (
    <div
      className={cn(
        'min-w-0 gap-4 px-4 pb-6 sm:px-5 lg:px-7',
        isCompact
          ? 'flex min-h-0 flex-col'
          : 'grid min-h-[560px] grid-cols-[minmax(240px,280px)_1fr]'
      )}
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      <span className="sr-only">{loadingLabel}</span>

      <div className={cn(isCompact ? 'min-h-0 shrink-0' : 'h-full min-h-0')}>
        <div className="bg-card flex h-full min-h-0 flex-col overflow-y-hidden rounded-[12px] border border-gray-100">
          <div className="border-light-100 flex items-center justify-between gap-2 border-b px-[14px] py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-7 w-20 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center gap-3 border-l-3 border-white px-3 py-3"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-gray-200" />
                    <div className="h-3.5 w-32 animate-pulse rounded bg-gray-200" />
                  </div>
                  <div className="h-3 w-40 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="h-5 w-7 animate-pulse rounded-full bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card/50 flex min-h-0 min-w-0 flex-1 flex-col rounded-[12px]">
        <div className="border-b border-gray-100 px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-hidden px-4 py-5 sm:space-y-8 sm:px-5 sm:py-6 lg:px-6">
          {Array.from({ length: 4 }).map((_, sectionIndex) => (
            <div key={sectionIndex} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                {sectionIndex > 0 ? (
                  <div className="h-3 w-48 max-w-full animate-pulse rounded bg-gray-200" />
                ) : null}
              </div>
              {sectionIndex === 0 ? (
                <div className="space-y-4">
                  <div
                    className={cn(
                      'flex w-full gap-4',
                      isCompact ? 'flex-col' : 'flex-row items-center gap-5'
                    )}
                  >
                    <div className="h-11 w-full animate-pulse rounded-md bg-gray-200" />
                    <div className="h-11 w-full animate-pulse rounded-md bg-gray-200" />
                  </div>
                  <div className="h-11 w-full animate-pulse rounded-md bg-gray-200" />
                </div>
              ) : sectionIndex === 1 ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((__, rowIndex) => (
                    <div
                      key={rowIndex}
                      className={cn(
                        'bg-card grid gap-3 rounded-xl px-4 py-3',
                        isCompact
                          ? 'grid-cols-1'
                          : 'lg:grid-cols-[minmax(180px,1fr)_auto_auto_auto] lg:items-center'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-gray-200" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-3.5 w-28 animate-pulse rounded bg-gray-200" />
                          <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                        </div>
                      </div>
                      <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                      <div className="flex gap-1">
                        {Array.from({ length: 4 }).map((___, starIndex) => (
                          <div
                            key={starIndex}
                            className="h-4 w-4 animate-pulse rounded bg-gray-200"
                          />
                        ))}
                      </div>
                      <div className="h-7 w-20 animate-pulse rounded-full bg-gray-200" />
                    </div>
                  ))}
                </div>
              ) : sectionIndex === 2 ? (
                <div className="space-y-2">
                  <div className="h-14 w-full animate-pulse rounded-xl bg-gray-200" />
                  <div className="h-14 w-full animate-pulse rounded-xl border-2 border-dashed border-gray-200 bg-transparent" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((__, tagIndex) => (
                    <div
                      key={tagIndex}
                      className="h-7 w-20 animate-pulse rounded-full bg-gray-200"
                    />
                  ))}
                  <div className="h-7 min-w-[120px] flex-1 animate-pulse rounded-full bg-gray-200" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div
          className={cn(
            'flex shrink-0 gap-3 border-t border-gray-100 px-4 py-4 sm:px-5 sm:py-5 lg:px-6',
            isCompact ? 'flex-col' : 'flex-row justify-center'
          )}
        >
          <div
            className={cn(
              'h-11 animate-pulse rounded-full bg-gray-200',
              isCompact ? 'w-full' : 'min-w-[170px]'
            )}
          />
          <div
            className={cn(
              'h-11 animate-pulse rounded-full bg-gray-200',
              isCompact ? 'w-full' : 'min-w-[170px]'
            )}
          />
        </div>
      </div>
    </div>
  )
}
