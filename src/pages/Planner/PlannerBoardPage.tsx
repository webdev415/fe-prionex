/**
 * Board as a kanban (planner story 1.10, AC1–AC3): columns are the board's
 * statuses in configuration order, cards come from `GET /boards/{code}/tasks`
 * already in column-then-position order. «+ Задача» shows only when the
 * server put `create_task` in the board's `allowed_actions`.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { usePlannerBoard, usePlannerBoardTasks } from '@/api/planner/plannerQueries'
import { readPlannerError } from '@/api/planner/plannerErrors'
import type { PlannerTaskCard } from '@/api/planner/plannerApi'
import { TaskCardView } from './components/TaskItems'
import { CreateTaskDialog } from './components/CreateTaskDialog'
import { usePlannerTaskParam } from './usePlannerTaskParam'

export function PlannerBoardPage() {
  const { t } = useTranslation('planner')
  const { code = '' } = useParams()
  const board = usePlannerBoard(code)
  const tasks = usePlannerBoardTasks(code)
  const { openTask } = usePlannerTaskParam()
  const [creating, setCreating] = useState(false)

  if (board.isPending) {
    return <div aria-busy="true" className="bg-muted h-40 rounded-xl" />
  }
  if (board.isError || !board.data) {
    const { status } = readPlannerError(board.error)
    return (
      <p className="text-foreground text-sm">
        {status === 404 ? t('board.notFound') : t('board.error')}
      </p>
    )
  }

  const statuses = [...board.data.config.statuses].sort((a, b) => a.position - b.position)
  const byStatus = new Map<string, PlannerTaskCard[]>()
  for (const task of tasks.data?.items ?? []) {
    const column = byStatus.get(task.status.id) ?? []
    column.push(task)
    byStatus.set(task.status.id, column)
  }
  const canCreate = board.data.allowed_actions.includes('create_task')

  return (
    <section className="space-y-3" aria-labelledby="planner-board-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="planner-board-title" className="text-foreground text-base font-semibold">
          <span className="text-muted-foreground mr-2 font-mono text-sm">{board.data.code}</span>
          {board.data.name}
        </h2>
        {canCreate && (
          <Button size="sm" onClick={() => setCreating(true)}>
            {t('board.newTask')}
          </Button>
        )}
      </div>

      {tasks.isError && <p className="text-foreground text-sm">{t('board.error')}</p>}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {statuses.map((status) => {
          const column = byStatus.get(status.id) ?? []
          return (
            <section
              key={status.id}
              aria-label={status.name}
              className="bg-muted/40 border-border flex w-72 shrink-0 flex-col gap-2 rounded-xl border p-2"
            >
              <header className="text-foreground flex items-center justify-between px-1 text-sm font-medium">
                <span>{status.name}</span>
                <span className="text-muted-foreground text-xs">{column.length}</span>
              </header>
              {column.length === 0 && (
                <p className="text-muted-foreground px-1 text-xs">{t('board.emptyColumn')}</p>
              )}
              {column.map((task) => (
                <TaskCardView
                  key={task.id}
                  task={task}
                  onOpen={openTask}
                  timeZone={board.data.tzid}
                />
              ))}
            </section>
          )
        })}
      </div>

      {tasks.data?.has_more && (
        <p className="text-muted-foreground text-xs">{t('board.hasMore')}</p>
      )}

      {creating && (
        <CreateTaskDialog
          boardCode={board.data.code}
          onClose={() => setCreating(false)}
          onOpenTask={openTask}
        />
      )}
    </section>
  )
}

export default PlannerBoardPage
