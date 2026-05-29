import { useTranslation } from 'react-i18next'
import type { OperatorUser } from '@/features/users/api/usersApi'
import type { AssignmentState, QueueOperator, ScoreBand } from '@/features/quality/coaching/types'

/**
 * Grid view — card lattice of operators. Same data contract as the Inbox
 * and Kanban views (KAN-413, plan §3.5). Cards are wider than the Inbox
 * list rows and stack a few KPIs visually so trainers can scan the whole
 * floor at once.
 *
 * Click a card → focuses the operator in the right-side detail panel via
 * the parent-supplied `onSelect`. No drag-drop here; transitions go through
 * the Kanban view or the detail panel's "Take charge" / 1-on-1 buttons.
 */
export interface OperatorGridViewProps {
  rows: QueueOperator[]
  operators: OperatorUser[]
  selectedOperatorId: number | undefined
  onSelect: (operatorId: number) => void
  isLoading?: boolean
}

const SCORE_BAND_BG: Record<ScoreBand, string> = {
  red: 'bg-red-50 text-red-700 ring-red-200',
  amber: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  green: 'bg-green-50 text-green-700 ring-green-200',
}

const ASSIGNMENT_STATE_TONE: Record<AssignmentState, string> = {
  wait: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  awaiting_training: 'bg-purple-100 text-purple-700',
  scheduled: 'bg-indigo-100 text-indigo-700',
  closed: 'bg-gray-100 text-gray-700',
}

const ASSIGNMENT_STATE_LABEL_KEYS: Record<AssignmentState, { key: string; fallback: string }> = {
  wait: { key: 'pages.actionAnalysis.inbox.kanbanColumns.wait', fallback: 'Wait' },
  in_progress: {
    key: 'pages.actionAnalysis.inbox.kanbanColumns.in_progress',
    fallback: 'In progress',
  },
  awaiting_training: {
    key: 'pages.actionAnalysis.inbox.kanbanColumns.awaiting_training',
    fallback: 'Awaiting training',
  },
  scheduled: {
    key: 'pages.actionAnalysis.inbox.kanbanColumns.scheduled',
    fallback: 'Scheduled',
  },
  closed: {
    key: 'pages.actionAnalysis.inbox.kanbanColumns.closed',
    fallback: 'Closed',
  },
}

function operatorDisplayName(operatorId: number, operators: OperatorUser[]): string {
  const operator = operators.find((o) => o.id === operatorId)
  return operator?.full_name || `#${operatorId}`
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return '—'
  return `${value.toFixed(0)}%`
}

export function OperatorGridView({
  rows,
  operators,
  selectedOperatorId,
  onSelect,
  isLoading,
}: OperatorGridViewProps) {
  const { t } = useTranslation('common')

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white/60 p-6 text-center text-sm text-gray-500">
        {t('pages.actionAnalysis.inbox.list.loading', 'Loading queue…')}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white/60 p-6 text-center text-sm text-gray-500">
        {t('pages.actionAnalysis.inbox.list.empty', 'No operators in the current scope.')}
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((row) => {
        const name = operatorDisplayName(row.operator_id, operators)
        const isSelected = row.operator_id === selectedOperatorId
        const stateLabel = row.assignment ? ASSIGNMENT_STATE_LABEL_KEYS[row.assignment.state] : null
        return (
          <li key={row.operator_id}>
            <button
              type="button"
              onClick={() => onSelect(row.operator_id)}
              className={[
                'flex h-full w-full flex-col gap-3 rounded-xl border bg-white p-3 text-left transition-colors',
                isSelected
                  ? 'border-primary-400 ring-primary-100 ring-2'
                  : 'hover:border-primary-200 border-gray-100',
              ].join(' ')}
            >
              <header className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="bg-primary-100 text-primary-700 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-dark-500 truncate text-sm font-medium">{name}</span>
                    {stateLabel ? (
                      <span
                        className={`mt-0.5 inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${ASSIGNMENT_STATE_TONE[row.assignment!.state]}`}
                      >
                        {t(stateLabel.key, stateLabel.fallback)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ring-1 ${SCORE_BAND_BG[row.score_band]}`}
                >
                  {row.composite_score}
                </span>
              </header>

              <div className="grid grid-cols-3 gap-1.5 border-t border-gray-100 pt-2">
                <KpiCell
                  label={t('pages.actionAnalysis.inbox.detail.kpis.scriptAdherence', 'Script')}
                  value={formatPct(row.kpis.script_adherence_pct)}
                />
                <KpiCell
                  label={t('pages.actionAnalysis.inbox.detail.kpis.scorecardAvg', 'Scorecard')}
                  value={formatPct(row.kpis.avg_scorecard_pct)}
                />
                <KpiCell
                  label={t('pages.actionAnalysis.inbox.detail.kpis.conversion', 'Conversion')}
                  value={formatPct(row.kpis.conversion_rate)}
                />
              </div>

              {row.triggers.length > 0 ? (
                <footer className="text-[10px] font-medium text-red-600">
                  {t('pages.actionAnalysis.inbox.list.triggerCount', '{{count}} triggers', {
                    count: row.triggers.length,
                  })}
                </footer>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function KpiCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-medium tracking-wide text-gray-500 uppercase">{label}</span>
      <span className="text-dark-500 text-xs font-semibold">{value}</span>
    </div>
  )
}

export default OperatorGridView
