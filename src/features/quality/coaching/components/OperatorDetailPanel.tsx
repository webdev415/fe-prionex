import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useOperatorCoachingDetail } from '../hooks'
import type { CoachingPeriod, ScoreBand, AssignmentState } from '../types'

/**
 * Right-side operator detail panel used by:
 *   - KAN-413 Inbox (all three view modes)
 *   - KAN-414 Team tab (clicking a team operator card)
 *
 * Lives in the feature module so KAN-414 imports it without going through
 * the Inbox-page component tree. Self-contained data fetching: takes
 * operator_id + period, calls /coaching/operators/{id}/detail.
 *
 * Step 4 ships the read view + stub action buttons. Real action wiring
 * lands per Quick Action: Rate dialogue (step 5), Schedule 1-on-1 (step 6),
 * Take charge / Assign task (step 7), Assign material (KAN-416).
 */
export interface OperatorDetailPanelProps {
  operatorId: number | undefined
  operatorName?: string | undefined
  period?: CoachingPeriod
  fromDate?: string
  toDate?: string
  onListen?: () => void
  onAssignTask?: () => void
  onPlanOneOnOne?: () => void
  onTakeCharge?: () => void
}

const SCORE_BAND_CLASSES: Record<ScoreBand, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  amber: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  green: 'border-green-200 bg-green-50 text-green-700',
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

function formatPct(value: number | null | undefined, fallback = '—'): string {
  if (value == null) return fallback
  return `${value.toFixed(0)}%`
}

