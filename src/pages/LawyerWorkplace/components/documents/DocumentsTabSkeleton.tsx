import { useTranslation } from 'react-i18next'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'

const FILTER_PILL_WIDTHS = ['w-[88px]', 'w-14', 'w-14', 'w-16', 'w-[76px]', 'w-[84px]']

function DocumentsStatsSkeleton({ compact }: { compact: boolean }) {
  return (
    <div
      className={cn(
        'grid gap-3 px-4 sm:px-5 lg:px-7',
        compact ? 'grid-cols-1 pt-3' : 'grid-cols-2 pt-4 lg:grid-cols-4 lg:pt-5'
      )}
    >
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="border-card bg-card flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-3 shadow-sm sm:px-4"
        >
          <div
            className={cn(
              'bg-muted-foreground/25 shrink-0 animate-pulse rounded-lg',
              compact ? 'h-9 w-9' : 'h-10 w-10'
            )}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="bg-muted-foreground/25 h-2.5 w-[72%] max-w-[7.5rem] animate-pulse rounded" />
            <div
              className={cn(
                'bg-muted-foreground/25 animate-pulse rounded',
                compact ? 'h-4 w-16' : 'h-5 w-[4.5rem]'
              )}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function DocumentsToolbarSkeleton({ compact, wide }: { compact: boolean; wide: boolean }) {
  return (
    <div className={cn('min-w-0 shrink-0 px-4 sm:px-5 lg:px-7', compact ? 'pt-3' : 'pt-4 lg:pt-5')}>
      <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4 sm:gap-3">
        <div
          className={cn(
            'flex min-w-0 gap-0.5',
            compact ? 'flex-col' : 'flex-row items-center gap-3'
          )}
        >
          <div
            className={cn(
              'bg-muted-foreground/25 animate-pulse rounded',
              compact ? 'h-6 w-32' : 'h-7 w-36 lg:h-8 lg:w-40'
            )}
          />
          <div
            className={cn(
              'bg-muted-foreground/25 animate-pulse rounded',
              compact ? 'h-3 w-28' : 'h-4 w-32'
            )}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div
            className={cn(
              'bg-muted-foreground/25 animate-pulse rounded-md',
              compact ? 'h-10 w-10 rounded-full' : wide ? 'h-[45px] w-40' : 'h-10 w-36'
            )}
          />
          <div
            className={cn(
              'bg-muted-foreground/25 animate-pulse rounded-md',
              compact ? 'h-10 w-10 rounded-full' : wide ? 'h-[45px] w-32' : 'h-10 w-28'
            )}
          />
        </div>
      </div>

      <div
        className={cn(
          'mb-4 flex min-w-0 gap-3',
          compact ? 'flex-col items-stretch' : 'flex-row items-start'
        )}
      >
        <div className={cn('w-full max-w-full min-w-0', !compact && 'flex-1')}>
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_PILL_WIDTHS.map((widthClass, index) => (
              <div
                key={index}
                className={cn(
                  'bg-muted-foreground/25 h-8 animate-pulse rounded-full sm:h-9',
                  widthClass
                )}
              />
            ))}
          </div>
        </div>
        <div
          className={cn(
            'shrink-0',
            compact ? 'w-full' : 'ml-auto w-full max-w-[280px]',
            !compact && wide && 'max-w-[340px]'
          )}
        >
          <div className="bg-muted-foreground/25 h-9 w-full animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  )
}

interface DocumentsTableSkeletonProps {
  rows?: number
}

export function DocumentsTableSkeleton({ rows = 6 }: DocumentsTableSkeletonProps) {
  const { t } = useTranslation('common')
  const loadingLabel = t('pages.lawyerWorkplace.documents.loading', 'Loading documents…')

  return (
    <div
      className="min-w-0 px-4 pb-6 sm:px-5 lg:px-7"
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      <span className="sr-only">{loadingLabel}</span>
      <TableSkeleton columns={7} rows={rows} className="w-full" />
    </div>
  )
}

/** Full-page skeleton for the initial Documents tab load. */
export function DocumentsPageSkeleton() {
  const { t } = useTranslation('common')
  const { isCompact, isWide } = useLawyerWorkplaceLayout()
  const loadingLabel = t('pages.lawyerWorkplace.documents.loading', 'Loading documents…')

  return (
    <div className="min-w-0" role="status" aria-busy="true" aria-label={loadingLabel}>
      <span className="sr-only">{loadingLabel}</span>
      <DocumentsStatsSkeleton compact={isCompact} />
      <DocumentsToolbarSkeleton compact={isCompact} wide={isWide} />
      <DocumentsTableSkeleton rows={6} />
    </div>
  )
}

/** @deprecated Use DocumentsPageSkeleton */
export const DocumentsTabSkeleton = DocumentsPageSkeleton
