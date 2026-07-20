import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type { AssignmentState, QueueOperator, ScoreBand } from '@/features/quality/coaching/types'
import { useTransitionAssignment } from '@/features/quality/coaching/hooks'

/**
 * Kanban view — five columns matching the trainer assignment state machine
 * (KAN-413, plan §1.4). Drag a card from one column to another to call
 * `POST /coaching/assignments/{id}/transition` with the target state.
 *
 * Disallowed transitions (`closed` is terminal; `wait → awaiting_training`
 * has to go through `in_progress`) are filtered server-side and surfaced as
 * a toast. The client doesn't pre-validate — keeps the rule in one place.
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
    key: 'pages.actionAnalysis.inbox.kanbanColumns.wait',
    fallback: 'Wait',
    chipTone: 'bg-warning-100 text-warning-700',
    columnTone: 'bg-warning-100/40',
  },
  in_progress: {
    key: 'pages.actionAnalysis.inbox.kanbanColumns.in_progress',
    fallback: 'In progress',
    chipTone: 'bg-info-100 text-info-700',
    columnTone: 'bg-info-100/40',
  },
  awaiting_training: {
    key: 'pages.actionAnalysis.inbox.kanbanColumns.awaiting_training',
    fallback: 'Awaiting training',
    chipTone: 'bg-secondary-100 text-secondary-700',
    columnTone: 'bg-secondary-100/40',
  },
  scheduled: {
    key: 'pages.actionAnalysis.inbox.kanbanColumns.scheduled',
    fallback: 'Scheduled',
    chipTone: 'bg-primary-100 text-primary-700',
    columnTone: 'bg-primary-100/40',
  },
  closed: {
    key: 'pages.actionAnalysis.inbox.kanbanColumns.closed',
    fallback: 'Closed',
    chipTone: 'bg-muted text-muted-foreground',
    columnTone: 'bg-muted/40',
  },
}

const SCORE_BAND_BG: Record<ScoreBand, string> = {
  red: 'bg-error-100 text-error-700 ring-error-200',
  amber: 'bg-warning-100 text-warning-700 ring-warning-200',
  green: 'bg-success-100 text-success-700 ring-success-200',
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
        t('pages.actionAnalysis.inbox.kanban.transitionSuccess', 'Moved to {{state}}', {
          state: t(COLUMN_META[column].key, COLUMN_META[column].fallback),
        })
      )
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : t('pages.actionAnalysis.inbox.kanban.transitionFailed', 'Could not move the card.')
      toast.error(detail)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-card/60 text-muted-foreground rounded-2xl p-6 text-center text-sm">
        {t('pages.actionAnalysis.inbox.list.loading', 'Loading queue…')}
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
              <span className="text-muted-foreground text-[10px] font-medium">{bucket.length}</span>
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
                        'bg-card flex w-full items-start gap-2 rounded-xl border p-2.5 text-left transition-colors',
                        isSelected
                          ? 'border-primary-400 ring-primary-100 ring-2'
                          : 'hover:border-primary-200 border-border',
                      ].join(' ')}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="bg-primary-100 text-primary-700 flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold">
                          {name.slice(0, 1).toUpperCase()}
                        </div>
                        {row.triggers.length > 0 ? (
                          <span
                            aria-label="red flag"
                            className="border-card bg-destructive absolute -top-0.5 -right-0.5 inline-block h-2.5 w-2.5 rounded-full border-2"
                          />
                        ) : null}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-foreground truncate text-xs font-medium">{name}</span>
                        <div className="flex flex-wrap items-center gap-1">
                          {departmentName ? (
                            <span className="bg-primary-100 text-primary-700 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase">
                              {departmentName}
                            </span>
                          ) : null}
                          {lastActive ? (
                            <span className="text-muted-foreground text-[9px]">{lastActive}</span>
                          ) : null}
                          {row.triggers.length > 0 ? (
                            <span className="text-error-600 text-[9px] font-medium">
                              {row.triggers.length}⚑
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ${row.score_band ? SCORE_BAND_BG[row.score_band] : 'bg-muted text-muted-foreground ring-border'}`}
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