export function OperatorDetailPanel({
  operatorId,
  operatorName,
  period = 'last_7d',
  fromDate,
  toDate,
  onListen,
  onAssignTask,
  onPlanOneOnOne,
  onTakeCharge,
}: OperatorDetailPanelProps) {
  const { t } = useTranslation('common')

  const enabled = operatorId != null && Number.isFinite(operatorId)
  const { data, isLoading, isError } = useOperatorCoachingDetail(
    {
      operator_id: operatorId ?? 0,
      period,
      from_date: fromDate,
      to_date: toDate,
    },
    enabled
  )

  if (!enabled) {
    return (
      <aside className="flex h-full flex-col items-center justify-center rounded-2xl bg-white/60 p-10 text-center text-sm text-gray-500">
        {t(
          'pages.actionAnalysis.inbox.detail.selectOperator',
          'Select an operator to see details.'
        )}
      </aside>
    )
  }

  if (isLoading) {
    return (
      <aside className="flex h-full flex-col items-center justify-center rounded-2xl bg-white/60 p-10 text-sm text-gray-500">
        {t('pages.actionAnalysis.inbox.detail.loading', 'Loading…')}
      </aside>
    )
  }

  if (isError || !data) {
    return (
      <aside className="flex h-full flex-col items-center justify-center rounded-2xl bg-white/60 p-10 text-sm text-red-600">
        {t('pages.actionAnalysis.inbox.detail.loadFailed', 'Could not load operator details.')}
      </aside>
    )
  }

  const stateLabel = data.assignment
    ? t(
        ASSIGNMENT_STATE_LABEL_KEYS[data.assignment.state].key,
        ASSIGNMENT_STATE_LABEL_KEYS[data.assignment.state].fallback
      )
    : null

  return (
    <aside className="flex h-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary-100 text-primary-700 flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold">
            {(operatorName ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <span className="text-dark-500 text-base font-semibold">
              {operatorName ?? `#${data.operator_id}`}
            </span>
            {stateLabel ? <span className="mt-0.5 text-xs text-gray-500">{stateLabel}</span> : null}
          </div>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full border text-base font-semibold ${SCORE_BAND_CLASSES[data.score_band]}`}
        >
          {data.composite_score}
        </div>
      </header>

      {data.triggers.length > 0 ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700">
            {t('pages.actionAnalysis.inbox.detail.redFlagsHeadline', '{{count}} red flags', {
              count: data.kpis.red_flag_count,
            })}
          </p>
          <ul className="mt-2 space-y-1">
            {data.triggers.map((trigger) => (
              <li key={trigger} className="flex items-center gap-2 text-xs text-red-700">
                <span className="inline-block h-1 w-1 rounded-full bg-red-500" />
                {t(`pages.actionAnalysis.inbox.triggers.${trigger}`, trigger.replace(/_/g, ' '))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex flex-col rounded-xl bg-gray-50 p-3">
          <span className="text-[10px] font-medium tracking-wide text-gray-500 uppercase">
            {t('pages.actionAnalysis.inbox.detail.kpis.scriptAdherence', 'Script')}
          </span>
          <span className="text-dark-500 mt-1 text-sm font-semibold">
            {formatPct(data.kpis.script_adherence_pct)}
          </span>
        </div>
        <div className="flex flex-col rounded-xl bg-gray-50 p-3">
          <span className="text-[10px] font-medium tracking-wide text-gray-500 uppercase">
            {t('pages.actionAnalysis.inbox.detail.kpis.scorecardAvg', 'Scorecard')}
          </span>
          <span className="text-dark-500 mt-1 text-sm font-semibold">
            {formatPct(data.kpis.avg_scorecard_pct)}
          </span>
        </div>
        <div className="flex flex-col rounded-xl bg-gray-50 p-3">
          <span className="text-[10px] font-medium tracking-wide text-gray-500 uppercase">
            {t('pages.actionAnalysis.inbox.detail.kpis.conversion', 'Conversion')}
          </span>
          <span className="text-dark-500 mt-1 text-sm font-semibold">
            {formatPct(data.kpis.conversion_rate)}
          </span>
        </div>
        <div className="flex flex-col rounded-xl bg-gray-50 p-3">
          <span className="text-[10px] font-medium tracking-wide text-gray-500 uppercase">
            {t('pages.actionAnalysis.inbox.detail.kpis.tasksOnTime', 'Tasks on time')}
          </span>
          <span className="text-dark-500 mt-1 text-sm font-semibold">
            {formatPct(data.kpis.task_completion_on_time_pct)}
          </span>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase">
          {t('pages.actionAnalysis.inbox.detail.latestRatings', 'Latest dialogue ratings')}
        </h3>
        {data.latest_scorecards.length === 0 ? (
          <p className="text-xs text-gray-500">
            {t(
              'pages.actionAnalysis.inbox.detail.noScorecards',
              'No scorecards in the selected period.'
            )}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {data.latest_scorecards.map((sc) => (
              <li
                key={sc.id}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-white p-2.5 text-xs"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-gray-700">
                    {new Date(sc.created_at).toLocaleDateString()}
                  </span>
                  <span className="text-[11px] text-gray-500">{sc.status}</span>
                </div>
                <span className="text-dark-500 text-sm font-semibold">
                  {sc.weighted_score != null ? Number(sc.weighted_score).toFixed(1) : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-auto flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <ActionButton
          icon={<Icons.Phone size={14} />}
          label={t('pages.actionAnalysis.inbox.detail.trainerActions.listen', 'Listen to the call')}
          onClick={onListen}
        />
        <ActionButton
          icon={<Icons.Brochure size={14} />}
          label={t('pages.actionAnalysis.inbox.detail.trainerActions.assignTask', 'Assign a task')}
          onClick={onAssignTask}
        />
        <ActionButton
          icon={<Icons.Calendar size={14} />}
          label={t('pages.actionAnalysis.inbox.detail.trainerActions.planOneOnOne', 'Plan 1-on-1')}
          onClick={onPlanOneOnOne}
        />
        <ActionButton
          icon={<Icons.Tick01 size={14} />}
          label={t('pages.actionAnalysis.inbox.detail.trainerActions.takeCharge', 'Take charge')}
          onClick={onTakeCharge}
          primary
        />
      </footer>
    </aside>
  )
}

function ActionButton({
  icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  primary?: boolean
}) {
  const disabled = !onClick
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
        primary
          ? 'bg-primary-500 hover:bg-primary-600 text-white'
          : 'hover:border-primary-300 border border-gray-200 bg-white text-gray-700',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon}
      {label}
    </button>
  )
}

export default OperatorDetailPanel
