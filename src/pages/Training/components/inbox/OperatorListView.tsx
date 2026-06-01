import { useTranslation } from 'react-i18next'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type { AssignmentState, QueueOperator, ScoreBand } from '@/features/quality/coaching/types'

/**
 * Left-panel operator list — the "Inbox" view mode.
 *
 * Each row shows: avatar/initial, name, current Kanban state chip, composite
 * score badge color-banded to red/amber/green. Click → focuses the operator
 * in the right detail panel via `onSelect`.
 *
 * Kanban + Grid views (steps 7-8) consume the same `QueueOperator[]` data
 * but arrange it differently — this component is intentionally simple to
 * keep the data contract clean.
 */
export interface OperatorListViewProps {
  rows: QueueOperator[]
  operators: OperatorUser[]
  selectedOperatorId: number | undefined
  onSelect: (operatorId: number) => void
  isLoading?: boolean
}

const SCORE_BAND_BG: Record<ScoreBand, string> = {
  red: 'bg-red-500 text-white ring-red-300',
  amber: 'bg-amber-400 text-white ring-amber-300',
  green: 'bg-green-500 text-white ring-green-300',
}

const ASSIGNMENT_STATE_LABEL: Record<
  AssignmentState,
  { key: string; fallback: string; tone: string }
> = {
  wait: {
    key: 'pages.training.inbox.kanbanColumns.wait',
    fallback: 'Wait',
    tone: 'bg-yellow-100 text-yellow-700',
  },
  in_progress: {
    key: 'pages.training.inbox.kanbanColumns.in_progress',
    fallback: 'In progress',
    tone: 'bg-blue-100 text-blue-700',
  },
  awaiting_training: {
    key: 'pages.training.inbox.kanbanColumns.awaiting_training',
    fallback: 'Awaiting training',
    tone: 'bg-purple-100 text-purple-700',
  },
  scheduled: {
    key: 'pages.training.inbox.kanbanColumns.scheduled',
    fallback: 'Scheduled',
    tone: 'bg-indigo-100 text-indigo-700',
  },
  closed: {
    key: 'pages.training.inbox.kanbanColumns.closed',
    fallback: 'Closed',
    tone: 'bg-gray-100 text-gray-700',
  },
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
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

export function OperatorListView({
  rows,
  operators,
  selectedOperatorId,
  onSelect,
  isLoading,
}: OperatorListViewProps) {
  const { t } = useTranslation('common')

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white/60 p-6 text-center text-sm text-gray-500">
        {t('pages.training.inbox.list.loading', 'Loading queue…')}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white/60 p-6 text-center text-sm text-gray-500">
        {t('pages.training.inbox.list.empty', 'No operators in the current scope.')}
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => {
        const name = operatorDisplayName(row.operator_id, operators)
        const departmentName = operatorDepartmentName(row.operator_id, operators)
        const isSelected = row.operator_id === selectedOperatorId
        const stateMeta = row.assignment ? ASSIGNMENT_STATE_LABEL[row.assignment.state] : null
        const lastActive = formatRelative(row.last_active_at)

        return (
          <li key={row.operator_id}>
            <button
              type="button"
              onClick={() => onSelect(row.operator_id)}
              className={[
                'flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left transition-colors',
                isSelected
                  ? 'border-primary-400 ring-primary-100 ring-2'
                  : 'hover:border-primary-200 border-gray-100',
              ].join(' ')}
            >
              <div className="relative flex-shrink-0">
                <div className="bg-primary-100 text-primary-700 flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold">
                  {name.slice(0, 1).toUpperCase()}
                </div>
                {row.triggers.length > 0 ? (
                  <span
                    aria-label="red flag"
                    className="absolute -top-0.5 -right-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500"
                  />
                ) : null}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-dark-500 truncate text-sm font-medium">{name}</span>
                  {departmentName ? (
                    <span className="bg-primary-50 text-primary-700 flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase">
                      {departmentName}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {stateMeta ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${stateMeta.tone}`}
                    >
                      {t(stateMeta.key, stateMeta.fallback)}
                    </span>
                  ) : null}
                  {lastActive ? (
                    <span className="text-[10px] text-gray-500">{lastActive}</span>
                  ) : null}
                  {row.triggers.length > 0 ? (
                    <span className="text-[10px] font-medium text-red-600">
                      {t('pages.training.inbox.list.triggerCount', '{{count}} triggers', {
                        count: row.triggers.length,
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ring-1 ${SCORE_BAND_BG[row.score_band]}`}
              >
                {row.composite_score}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default OperatorListView
