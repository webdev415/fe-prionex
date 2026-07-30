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
  red: 'bg-error-100 text-error-700 ring-error-200',
  amber: 'bg-warning-100 text-warning-700 ring-warning-200',
  green: 'bg-success-100 text-success-700 ring-success-200',
}

const ASSIGNMENT_STATE_TONE: Record<AssignmentState, string> = {
  wait: 'bg-warning-100 text-warning-700',
  in_progress: 'bg-info-100 text-info-700',
  awaiting_training: 'bg-secondary-100 text-secondary-700',
  scheduled: 'bg-primary-100 text-primary-700',
  closed: 'bg-muted text-muted-foreground',
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
  return `${Math.floor(months / 12)}y ago`
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
      <div className="bg-card/60 text-muted-foreground rounded-2xl p-6 text-center text-sm">
        {t('pages.actionAnalysis.inbox.list.loading', 'Loading queue…')}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="bg-card/60 text-muted-foreground rounded-2xl p-6 text-center text-sm">
        {t('pages.actionAnalysis.inbox.list.empty', 'No operators in the current scope.')}
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rows.map((row) => {
        const name = operatorDisplayName(row.operator_id, operators)
        const departmentName = operatorDepartmentName(row.operator_id, operators)
        const lastActive = formatRelative(row.last_active_at)
        const isSelected = row.operator_id === selectedOperatorId
        const stateLabel = row.assignment ? ASSIGNMENT_STATE_LABEL_KEYS[row.assignment.state] : null
        return (
          <li key={row.operator_id}>
            <button
              type="button"
              onClick={() => onSelect(row.operator_id)}
              className={[
                'bg-card flex h-full w-full flex-col gap-3 rounded-xl border p-3 text-left transition-colors',
                isSelected
                  ? 'border-primary-400 ring-primary-100 ring-2'
                  : 'hover:border-primary-200 border-border',
              ].join(' ')}
            >
              <header className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative flex-shrink-0">
                    <div className="bg-primary-100 text-primary-700 flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                    {row.triggers.length > 0 ? (
                      <span
                        aria-label="red flag"
                        className="border-card bg-destructive absolute -top-0.5 -right-0.5 inline-block h-2.5 w-2.5 rounded-full border-2"
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-foreground truncate text-sm font-medium">{name}</span>
                    <div className="flex flex-wrap items-center gap-1">
                      {departmentName ? (
                        <span className="bg-primary-100 text-primary-700 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase">
                          {departmentName}
                        </span>
                      ) : null}
                      {stateLabel ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ASSIGNMENT_STATE_TONE[row.assignment!.state]}`}
                        >
                          {t(stateLabel.key, stateLabel.fallback)}
                        </span>
                      ) : null}
                      {lastActive ? (
                        <span className="text-muted-foreground text-[9px]">{lastActive}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <span
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-base font-bold ring-1 ${row.score_band ? SCORE_BAND_BG[row.score_band] : 'bg-muted text-muted-foreground ring-border'}`}
                >
                  {row.composite_score}
                </span>
              </header>

              <div className="border-border grid grid-cols-3 gap-1.5 border-t pt-2">
                <ProgressRing
                  label={t('pages.actionAnalysis.inbox.detail.kpis.scriptAdherence', 'Script')}
                  pct={row.kpis.script_adherence_pct}
                  tone="emerald"
                />
                <ProgressRing
                  label={t('pages.actionAnalysis.inbox.detail.kpis.scorecardAvg', 'Scorecard')}
                  pct={row.kpis.avg_scorecard_pct}
                  tone="blue"
                />
                <ProgressRing
                  label={t('pages.actionAnalysis.inbox.detail.kpis.conversion', 'Conversion')}
                  pct={row.kpis.conversion_rate}
                  tone="amber"
                />
              </div>

              {row.triggers.length > 0 ? (
                <footer className="text-error-600 text-[10px] font-medium">
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

type RingTone = 'emerald' | 'blue' | 'amber'

const RING_STROKES: Record<RingTone, string> = {
  emerald: 'stroke-success-500',
  blue: 'stroke-blue-500',
  amber: 'stroke-amber-500',
}

function ProgressRing({
  label,
  pct,
  tone,
}: {
  label: string
  pct: number | null | undefined
  tone: RingTone
}) {
  const display = pct == null ? '—' : `${Math.round(pct)}%`
  const clamped = Math.max(0, Math.min(100, pct ?? 0))
  // SVG ring math: 24×24 viewbox, radius 10 → circumference ≈ 62.83
  const circumference = 2 * Math.PI * 10
  const dashOffset = circumference * (1 - clamped / 100)
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative h-9 w-9">
        <svg viewBox="0 0 24 24" className="h-9 w-9 -rotate-90">
          <circle
            cx="12"
            cy="12"
            r="10"
            className="stroke-gray-200"
            strokeWidth="2.5"
            fill="none"
          />
          <circle
            cx="12"
            cy="12"
            r="10"
            className={RING_STROKES[tone]}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="text-foreground absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
          {display}
        </span>
      </div>
      <span className="text-muted-foreground text-[9px] font-medium tracking-wide uppercase">
        {label}
      </span>
    </div>
  )
}

export default OperatorGridView
