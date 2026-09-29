/**
 * Task panel over any screen of the section, opened by `?task=KEY`
 * (planner story 1.10, AC5; UX «Панель задачи»): title, status, assignees,
 * due date, description. The screen behind stays usable; `Esc` and `✕` close.
 * A task the person cannot see and a task that does not exist read the same
 * (the server answers 404 to both); a planner that is down or unreachable, and
 * any other failure, say so instead of claiming the task is gone.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { piiProps } from '@/lib/openreplay/pii'
import { usePlannerTask } from '@/api/planner/plannerQueries'
import { readPlannerError } from '@/api/planner/plannerErrors'
import { StatusChip } from './StatusChip'
import { AssigneeNames } from './TaskMeta'
import { DuePill, SlaPill } from './TaskPills'
import { OriginChip } from './OriginChip'
import { PriorityIcon } from './PriorityIcon'
import { PanelSkeleton } from './PlannerStates'

/**
 * An `Esc` meant for a layer opened above the panel — the reason dialog, the
 * status menu (both Radix, portalled, holding focus) — must close that layer
 * only. Radix handles it on `document` and does not stop the event, so the
 * panel's own listener would close the panel from under the dialog.
 */
function isInsideOverlay(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]') !==
      null
  )
}

function errorTextKey(error: unknown): string {
  const { status, code, unreachable } = readPlannerError(error)
  if (status === 404) return 'panel.notFound'
  if (status === 503 || code === 'feature_disabled' || unreachable) return 'panel.unavailable'
  return 'panel.error'
}

interface TaskPanelProps {
  taskKey: string
  onClose: () => void
}

export function TaskPanel({ taskKey, onClose }: TaskPanelProps) {
  const { t } = useTranslation('planner')
  const task = usePlannerTask(taskKey)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (isInsideOverlay(event.target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside
      aria-label={t('panel.label', { key: taskKey })}
      className="border-border bg-card fixed top-0 right-0 z-[150] flex h-full w-full max-w-[400px] flex-col border-l shadow-xl"
    >
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <span className="text-muted-foreground font-mono text-sm">{taskKey}</span>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground px-2 text-lg"
          aria-label={t('panel.close')}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-4">
        {task.isPending && <PanelSkeleton />}
        {task.isError && <p className="text-foreground text-sm">{t(errorTextKey(task.error))}</p>}
        {task.data && (
          <>
            <h2 className="text-foreground text-lg font-semibold break-words" {...piiProps}>
              {task.data.title}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <PriorityIcon task={task.data} />
              <OriginChip origin={task.data.origin} />
            </div>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">{t('task.status')}</dt>
                <dd>
                  <StatusChip task={task.data} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">{t('task.assignees')}</dt>
                <dd>
                  <AssigneeNames people={task.data.assignees} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">{t('task.due')}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <DuePill task={task.data} />
                  <SlaPill task={task.data} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">{t('task.description')}</dt>
                <dd className="text-foreground break-words whitespace-pre-wrap" {...piiProps}>
                  {task.data.description ?? t('task.noDescription')}
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </aside>
  )
}

export default TaskPanel
