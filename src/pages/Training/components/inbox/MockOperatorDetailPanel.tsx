import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import {
  MOCK_OPERATOR_DETAIL,
  type MockInboxRow,
  type ScoreBand,
} from '../../mocks/trainerWorkplaceMocks'

/**
 * Right-side Operator Detail Panel (mock data). Mirrors the Inbox View A
 * Figma frame: composite score badge, recent calls, score series mini
 * chart, criteria breakdown, recent 1-on-1s, action buttons.
 */
export interface MockOperatorDetailPanelProps {
  operator: MockInboxRow | null
}

const SCORE_BG: Record<ScoreBand, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-400',
  green: 'bg-emerald-500',
}

const RESULT_TONE: Record<string, string> = {
  Promise: 'bg-emerald-100 text-emerald-700',
  Refusal: 'bg-red-100 text-red-700',
  Missed: 'bg-amber-100 text-amber-700',
  Positive: 'bg-blue-100 text-blue-700',
}

export function MockOperatorDetailPanel({ operator }: MockOperatorDetailPanelProps) {
  const { t } = useTranslation('common')

  if (!operator) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-xs text-gray-500 shadow-sm">
        {t('pages.training.inbox.detail.empty', 'Select an operator from the list')}
      </div>
    )
  }

  const detail = MOCK_OPERATOR_DETAIL
  const seriesMax = Math.max(...detail.scoreSeries.map((p) => p.value))

  return (
    <div className="flex max-h-[640px] flex-col gap-3 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-gray-100 pb-3">
        <div className="relative flex-shrink-0">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold text-gray-700"
            style={{ backgroundColor: operator.avatarColor }}
          >
            {operator.initials}
          </div>
          <span
            className={`absolute -right-0.5 -bottom-0.5 inline-block h-3 w-3 rounded-full border-2 border-white ${
              operator.online ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-dark-500 text-sm font-semibold">{operator.name}</span>
          <span className="text-[11px] text-gray-500">
            {operator.team} · {operator.department}
          </span>
          <span className="text-[10px] text-gray-400">{operator.lastActiveLabel}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white ${SCORE_BG[operator.scoreBand]}`}
          >
            {operator.compositeScore}
          </span>
          <span
            className={`text-[10px] font-medium ${
              operator.scoreDeltaPct >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {operator.scoreDeltaPct >= 0 ? '↗' : '↘'} {Math.abs(operator.scoreDeltaPct)}%
          </span>
        </div>
      </div>

      {/* Triggers */}
      {operator.triggers.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-red-100 bg-red-50/60 p-3">
          <span className="text-[10px] font-medium tracking-wide text-red-700 uppercase">
            {t('pages.training.inbox.detail.triggers', 'Active triggers')}
          </span>
          {operator.triggers.map((tr) => (
            <div key={tr.id} className="flex items-center gap-2">
              <Icons.Warning size={12} className="text-red-600" />
              <span className="text-xs font-medium text-red-800">{tr.label}</span>
              <span className="ml-auto text-[10px] text-red-500">{tr.detectedAtLabel}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Score series mini chart */}
      <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-medium tracking-wide text-gray-600 uppercase">
            {t('pages.training.inbox.detail.scoreSeries', 'Score · last 7 days')}
          </span>
          <span className="text-primary-600 text-[10px] font-medium">
            {t('pages.training.inbox.detail.viewDynamics', 'View dynamics')} →
          </span>
        </div>
        <div className="flex h-24 items-stretch gap-2">
          {detail.scoreSeries.map((p) => {
            const heightPct = (p.value / seriesMax) * 100
            return (
              <div key={p.label} className="flex flex-1 flex-col items-center justify-end gap-1">
                <div className="relative flex h-full w-full items-end justify-center">
                  <div
                    className="bg-primary-400 w-full rounded-t-sm transition-all"
                    style={{ height: `${heightPct}%` }}
                    title={`${p.label}: ${p.value}`}
                  />
                  <span className="absolute -top-3 text-[8px] font-medium text-gray-500">
                    {p.value}
                  </span>
                </div>
                <span className="text-[9px] text-gray-500">{p.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Criteria breakdown */}
      <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-3">
        <span className="text-[10px] font-medium tracking-wide text-gray-600 uppercase">
          {t('pages.training.inbox.detail.criteria', 'Criteria breakdown')}
        </span>
        {detail.criteria.map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <span className="flex-1 text-[11px] text-gray-700">{c.label}</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
              <div
                className="bg-primary-500 h-full rounded-full"
                style={{ width: `${(c.score / c.max) * 100}%` }}
              />
            </div>
            <span className="w-10 text-right text-[10px] font-medium text-gray-600">
              {c.score}/{c.max}
            </span>
          </div>
        ))}
      </div>

      {/* Recent calls */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-medium tracking-wide text-gray-600 uppercase">
          {t('pages.training.inbox.detail.recentCalls', 'Recent calls')}
        </span>
        {detail.recentCalls.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-2"
          >
            <span className="bg-primary-50 text-primary-700 flex h-7 w-7 items-center justify-center rounded-full">
              <Icons.PlayCircle02 size={12} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-dark-500 text-xs font-medium">{c.dateLabel}</span>
              <span className="text-[10px] text-gray-500">{c.durationLabel}</span>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${RESULT_TONE[c.result]}`}
            >
              {c.result}
            </span>
            <span
              className={`flex h-7 w-9 items-center justify-center rounded-full text-[10px] font-semibold text-white ${SCORE_BG[c.scoreBand]}`}
            >
              {c.score}
            </span>
          </div>
        ))}
      </div>

      {/* Recent 1-on-1s */}
      <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-3">
        <span className="text-[10px] font-medium tracking-wide text-gray-600 uppercase">
          {t('pages.training.inbox.detail.oneOnOnes', 'Recent 1-on-1s')}
        </span>
        {detail.recentOneOnOnes.map((o, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <Icons.Calendar size={12} className="text-gray-400" />
            <span className="flex-1 text-gray-700">{o.topic}</span>
            <span className="text-[10px] text-gray-500">{o.dateLabel}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                o.status === 'done'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {o.status === 'done' ? 'Done' : 'Planned'}
            </span>
          </div>
        ))}
      </div>

      {/* Coach notes */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-amber-100 bg-amber-50/40 p-3">
        <span className="text-[10px] font-medium tracking-wide text-amber-800 uppercase">
          {t('pages.training.inbox.detail.notes', "Coach's notes")}
        </span>
        {detail.notes.map((n, i) => (
          <span key={i} className="text-[11px] text-amber-900">
            · {n}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          size="sm"
          className="rounded-full text-[11px]"
          leftIcon={<Icons.PlayCircle02 size={12} className="text-white" />}
        >
          {t('pages.training.inbox.detail.listen', 'Listen to a call')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full text-[11px]"
          leftIcon={<Icons.Calendar size={12} />}
        >
          {t('pages.training.inbox.detail.plan', 'Plan 1-on-1')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full text-[11px]"
          leftIcon={<Icons.Brochure size={12} />}
        >
          {t('pages.training.inbox.detail.assignTask', 'Assign task')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full text-[11px]"
          leftIcon={<Icons.ChatFeedback01 size={12} />}
        >
          {t('pages.training.inbox.detail.feedback', 'Leave feedback')}
        </Button>
      </div>
    </div>
  )
}

export default MockOperatorDetailPanel
