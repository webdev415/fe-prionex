/**
 * The «список» view of a board until story 5.4 (planner story 5.3, AC4;
 * U-28): the rows of «Мої задачі» (`TaskRow`, 5.1) from
 * `GET /boards/{code}/tasks` under the same filters as the kanban, the first
 * page of the server. The table with sortable columns and cursor paging is
 * story 5.4.
 *
 * The contract (0.24.0) shows closed tasks of the last 7 days only — here as
 * on the kanban — and «Усі закриті →» leads here: the view says so, so that a
 * short list of closed tasks is not read as «there are no older ones»
 * (spec 5.3, Spec Change Log 8).
 */
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { usePlannerBoardTasks } from '@/api/planner/plannerQueries'
import { readPlannerError } from '@/api/planner/plannerErrors'
import type { PlannerBoardFilterParams } from '@/api/planner/plannerApi'
import { TaskRow } from '../components/TaskItems'
import { PlannerEmptyState, TaskListSkeleton } from '../components/PlannerStates'

interface BoardListViewProps {
  code: string
  /** `null` while «Мої» waits for `GET /me`. */
  filters: PlannerBoardFilterParams | null
  filtersActive: boolean
  onResetFilters: () => void
  onOpenTask: (key: string) => void
}

export function BoardListView({
  code,
  filters,
  filtersActive,
  onResetFilters,
  onOpenTask,
}: BoardListViewProps) {
  const { t } = useTranslation('planner')
  const tasks = usePlannerBoardTasks(code, filters ?? {}, filters !== null)
  const reset = (
    <Button variant="outline" size="sm" onClick={onResetFilters}>
      {t('kanban.resetFilters')}
    </Button>
  )

  if (tasks.isPending || filters === null) return <TaskListSkeleton />
  if (tasks.isError && !tasks.data) {
    const { status } = readPlannerError(tasks.error)
    return status === 400 && filtersActive ? (
      <PlannerEmptyState text={t('kanban.invalidFilter')} action={reset} />
    ) : (
      <p className="text-foreground text-sm">{t('board.error')}</p>
    )
  }
  const items = tasks.data?.items ?? []
  if (items.length === 0) {
    return filtersActive ? (
      <PlannerEmptyState text={t('kanban.nothingFound')} action={reset} />
    ) : (
      <PlannerEmptyState text={t('board.empty')} />
    )
  }
  return (
    <div className="border-border bg-card rounded-xl border p-4">
      <p className="text-muted-foreground mb-2 text-xs">{t('board.closedWindow')}</p>
      <ul>
        {items.map((task) => (
          <TaskRow key={task.id} task={task} onOpen={onOpenTask} />
        ))}
      </ul>
      {tasks.data?.has_more && (
        <p className="text-muted-foreground mt-2 text-xs">{t('board.hasMore')}</p>
      )}
    </div>
  )
}

export default BoardListView
