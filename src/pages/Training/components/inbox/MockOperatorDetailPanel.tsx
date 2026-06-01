import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  MOCK_INBOX_TEAM_EVENTS,
  MOCK_OPERATOR_DETAIL,
  type MockInboxRow,
  type ScoreBand,
} from '../../mocks/trainerWorkplaceMocks'
import { MockInboxEventFeed } from './MockInboxEventFeed'

export interface MockOperatorDetailPanelProps {
  operator: MockInboxRow | null
  showTabs?: boolean
  activeTab?: 'details' | 'feed'
  onTabChange?: (tab: 'details' | 'feed') => void
  eventFeedCount?: number
}

const SCORE_RING: Record<ScoreBand, string> = {
  red: 'stroke-red-500',
  amber: 'stroke-amber-400',
  green: 'stroke-emerald-500',
}

const SCORE_TEXT: Record<ScoreBand, string> = {
  red: 'text-red-500',
  amber: 'text-amber-600',
  green: 'text-emerald-600',
}

const QUEUE_CARD: Record<
  'red' | 'amber' | 'green',
  { bg: string; border: string; title: string; icon: string }
> = {
  red: {
    bg: 'bg-[#FEF2F2]',
    border: 'border-[#FEE2E2]',
    title: 'text-[#EF4444]',
    icon: 'text-[#EF4444]',
  },
  amber: {
    bg: 'bg-[#FEFCE8]',
    border: 'border-[#FEF08A]',
    title: 'text-[#A16207]',
    icon: 'text-[#CA8A04]',
  },
  green: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    title: 'text-emerald-700',
    icon: 'text-emerald-600',
  },
}

const RATING_RING: Record<'red' | 'amber' | 'green', string> = {
  red: 'stroke-[#EF4444]',
  amber: 'stroke-amber-500',
  green: 'stroke-emerald-500',
}

const RATING_TEXT: Record<'red' | 'amber' | 'green', string> = {
  red: 'text-[#EF4444]',
  amber: 'text-amber-600',
  green: 'text-emerald-600',
}

const STAT_CARD: Record<'red' | 'gray', string> = {
  red: 'border-red-100 bg-red-50',
  gray: 'bg-[#F7F7F7]',
}

const WHY_QUEUE_ICONS: Record<
  'rating' | 'plan' | 'training' | 'delay',
  (className: string) => ReactNode
> = {
  rating: (className) => <Icons.Analytics01 size={14} className={className} />,
  plan: (className) => <Icons.PieChart08 size={14} className={className} />,
  training: (className) => <Icons.Brochure size={14} className={className} />,
  delay: (className) => <Icons.Clock01 size={14} className={className} />,
}

