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
 * Figma frame:
 *   – Operator header (avatar + name + ext. + online dot + score badge)
 *   – Red status banner explaining why the operator is in the queue
 *   – 4-stat row (score change / avg call / tasks done / idle today)
 *   – "Why entered the queue" cards (left column)
 *   – "Latest dialogue ratings" cards (right column)
 *   – Edit / Reset action buttons at the bottom
 */
export interface MockOperatorDetailPanelProps {
  operator: MockInboxRow | null
}

const SCORE_BG: Record<ScoreBand, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-400',
  green: 'bg-emerald-500',
}

const QUEUE_TONE: Record<'red' | 'amber' | 'green', { bg: string; border: string; dot: string }> = {
  red: { bg: 'bg-red-50', border: 'border-red-100', dot: 'bg-red-500' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', dot: 'bg-amber-500' },
  green: { bg: 'bg-emerald-50', border: 'border-emerald-100', dot: 'bg-emerald-500' },
}

const RATING_TONE: Record<'red' | 'amber' | 'green', string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-400',
  green: 'bg-emerald-500',
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

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
        <div className="relative flex-shrink-0">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-gray-700"
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
          <div className="flex items-center gap-2">
            <span className="text-dark-500 truncate text-sm font-semibold">{operator.name}</span>
            <span className="bg-primary-50 text-primary-700 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase">
              {operator.department}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span>ext. 1{operator.operatorId.toString().padStart(3, '0')}</span>
            <span>·</span>
            <span className={operator.online ? 'text-emerald-600' : 'text-gray-400'}>
              {operator.online ? 'Online' : operator.lastActiveLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-white shadow-md ring-4 ring-white ${SCORE_BG[operator.scoreBand]}`}
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

      {/* Red status banner */}
      <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2">
        <Icons.Warning size={14} className="flex-shrink-0 text-red-600" />
        <span className="text-[11px] font-medium text-red-700">{detail.statusBannerText}</span>
      </div>

      {/* 4-stat row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {detail.statsRow.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col items-start gap-0.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2"
          >
            <span className={`text-base font-semibold ${stat.tone}`}>{stat.value}</span>
            <span className="text-[10px] tracking-wide text-gray-500 uppercase">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Why entered the queue */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-medium tracking-wide text-gray-600 uppercase">
            {t('pages.training.inbox.detail.whyInQueue', 'Why entered the queue')}
          </span>
          <div className="flex flex-col gap-1.5">
            {detail.whyInQueue.map((item) => {
              const tone = QUEUE_TONE[item.tone]
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-2 rounded-xl border ${tone.border} ${tone.bg} px-3 py-2`}
                >
                  <span
                    className={`mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full ${tone.dot}`}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-dark-500 text-[12px] font-medium">{item.label}</span>
                    <span className="text-[10px] text-gray-500">{item.meta}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Latest dialogue ratings */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-medium tracking-wide text-gray-600 uppercase">
            {t('pages.training.inbox.detail.latestRatings', 'Latest dialogue ratings')}
          </span>
          <div className="flex flex-col gap-1.5">
            {detail.latestDialogueRatings.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2"
              >
                <span className="bg-primary-50 text-primary-700 flex h-7 w-7 items-center justify-center rounded-full">
                  <Icons.ChatFeedback01 size={12} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-dark-500 text-[12px] font-medium">{r.label}</span>
                  <span className="text-[10px] text-gray-500">
                    {t('pages.training.inbox.detail.triggers', 'Triggers')}: {r.triggerCount}
                  </span>
                </div>
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full text-[11px] font-semibold text-white ${RATING_TONE[r.tone]}`}
                >
                  {r.score}/{r.scoreOutOf}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trainer actions list */}
      <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/40 p-3">
        <span className="text-[10px] font-medium tracking-wide text-gray-600 uppercase">
          {t('pages.training.inbox.detail.trainerActionsLabel', 'Trainer actions')}
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ActionTile
            icon={<Icons.PlayCircle02 size={14} />}
            label={t('pages.training.inbox.detail.trainerActions.listen', 'Listen to the call')}
            tone="emerald"
          />
          <ActionTile
            icon={<Icons.Calendar size={14} />}
            label={t('pages.training.inbox.detail.trainerActions.planOneOnOne', 'Plan 1-on-1')}
            tone="blue"
          />
          <ActionTile
            icon={<Icons.Brochure size={14} />}
            label={t('pages.training.inbox.detail.trainerActions.assignTask', 'Assign a task')}
            tone="violet"
          />
          <ActionTile
            icon={<Icons.ChatFeedback01 size={14} />}
            label={t('pages.training.inbox.detail.trainerActions.takeCharge', 'Take charge')}
            tone="amber"
          />
        </div>
      </div>

      {/* Bottom action buttons */}
      <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
        <Button variant="secondary" size="sm" className="rounded-full text-[11px]">
          {t('pages.training.inbox.detail.edit', 'Edit')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="rounded-full text-[11px]"
          leftIcon={<Icons.Checkmark size={12} className="text-white" />}
        >
          {t('pages.training.inbox.detail.reset', 'Reset')}
        </Button>
      </div>
    </div>
  )
}

function ActionTile({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode
  label: string
  tone: 'emerald' | 'blue' | 'violet' | 'amber'
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    amber: 'bg-amber-50 text-amber-700',
  }
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-2.5 py-2 text-left text-[11px] font-medium text-gray-700 transition-colors hover:border-gray-200"
    >
      <span
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${toneClasses[tone]}`}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  )
}

export default MockOperatorDetailPanel
