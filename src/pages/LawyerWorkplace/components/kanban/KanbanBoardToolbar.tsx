import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { DEADLINE_FILTERS, LAWYERS, TASK_TYPES, type DeadlineFilter } from './constants'
import { KanbanFilterDropdown } from './KanbanFilterDropdown'

interface KanbanBoardToolbarProps {
  totalActive: number
  deadlineFilter: DeadlineFilter
  onDeadlineFilterChange: (filter: DeadlineFilter) => void
  lawyerFilter: string
  onLawyerFilterChange: (value: string) => void
  typeFilter: string
  onTypeFilterChange: (value: string) => void
}

export const KanbanBoardToolbar = forwardRef<HTMLDivElement, KanbanBoardToolbarProps>(
  function KanbanBoardToolbar(
    {
      totalActive,
      deadlineFilter,
      onDeadlineFilterChange,
      lawyerFilter,
      onLawyerFilterChange,
      typeFilter,
      onTypeFilterChange,
    },
    ref
  ) {
    const { t } = useTranslation('common')

    return (
      <div
        ref={ref}
        className="sticky top-0 z-10 bg-[#F2F3F0] px-5 pt-5 backdrop-blur-sm lg:px-7 lg:pt-7"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
              {t('pages.lawyerWorkplace.kanban.department', 'Legal department')}
            </h1>
            <span className="text-sm font-light text-gray-500 sm:text-base">
              {t('pages.lawyerWorkplace.kanban.activeCount', {
                count: totalActive,
                defaultValue: `${totalActive} active`,
              })}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <DoubleButton
              size="md"
              icon={<Icons.Add size={20} strokeWidth={2} />}
              iconPosition="left"
              onClick={() => {}}
              className="hidden h-[45px] lg:flex"
            >
              {t('pages.lawyerWorkplace.kanban.newTask', 'New Task')}
            </DoubleButton>
            <Button
              variant="primary"
              size="md"
              leftIcon={<Icons.FileImport size={16} className="text-dark-500" />}
              className="hidden h-[45px] rounded-full text-xs lg:flex"
            >
              {t('pages.lawyerWorkplace.kanban.exportCsv', 'Export CSV')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div className="flex items-center rounded-[8px] border border-white bg-white p-1 shadow-sm">
            {DEADLINE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => onDeadlineFilterChange(filter.id)}
                className={cn(
                  'flex cursor-pointer flex-row items-center justify-center gap-2 rounded-[6px] px-6 py-2 text-[12px] font-medium transition-colors',
                  deadlineFilter === filter.id
                    ? 'bg-secondary-800 text-white'
                    : 'text-dark-500 hover:bg-gray-50'
                )}
              >
                <Icons.Calendar size={16} strokeWidth={1.5} />
                <span>{t(filter.key, filter.fallback)}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <KanbanFilterDropdown
              value={lawyerFilter}
              options={LAWYERS}
              onChange={onLawyerFilterChange}
            />
            <KanbanFilterDropdown
              value={typeFilter}
              options={TASK_TYPES}
              onChange={onTypeFilterChange}
            />
          </div>
        </div>
      </div>
    )
  }
)
