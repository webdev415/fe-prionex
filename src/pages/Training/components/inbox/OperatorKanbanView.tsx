import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type { AssignmentState, QueueOperator, ScoreBand } from '@/features/quality/coaching/types'
import { useTransitionAssignment } from '@/features/quality/coaching/hooks'

/**
 * Kanban view â€” five columns matching the trainer assignment state machine
 * (KAN-413, plan Â§1.4). Drag a card from one column to another to call
 * `POST /coaching/assignments/{id}/transition` with the target state.
 *
 * Disallowed transitions (`closed` is terminal; `wait â†’ awaiting_training`
 * has to go through `in_progress`) are filtered server-side and surfaced as
 * a toast. The client doesn't pre-validate â€” keeps the rule in one place.
 *
 * Only operators with an active assignment row appear here. Operators
 * surfaced by the queue endpoint without an assignment (`assignment === null`)
 * stay in the Inbox view; trainers click "Take charge" in the detail panel
 * to put them in `in_progress` and onto the board.
 *
 * Native HTML5 drag-and-drop, no extra dependency.
 */
export interface OperatorKanbanViewProps {
  rows: QueueOperator[]
  operators: OperatorUser[]
  selectedOperatorId: number | undefined
  onSelect: (operatorId: number) => void
  isLoading?: boolean
}

const COLUMN_ORDER: AssignmentState[] = [
  'wait',
  'in_progress',
  'awaiting_training',
  'scheduled',
  'closed',
]

const COLUMN_META: Record<
  AssignmentState,
  { key: string; fallback: string; chipTone: string; columnTone: string }
> = {
  wait: {
    key: 'pages.training.inbox.kanbanColumns.wait',
    fallback: 'Wait',
    chipTone: 'bg-yellow-100 text-yellow-700',
    columnTone: 'bg-yellow-50/40',
  },
  in_progress: {
    key: 'pages.training.inbox.kanbanColumns.in_progress',
    fallback: 'In progress',
    chipTone: 'bg-blue-100 text-blue-700',
    columnTone: 'bg-blue-50/40',
  },
  awaiting_training: {
    key: 'pages.training.inbox.kanbanColumns.awaiting_training',
    fallback: 'Awaiting training',
    chipTone: 'bg-purple-100 text-purple-700',
    columnTone: 'bg-purple-50/40',
  },
  scheduled: {
    key: 'pages.training.inbox.kanbanColumns.scheduled',
    fallback: 'Scheduled',
    chipTone: 'bg-indigo-100 text-indigo-700',
    columnTone: 'bg-indigo-50/40',
  },
  closed: {
    key: 'pages.training.inbox.kanbanColumns.closed',
    fallback: 'Closed',
    chipTone: 'bg-gray-100 text-gray-700',
    columnTone: 'bg-gray-50/40',
  },
}

const SCORE_BAND_BG: Record<ScoreBand, string> = {
  red: 'bg-red-500 text-white ring-red-300',
  amber: 'bg-amber-400 text-white ring-amber-300',
  green: 'bg-green-500 text-white ring-green-300',
}

const DRAG_MIME = 'application/x-coaching-assignment'

interface DragPayload {
  assignmentId: number
  operatorId: number
  fromState: AssignmentState
}

function operatorDisplayName(operatorId: number, operators: OperatorUser[]): string {
  const operator = operators.find((o) => o.id === operatorId)
  return operator?.full_name || `#${operatorId}`
}

function operatorDepartmentName(operatorId: number, operators: OperatorUser[]): string | null {
  const operator = operators.find((o) => o.id === operatorId)
  return operator?.department_name ?? null
}