export function MockOperatorDetailPanel({
  operator,
  showTabs = false,
  activeTab = 'details',
  onTabChange,
  eventFeedCount = MOCK_INBOX_TEAM_EVENTS.length,
}: MockOperatorDetailPanelProps) {
  const { t } = useTranslation('common')

  if (!operator) {
    return (
      <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
        {t('pages.training.inbox.detail.empty', 'Select an operator from the list')}
      </div>
    )
  }

  const detail = MOCK_OPERATOR_DETAIL
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (operator.compositeScore / 100) * circumference

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-sm">
      {showTabs ? (
        <div className="flex border-b border-[#EBECE8]">
          <button
            type="button"
            onClick={() => onTabChange?.('details')}
            className={`px-4 py-3 text-xs font-medium ${
              activeTab === 'details'
                ? 'border-b-2 border-[#204E4D] text-[#204E4D]'
                : 'text-gray-500'
            }`}
          >
            {t('pages.training.inbox.detail.tabDetails', 'Details')}
          </button>
          <button
            type="button"
            onClick={() => onTabChange?.('feed')}
            className={`px-4 py-3 text-xs font-medium ${
              activeTab === 'feed' ? 'border-b-2 border-[#204E4D] text-[#204E4D]' : 'text-gray-500'
            }`}
          >
            {t('pages.training.inbox.detail.tabFeed', 'Event Feed')} ({eventFeedCount})
          </button>
        </div>
      ) : null}

      {activeTab === 'feed' && showTabs ? (
        <div className="max-h-[min(720px,calc(100vh-280px))] overflow-y-auto">
          <MockInboxEventFeed />
        </div>
      ) : (
        <div className="flex flex-col gap-5 p-5">
          {/* Header */}
          <div className="flex gap-4 border-b border-gray-100 pb-4">
            <div className="relative flex-shrink-0">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold text-[#05040D]"
                style={{ backgroundColor: operator.avatarColor }}
              >
                {operator.initials}
              </div>
              <span
                className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white ${
                  operator.online ? 'bg-emerald-500' : 'bg-gray-400'
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-[#05040D]">{operator.name}</h2>
                <span className="text-xs text-gray-500">
                  {operator.online
                    ? t('pages.training.inbox.detail.online', 'Online')
                    : t('pages.training.inbox.detail.offline', 'Offline')}
                </span>
                <span className="rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-medium text-[#05040D]">
                  ext {operator.extension}
                </span>
                {operator.priority === 'critical' ? (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                    {t('pages.training.inbox.detail.critical', 'Critical')}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-gray-600">
                A · {operator.department} · {operator.segment} · {operator.queueEnteredLabel}
              </p>
              <p className="mt-2 text-sm text-[#05040D]">{detail.statusBannerText}</p>
            </div>
            <div className="relative h-20 w-20 flex-shrink-0">
              <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  strokeWidth="4"
                  fill="none"
                  className="stroke-[#EDEDED]"
                />
                <circle
                  cx="40"
                  cy="40"
                  r={radius}
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className={SCORE_RING[operator.scoreBand]}
                />
              </svg>
              <span
                className={`absolute inset-0 flex items-center justify-center text-2xl font-medium ${SCORE_TEXT[operator.scoreBand]}`}
              >
                {operator.compositeScore}
              </span>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {detail.statsRow.map((stat) => (
              <div
                key={stat.label}
                className={`flex flex-col gap-0.5 rounded-lg border px-3 py-3 ${STAT_CARD[stat.cardTone]}`}
              >
                <span className="text-[10px] font-medium tracking-wide text-gray-600 uppercase">
                  {stat.label}
                </span>
                <span className="text-base font-semibold text-[#05040D]">{stat.value}</span>
                {stat.subValue ? (
                  <span className="text-[11px] text-gray-600">{stat.subValue}</span>
                ) : null}
              </div>
            ))}
          </div>

          {/* Why entered + side widgets */}
          <div className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-[minmax(0,1fr)_minmax(180px,42%)]">
            <div>
              <h3 className="mb-3 text-sm font-medium tracking-[-0.02em] text-[#05040D]">
                {t('pages.training.inbox.detail.whyInQueue', 'Why entered the queue')}
              </h3>
              <div className="flex flex-col gap-2">
                {detail.whyInQueue.map((item) => {
                  const tone = QUEUE_CARD[item.tone]
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 ${tone.bg} ${tone.border}`}
                    >
                      <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-white p-2">
                        {WHY_QUEUE_ICONS[item.icon](tone.icon)}
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <p className={`text-xs leading-4 font-semibold ${tone.title}`}>
                          {item.label}
                        </p>
                        <p className="text-[11px] leading-[15px] text-[#676767]">{item.meta}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <h3 className="mb-3 text-sm font-medium tracking-[-0.02em] text-[#05040D]">
                  {t('pages.training.inbox.detail.latestRatings', 'Latest dialogue ratings')}
                </h3>
                {detail.latestDialogueRatings.map((r) => (
                  <DialogueRatingCard key={r.id} rating={r} />
                ))}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium tracking-[-0.02em] text-[#05040D]">
                  {t('pages.training.inbox.detail.nextOneOnOne', 'Next 1-on-1 session')}
                </h3>
                <div className="flex items-center gap-3 rounded-lg bg-[#F3FAF9] p-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#204E4D]">
                    <Icons.Calendar size={20} className="text-white" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-4 font-semibold text-[#05040D]">
                      {detail.nextOneOnOne.topic}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#374151]">
                      {detail.nextOneOnOne.dateLabel}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {showTabs ? (
            <div className="rounded-xl border border-[#EBECE8] bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-[10px] font-medium tracking-wide text-[#6B7280] uppercase">
                {t('pages.training.inbox.detail.trainerActionsLabel', 'Trainer actions')}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <TrainerAction
                  icon={<Icons.PlayCircle02 size={16} className="text-[#05040D]" />}
                  label="Listen in real-time"
                />
                <TrainerAction
                  icon={<Icons.Phone size={16} className="text-[#05040D]" />}
                  label="Listen to the call"
                />
                <TrainerAction
                  icon={<Icons.Brochure size={16} className="text-[#05040D]" />}
                  label="Assign course"
                />
                <TrainerAction
                  icon={<Icons.Calendar size={16} className="text-[#05040D]" />}
                  label="1-on-1 session"
                />
                <TrainerAction
                  icon={<Icons.Brochure size={16} className="text-[#05040D]" />}
                  label="Assign drill"
                />
                <TrainerAction
                  icon={<Icons.CheckmarkSquare03 size={16} className="text-[#05040D]" />}
                  label="Task checklist"
                />
                <TrainerAction
                  icon={<Icons.ChatFeedback01 size={16} className="text-[#05040D]" />}
                  label="Leave a comment"
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function DialogueRatingCard({
  rating,
}: {
  rating: (typeof MOCK_OPERATOR_DETAIL)['latestDialogueRatings'][number]
}) {
  const ringRadius = 17
  const circumference = 2 * Math.PI * ringRadius
  const progress = (rating.score / rating.scoreOutOf) * circumference
  const offset = circumference - progress

  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#F2F3F0]/50 p-3">
      <div className="relative h-10 w-10 flex-shrink-0">
        <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90">
          <circle
            cx="20"
            cy="20"
            r={ringRadius}
            strokeWidth="2"
            fill="none"
            className="stroke-[#EDEDED]"
          />
          <circle
            cx="20"
            cy="20"
            r={ringRadius}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={RATING_RING[rating.tone]}
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center text-xs font-semibold ${RATING_TEXT[rating.tone]}`}
        >
          {rating.score}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-4 font-medium text-[#05040D]">{rating.label}</p>
        {rating.meta ? (
          <p className="text-[10px] leading-[15px] text-[#6B7280]">{rating.meta}</p>
        ) : null}
      </div>
      <Icons.Mic02 size={16} className="flex-shrink-0 text-[#204E4D]" />
    </div>
  )
}

function TrainerAction({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="flex items-center gap-2.5 rounded-md border border-[#EDEDED] bg-white px-3 py-2.5 text-left hover:border-gray-300"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#F2F3F0]">
        {icon}
      </span>
      <span className="truncate text-xs leading-4 font-medium tracking-[-0.02em] text-[#05040D]">
        {label}
      </span>
    </button>
  )
}

export default MockOperatorDetailPanel
