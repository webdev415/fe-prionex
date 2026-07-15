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
            <div className="h-7 w-40 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-11 w-28 animate-pulse rounded-full bg-gray-200" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-10 w-52 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-10 w-40 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-10 w-40 animate-pulse rounded-lg bg-gray-200" />
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
            className="flex min-h-[320px] flex-col rounded-xl border border-gray-100 bg-white/70 p-3"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-5 w-8 animate-pulse rounded-full bg-gray-200" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: isCompact ? 2 : 3 }).map((__, cardIndex) => (
                <div
                  key={cardIndex}
                  className="animate-pulse rounded-xl border border-gray-100 bg-white p-3"
                >
                  <div className="mb-2 h-3.5 w-28 rounded bg-gray-200" />
                  <div className="mb-2 h-3 w-full rounded bg-gray-200" />
                  <div className="h-3 w-2/3 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
