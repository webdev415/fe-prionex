import { useTranslation } from 'react-i18next'
import { type InboxCardRow, type ScoreBand } from '../../mocks/trainerWorkplaceMocks'

/**
 * Grid view of the Inbox queue (KAN-413 §3.5).
 *
 * Visual layout mirrors the Figma `Grid View` frame (promoted from the
 * `MockInboxGridView`). Each card surfaces composite score, presence,
 * trigger tags, and a compact daily-plan progress bar; missing fields
 * (daily plan, online duration) render as placeholders until the per-
 * operator detail endpoint surfaces them.
 */
export interface OperatorGridViewProps {
  rows: InboxCardRow[]
  selectedOperatorId?: number
  onSelect: (operatorId: number) => void
  isLoading?: boolean
}

const SCORE_TRACK: Record<ScoreBand, string> = {
  red: 'stroke-red-500',
  amber: 'stroke-amber-400',
  green: 'stroke-emerald-500',
}

const SCORE_TEXT: Record<ScoreBand, string> = {
  red: 'text-red-500',
  amber: 'text-amber-600',
  green: 'text-emerald-600',
}

const TAG_TONE: Record<'red' | 'amber' | 'teal', string> = {
  red: 'bg-red-50 text-red-700',
  amber: 'bg-yellow-50 text-amber-800',
  teal: 'bg-teal-50 text-teal-700',
}

export function OperatorGridView({
  rows,
  selectedOperatorId,
  onSelect,
  isLoading,
}: OperatorGridViewProps) {
  const { t } = useTranslation('common')

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
        {t('pages.training.inbox.list.loading', 'Loading queue…')}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
        {t('pages.training.inbox.list.empty', 'No operators in the current scope.')}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const isSelected = row.operatorId === selectedOperatorId
        const radius = 20
        const circumference = 2 * Math.PI * radius
        const offset = circumference - (row.compositeScore / 100) * circumference
        const planPct =
          row.dailyPlanTotal > 0 ? Math.round((row.dailyPlanDone / row.dailyPlanTotal) * 100) : 0
        return (
          <button
            key={row.operatorId}
            type="button"
            onClick={() => onSelect(row.operatorId)}
            className={`flex flex-col gap-3 rounded-xl border bg-white p-4 text-left transition-colors ${
              isSelected
                ? 'border-[#204E4D] ring-1 ring-[#204E4D]/20'
                : 'border-[#EBECE8] hover:border-[#204E4D]/40'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-[#05040D]"
                  style={{ backgroundColor: row.avatarColor }}
                >
                  {row.initials}
                </div>
                <span
                  className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white ${
                    row.online ? 'bg-emerald-500' : 'bg-gray-400'
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#05040D]">{row.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-1.5 py-0.5 text-[9px] font-medium text-[#C2410C]">
                    {row.segment}
                  </span>
                  <span className="truncate text-[11px] text-gray-500">{row.team}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {row.online
                    ? t('pages.training.inbox.grid.online', 'Online')
                    : t('pages.training.inbox.detail.offline', 'Offline')}
                  {row.online ? '' : ` · ${row.lastActiveLabel}`}
                </p>
              </div>
              <div className="relative h-12 w-12 flex-shrink-0">
                <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r={radius}
                    strokeWidth="3"
                    fill="none"
                    className="stroke-[#EDEDED]"
                  />
                  {row.hasScore !== false ? (
                    <circle
                      cx="24"
                      cy="24"
                      r={radius}
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={offset}
                      className={SCORE_TRACK[row.scoreBand]}
                    />
                  ) : null}
                </svg>
                <span
                  className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${
                    row.hasScore !== false ? SCORE_TEXT[row.scoreBand] : 'text-gray-400'
                  }`}
                >
                  {row.hasScore !== false ? row.compositeScore : '—'}
                </span>
              </div>
            </div>

            <div className="border-t border-[#EBECE8]" />

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <p className="font-medium tracking-wide text-gray-500 uppercase">
                  {t('pages.training.inbox.grid.dailyPlan', 'Daily plan')}
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-[#204E4D]"
                    style={{ width: `${planPct}%` }}
                  />
                </div>
                <p className="mt-0.5 text-gray-600">
                  {row.dailyPlanDone}/{row.dailyPlanTotal}
                </p>
              </div>
              <div>
                <p className="font-medium tracking-wide text-gray-500 uppercase">
                  {t('pages.training.inbox.grid.online', 'Online')}
                </p>
                <p className="mt-1 text-sm font-semibold text-[#05040D]">{row.onlineDuration}</p>
                <p className="text-gray-600">{row.onlineSince}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {row.triggerTags.map((tag) => (
                <span
                  key={tag.label}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TAG_TONE[tag.tone]}`}
                >
                  {tag.label}
                </span>
              ))}
              {row.priority === 'critical' ? (
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700">
                  {t('pages.training.inbox.grid.manually', 'Manually')}
                </span>
              ) : null}
            </div>

            <p className="text-[10px] text-gray-500">{row.cardTimestamp}</p>
          </button>
        )
      })}
    </div>
  )
}

export default OperatorGridView
