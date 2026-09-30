/**
 * «Мої задачі» — the default screen of the section (planner story 1.9 AC2,
 * 1.10 AC4): the list «Поставлені мені» from `GET /me/tasks?list=assigned`,
 * polled every 30 s and on return to the tab. Loading and empty look like every
 * list of the section (5.1: skeleton rows, empty state).
 */
import { useTranslation } from 'react-i18next'
import { usePlannerMyTasks } from '@/api/planner/plannerQueries'
import { TaskRow } from './components/TaskItems'
import { PlannerEmptyState, TaskListSkeleton } from './components/PlannerStates'
import { usePlannerTaskParam } from './usePlannerTaskParam'

export function PlannerMyTasksPage() {
  const { t } = useTranslation('planner')
  const tasks = usePlannerMyTasks()
  const { openTask } = usePlannerTaskParam()

  return (
    <section
      className="border-border bg-card rounded-xl border p-4"
      aria-labelledby="planner-my-tasks"
    >
      <h2 id="planner-my-tasks" className="text-foreground mb-3 text-base font-semibold">
        {t('myTasks.title')}
      </h2>
      {tasks.isPending && <TaskListSkeleton />}
      {tasks.isError && <p className="text-foreground text-sm">{t('myTasks.error')}</p>}
      {tasks.data && tasks.data.items.length === 0 && (
        <PlannerEmptyState text={t('myTasks.empty')} />
      )}
      {tasks.data && tasks.data.items.length > 0 && (
        <ul>
          {tasks.data.items.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={openTask} />
          ))}
        </ul>
      )}
      {tasks.data?.has_more && (
        <p className="text-muted-foreground mt-2 text-xs">{t('myTasks.hasMore')}</p>
      )}
    </section>
  )
}

export default PlannerMyTasksPage