function formatRelative(isoTimestamp: string | null | undefined): string | null {
  if (!isoTimestamp) return null
  const then = new Date(isoTimestamp).getTime()
  if (Number.isNaN(then)) return null
  const diffMs = Date.now() - then
  if (diffMs < 0) return null
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo`
  return `${Math.floor(months / 12)}y`
}

export function OperatorKanbanView({
  rows,
  operators,
  selectedOperatorId,
  onSelect,
  isLoading,
}: OperatorKanbanViewProps) {
  const { t } = useTranslation('common')
  const transitionMutation = useTransitionAssignment()
  const [dragOverColumn, setDragOverColumn] = useState<AssignmentState | null>(null)

  const grouped = useMemo(() => {
    const buckets: Record<AssignmentState, QueueOperator[]> = {
      wait: [],
      in_progress: [],
      awaiting_training: [],
      scheduled: [],
      closed: [],
    }
    for (const row of rows) {
      if (row.assignment) {
        buckets[row.assignment.state].push(row)
      }
    }
    return buckets
  }, [rows])

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, row: QueueOperator) => {
    if (!row.assignment) {
      e.preventDefault()
      return
    }
    const payload: DragPayload = {
      assignmentId: row.assignment.id,
      operatorId: row.operator_id,
      fromState: row.assignment.state,
    }
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, column: AssignmentState) => {
    // Only accept our own payload so we don't intercept browser-internal drags.
    if (Array.from(e.dataTransfer.types).includes(DRAG_MIME)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dragOverColumn !== column) setDragOverColumn(column)
    }
  }

  const handleDragLeave = (column: AssignmentState) => {
    if (dragOverColumn === column) setDragOverColumn(null)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, column: AssignmentState) => {
    e.preventDefault()
    setDragOverColumn(null)

    const raw = e.dataTransfer.getData(DRAG_MIME)
    if (!raw) return
    let payload: DragPayload
    try {
      payload = JSON.parse(raw) as DragPayload
    } catch {
      return
    }
    if (payload.fromState === column) return

    try {
      await transitionMutation.mutateAsync({
        assignmentId: payload.assignmentId,
        payload: { to_state: column },
      })
      toast.success(
        t('pages.training.inbox.kanban.transitionSuccess', 'Moved to {{state}}', {
          state: t(COLUMN_META[column].key, COLUMN_META[column].fallback),
        })
      )
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : t('pages.training.inbox.kanban.transitionFailed', 'Could not move the card.')
      toast.error(detail)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white/60 p-6 text-center text-sm text-gray-500">
        {t('pages.training.inbox.list.loading', 'Loading queueâ€¦')}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {COLUMN_ORDER.map((column) => {
        const meta = COLUMN_META[column]
        const bucket = grouped[column]
        const isDropTarget = dragOverColumn === column
        return (
          <div
            key={column}
            onDragOver={(e) => handleDragOver(e, column)}
            onDragLeave={() => handleDragLeave(column)}
            onDrop={(e) => handleDrop(e, column)}
            className={[
              'flex min-h-[400px] flex-col gap-2 rounded-2xl p-3 transition-colors',
              meta.columnTone,
              isDropTarget ? 'ring-primary-400 ring-2' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <header className="flex items-center justify-between gap-2 px-1">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.chipTone}`}>
                {t(meta.key, meta.fallback)}
              </span>
              <span className="text-[10px] font-medium text-gray-500">{bucket.length}</span>
            </header>

            <ul className="flex flex-col gap-1.5">
              {bucket.map((row) => {
                const name = operatorDisplayName(row.operator_id, operators)
                const departmentName = operatorDepartmentName(row.operator_id, operators)
                const lastActive = formatRelative(row.last_active_at)
                const isSelected = row.operator_id === selectedOperatorId
                return (
                  <li key={row.operator_id}>
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => handleDragStart(e, row)}
                      onClick={() => onSelect(row.operator_id)}
                      className={[
                        'flex w-full items-start gap-2 rounded-xl border bg-white p-2.5 text-left transition-colors',
                        isSelected
                          ? 'border-primary-400 ring-primary-100 ring-2'
                          : 'hover:border-primary-200 border-gray-100',
                      ].join(' ')}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="bg-primary-100 text-primary-700 flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold">
                          {name.slice(0, 1).toUpperCase()}
                        </div>
                        {row.triggers.length > 0 ? (
                          <span
                            aria-label="red flag"
                            className="absolute -top-0.5 -right-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"
                          />
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-dark-500 truncate text-xs font-medium">{name}</span>
                        <div className="flex flex-wrap items-center gap-1">
                          {departmentName ? (
                            <span className="bg-primary-50 text-primary-700 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase">
                              {departmentName}
                            </span>
                          ) : null}
                          {lastActive ? (
                            <span className="text-[9px] text-gray-500">{lastActive}</span>
                          ) : null}
                          {row.triggers.length > 0 ? (
                            <span className="text-[9px] font-medium text-red-600">
                              {row.triggers.length}âš‘
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ${SCORE_BAND_BG[row.score_band]}`}
                      >
                        {row.composite_score}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export default OperatorKanbanView
