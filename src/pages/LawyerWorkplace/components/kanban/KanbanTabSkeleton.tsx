import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import { KANBAN_SCROLL_GRID_COLS_CLASS } from './constants'

export function KanbanTabSkeleton() {
  const { t } = useTranslation('common')
  const { isCompact, showWorkspaceBanner } = useLawyerWorkplaceLayout()
  const loadingLabel = t('pages.lawyerWorkplace.kanban.loading', 'Loading kanban tasks…')

  return (
    <div
      className="flex min-h-0 flex-1 flex-col px-4 sm:px-5 lg:px-7"
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
    >
      <span className="sr-only">{loadingLabel}</span>

      <div className="mb-4 pt-4 lg:pt-7">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="bg-muted-foreground/25 h-7 w-40 animate-pulse rounded" />
            <div className="bg-muted-foreground/25 h-4 w-24 animate-pulse rounded" />
          </div>
          <div className="bg-muted-foreground/25 h-11 w-28 animate-pulse rounded-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="bg-muted-foreground/25 h-10 w-52 animate-pulse rounded-lg" />
          <div className="bg-muted-foreground/25 h-10 w-40 animate-pulse rounded-lg" />
          <div className="bg-muted-foreground/25 h-10 w-40 animate-pulse rounded-lg" />
        </div>
      </div>

      <div
        className={cn(
          'grid items-stretch gap-3 pb-6',
          showWorkspaceBanner
            ? 'grid-cols-4'
            : cn(
                'w-max grid-flow-col overflow-x-auto',
                KANBAN_SCROLL_GRID_COLS_CLASS,
                '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              )
        )}
      >
        {Array.from({ length: 4 }).map((_, columnIndex) => (
          <div
            key={columnIndex}
            className="bg-card/70 border-border flex min-h-[320px] flex-col rounded-xl border p-3"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="bg-muted-foreground/25 h-4 w-24 animate-pulse rounded" />
              <div className="bg-muted-foreground/25 h-5 w-8 animate-pulse rounded-full" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: isCompact ? 2 : 3 }).map((__, cardIndex) => (
                <div
                  key={cardIndex}
                  className="bg-card border-border animate-pulse rounded-xl border p-3"
                >
                  <div className="bg-muted mb-2 h-3.5 w-28 rounded" />
                  <div className="bg-muted mb-2 h-3 w-full rounded" />
                  <div className="bg-muted h-3 w-2/3 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
