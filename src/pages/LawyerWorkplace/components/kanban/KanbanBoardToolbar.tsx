import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import {
  DEADLINE_FILTERS,
  resolveKanbanBadgeType,
  type DeadlineFilter,
  type LawyerFilterId,
  type LawyerFilterOption,
  type TypeFilterId,
  type TypeFilterOption,
} from './constants'
import { KanbanFilterDropdown } from './KanbanFilterDropdown'
import { KanbanTypeBadge } from './KanbanTypeBadge'

interface KanbanBoardToolbarProps {
  totalActive: number
  deadlineFilter: DeadlineFilter
  onDeadlineFilterChange: (filter: DeadlineFilter) => void
  lawyerFilter: LawyerFilterId
  onLawyerFilterChange: (value: LawyerFilterId) => void
  lawyerFilterOptions: LawyerFilterOption[]
  typeFilterOptions: TypeFilterOption[]
  typeFilter: TypeFilterId
  onTypeFilterChange: (value: TypeFilterId) => void
  onNewTask: () => void
  onExportCsv: () => void
}

export function KanbanBoardToolbar({
  totalActive,
  deadlineFilter,
  onDeadlineFilterChange,
  lawyerFilter,
  onLawyerFilterChange,
  lawyerFilterOptions,
  typeFilterOptions,
  typeFilter,
  onTypeFilterChange,
  onNewTask,
  onExportCsv,
}: KanbanBoardToolbarProps) {
  const { t } = useTranslation('common')
  const { isCompact, isWide } = useLawyerWorkplaceLayout()

  const renderTypeFilterOption = useCallback(
    (option: TypeFilterOption) => {
      if (option.id === 'all') {
        return t(option.key, option.fallback)
      }
      const letterTypeId = option.letterTypeId ?? option.id
      return (
        <KanbanTypeBadge
          type={resolveKanbanBadgeType(letterTypeId)}
          label={option.label ?? (option.key ? t(option.key, option.fallback) : option.fallback)}
          colorId={option.colorId}
        />
      )
    },
    [t]
  )

  return (
    <div className="bg-background/95 sticky top-0 z-10 shrink-0 px-4 pt-4 backdrop-blur-sm sm:px-5 lg:px-7 lg:pt-7">
      <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4">
        <div
          className={cn(
            'flex min-w-0 gap-0.5',
            isCompact ? 'flex-col' : 'flex-row items-center gap-3'
          )}
        >
          <h1
            className={cn(
              'text-foreground truncate font-light',
              isCompact ? 'text-lg' : 'text-xl lg:text-2xl'
            )}
          >
            {t('pages.lawyerWorkplace.kanban.department', 'Legal department')}
          </h1>
          <span
            className={cn(
              'text-muted-foreground font-light whitespace-nowrap',
              isCompact ? 'text-xs' : 'text-sm lg:text-base'
            )}
          >
            {t('pages.lawyerWorkplace.kanban.activeCount', {
              count: totalActive,
              defaultValue: `${totalActive} active`,
            })}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isCompact ? (
            <button
              type="button"
              onClick={onNewTask}
              aria-label={t('pages.lawyerWorkplace.kanban.newTask', 'New Task')}
              className="bg-primary-300 text-foreground hover:bg-primary-400 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors"
            >
              <Icons.Add size={20} strokeWidth={2} />
            </button>
          ) : (
            <DoubleButton
              size="md"
              icon={<Icons.Add size={20} strokeWidth={2} />}
              iconPosition="left"
              onClick={onNewTask}
              className="h-[45px]"
            >
              {t('pages.lawyerWorkplace.kanban.newTask', 'New Task')}
            </DoubleButton>
          )}

          {isWide && (
            <Button
              type="button"
              variant="primary"
              size="md"
              leftIcon={<Icons.FileImport size={16} className="text-foreground" />}
              className="h-[45px] rounded-full text-xs"
              onClick={onExportCsv}
            >
              {t('pages.lawyerWorkplace.kanban.exportCsv', 'Export CSV')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 pb-3 sm:gap-3 sm:pb-4">
        <div className={cn('min-w-0', isCompact ? 'w-full basis-full' : 'shrink-0')}>
          <div
            className={cn(
              'border-card bg-card flex items-stretch rounded-[8px] border p-1 shadow-sm',
              isCompact ? 'w-full' : 'inline-flex'
            )}
          >
            {DEADLINE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => onDeadlineFilterChange(filter.id)}
                className={cn(
                  'flex cursor-pointer items-center justify-center gap-1.5 rounded-[6px] py-2 text-[11px] font-medium transition-colors sm:gap-2 sm:text-[12px]',
                  isCompact
                    ? 'min-w-0 flex-1 px-2'
                    : 'shrink-0 px-3 whitespace-nowrap sm:px-5 lg:px-6',
                  deadlineFilter === filter.id
                    ? 'bg-secondary-800 text-white'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <Icons.Calendar size={14} strokeWidth={1.5} className="shrink-0 sm:h-4 sm:w-4" />
                <span className={cn(isCompact && 'truncate')}>
                  {t(filter.key, filter.fallback)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div
          className={cn(
            'min-w-0 gap-2',
            isCompact
              ? 'grid w-full basis-full grid-cols-2'
              : 'ml-auto flex shrink-0 items-center gap-3'
          )}
        >
          <KanbanFilterDropdown
            value={lawyerFilter}
            options={lawyerFilterOptions}
            onChange={onLawyerFilterChange}
            align="end"
            className={cn('w-full', !isCompact && 'w-[200px]', isWide && 'w-[230px]')}
          />
          <KanbanFilterDropdown
            value={typeFilter}
            options={typeFilterOptions}
            onChange={onTypeFilterChange}
            align="end"
            renderOption={renderTypeFilterOption}
            renderValue={renderTypeFilterOption}
            className={cn('w-full', !isCompact && 'w-[200px]', isWide && 'w-[230px]')}
          />
        </div>
      </div>
    </div>
  )
}
