import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useOperatorCoachingDetail } from '../hooks'
import type { CoachingPeriod, ScoreBand, AssignmentState, ScorecardSummary } from '../types'

/**
 * Right-side operator detail panel used by:
 *   - KAN-413 Inbox (all three view modes)
 *   - KAN-414 Team tab (clicking a team operator card)
 *
 * Layout follows [Figma/ENG - Training _ Inbox View _ A.png] — header with
 * avatar + tags + big composite score circle on the right, red-flag headline
 * banner, 4 KPI tiles in a row, "Why entered the queue" trigger pill list,
 * "Latest dialogue ratings" mini-cards with score chips, trainer-actions
 * row at the bottom.
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

const SCORE_BAND_RING: Record<ScoreBand, string> = {
  red: 'bg-red-500 text-white shadow-red-300 shadow-lg',
  amber: 'bg-amber-400 text-white shadow-amber-300 shadow-lg',
  green: 'bg-green-500 text-white shadow-green-300 shadow-lg',
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

function formatPct(value: number | null | undefined, fallback = '—'): string {
  if (value == null) return fallback
  return `${value.toFixed(0)}%`
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

function scorecardScoreToBand(score: number | null | undefined): ScoreBand {
  if (score == null) return 'red'
  const pct = Number(score) * 20
  if (pct >= 70) return 'green'
  if (pct >= 50) return 'amber'
  return 'red'
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

  const stateMeta = data.assignment ? ASSIGNMENT_STATE_LABEL_KEYS[data.assignment.state] : null
  const lastActive = formatRelative(data.last_active_at)

  return (
    <aside className="flex h-full flex-col gap-4 overflow-hidden rounded-2xl bg-white p-5 shadow-sm">
      {/* Header — avatar + name + tag chips + big composite score circle */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary-100 text-primary-700 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-lg font-semibold">
            {(operatorName ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-dark-500 text-lg font-semibold">
              {operatorName ?? `#${data.operator_id}`}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {stateMeta ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ASSIGNMENT_STATE_TONE[data.assignment!.state]}`}
                >
                  {t(stateMeta.key, stateMeta.fallback)}
                </span>
              ) : null}
              {data.kpis.red_flag_count > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                  {t('pages.actionAnalysis.inbox.detail.riskyTag', 'Risky')}
                </span>
              ) : null}
              {lastActive ? (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                  {lastActive}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div
          className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold ${SCORE_BAND_RING[data.score_band]}`}
        >
          {data.composite_score}
        </div>
      </header>

      {/* Red flag headline banner */}
      {data.triggers.length > 0 ? (
        <section className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-sm font-medium text-red-800">
            {t('pages.actionAnalysis.inbox.detail.redFlagsHeadline', '{{count}} red flags', {
              count: data.kpis.red_flag_count || data.triggers.length,
            })}
          </p>
          <p className="mt-0.5 text-xs text-red-700">
            {t(
              'pages.actionAnalysis.inbox.detail.redFlagsSubtitle',
              'Coaching attention needed — recent triggers have accumulated.'
            )}
          </p>
        </section>
      ) : null}

      {/* 4 KPI tiles */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiTile
          label={t('pages.actionAnalysis.inbox.detail.kpis.scriptAdherence', 'Script')}
          value={formatPct(data.kpis.script_adherence_pct)}
        />
        <KpiTile
          label={t('pages.actionAnalysis.inbox.detail.kpis.scorecardAvg', 'Scorecard')}
          value={formatPct(data.kpis.avg_scorecard_pct)}
        />
        <KpiTile
          label={t('pages.actionAnalysis.inbox.detail.kpis.conversion', 'Conversion')}
          value={formatPct(data.kpis.conversion_rate)}
        />
        <KpiTile
          label={t('pages.actionAnalysis.inbox.detail.kpis.tasksOnTime', 'Tasks on time')}
          value={formatPct(data.kpis.task_completion_on_time_pct)}
        />
      </section>

      {/* Why entered the queue — bulleted trigger list */}
      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-medium tracking-wide text-gray-500 uppercase">
          {t('pages.actionAnalysis.inbox.detail.whyInQueue', 'Why entered the queue')}
        </h3>
        {data.triggers.length === 0 ? (
          <p className="text-xs text-gray-500">
            {t(
              'pages.actionAnalysis.inbox.detail.noTriggers',
              'No active triggers in the selected period.'
            )}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {data.triggers.map((trigger) => (
              <li
                key={trigger}
                className="flex items-center gap-2 rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-800"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
                {t(`pages.actionAnalysis.inbox.triggers.${trigger}`, trigger.replace(/_/g, ' '))}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Latest dialogue ratings — horizontal mini-cards with score chips */}
      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs font-medium tracking-wide text-gray-500 uppercase">
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
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            {data.latest_scorecards.slice(0, 4).map((sc) => (
              <ScorecardMiniCard key={sc.id} scorecard={sc} />
            ))}
          </ul>
        )}
      </section>

      {/* Trainer actions footer */}
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

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
      <span className="text-[9px] font-medium tracking-wide text-gray-500 uppercase">{label}</span>
      <span className="text-dark-500 text-base font-semibold">{value}</span>
    </div>
  )
}

function ScorecardMiniCard({ scorecard }: { scorecard: ScorecardSummary }) {
  const band = scorecardScoreToBand(
    scorecard.weighted_score != null ? Number(scorecard.weighted_score) : null
  )
  const ringClass: Record<ScoreBand, string> = {
    red: 'bg-red-500 text-white',
    amber: 'bg-amber-400 text-white',
    green: 'bg-green-500 text-white',
  }
  const displayScore =
    scorecard.weighted_score != null ? Number(scorecard.weighted_score).toFixed(1) : '—'
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-gray-100 bg-white p-2.5">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${ringClass[band]}`}
      >
        {displayScore}
      </span>
      <span className="truncate text-[10px] text-gray-600">
        {new Date(scorecard.created_at).toLocaleDateString()}
      </span>
      <span className="truncate text-[10px] font-medium text-gray-500 uppercase">
        {scorecard.status}
      </span>
    </li>
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
