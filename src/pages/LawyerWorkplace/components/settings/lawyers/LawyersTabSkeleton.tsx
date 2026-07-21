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

      <div className="bg-card/50 rounded-xl p-5 sm:p-6">
        <div className="bg-muted-foreground/25 mb-2 h-4 w-40 animate-pulse rounded" />
        <div className="bg-muted-foreground/25 mb-5 h-3 w-full max-w-3xl animate-pulse rounded" />
        <div
          className={cn(
            'grid gap-3',
            isWide ? 'grid-cols-3' : isCompact ? 'grid-cols-1' : 'grid-cols-2'
          )}
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="bg-card flex flex-col gap-2 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="bg-muted-foreground/25 h-4 w-28 animate-pulse rounded" />
                <div className="bg-muted-foreground/25 h-5 w-14 animate-pulse rounded-full" />
              </div>
              <div className="bg-muted-foreground/25 h-3 w-full animate-pulse rounded" />
              <div className="bg-muted-foreground/25 h-3 max-w-[80%] animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border-border min-w-0 overflow-hidden rounded-xl border">
        <div
          className={cn(
            'border-border flex gap-3 border-b px-4 py-4 sm:px-5 lg:px-6',
            isCompact ? 'flex-col' : 'flex-row items-center justify-between'
          )}
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="bg-muted-foreground/25 h-4 w-44 animate-pulse rounded" />
            <div className="bg-muted-foreground/25 h-3 w-full max-w-sm animate-pulse rounded" />
          </div>
          <div className={cn('flex shrink-0 gap-2', isCompact && 'w-full')}>
            <div
              className={cn(
                'bg-muted-foreground/25 h-9 w-24 animate-pulse rounded-md',
                isCompact && 'flex-1'
              )}
            />
            <div
              className={cn(
                'bg-muted-foreground/25 h-9 w-28 animate-pulse rounded-md',
                isCompact && 'flex-1'
              )}
            />
          </div>
        </div>

        <div className="space-y-0 px-4 py-2 sm:px-5 lg:px-6">
          <div className="border-border flex gap-4 border-b py-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="bg-muted-foreground/25 h-3 flex-1 animate-pulse rounded"
              />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className={cn(
                'flex items-center gap-4 py-4',
                rowIndex < 2 && 'border-border border-b'
              )}
            >
              <div className="flex min-w-[160px] flex-1 items-center gap-3">
                <div className="bg-muted-foreground/25 h-9 w-9 shrink-0 animate-pulse rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="bg-muted-foreground/25 h-4 w-32 animate-pulse rounded" />
                  <div className="bg-muted-foreground/25 h-3 w-24 animate-pulse rounded" />
                </div>
              </div>
              <div className="flex gap-1.5">
                <div className="bg-muted-foreground/25 h-6 w-20 animate-pulse rounded-full" />
                <div className="bg-muted-foreground/25 h-6 w-16 animate-pulse rounded-full" />
              </div>
              <div className="min-w-[132px] space-y-2">
                <div className="bg-muted-foreground/25 h-4 w-20 animate-pulse rounded" />
                <div className="bg-muted-foreground/25 h-1.5 w-full animate-pulse rounded-full" />
                <div className="bg-muted-foreground/25 h-3 w-24 animate-pulse rounded" />
              </div>
              <div className="bg-muted-foreground/25 h-8 w-24 animate-pulse rounded-full" />
              <div className="bg-muted-foreground/25 h-6 w-16 animate-pulse rounded-full" />
            </div>
          ))}
        </div>

        <div className="border-border flex items-center justify-between border-t px-4 py-3 sm:px-5 lg:px-6">
          <div className="bg-muted-foreground/25 h-3 w-20 animate-pulse rounded" />
          <div className="bg-muted-foreground/25 h-8 w-32 animate-pulse rounded" />
        </div>
      </div>
    </div>
  )
}
