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
  red: 'stroke-[#EF4444]',
  amber: 'stroke-amber-400',
  green: 'stroke-emerald-500',
}

const SCORE_TEXT: Record<ScoreBand, string> = {
  red: 'text-[#EF4444]',
  amber: 'text-amber-600',
  green: 'text-emerald-600',
}

const QUEUE_CARD: Record<
  'red' | 'amber' | 'green',
  { bg: string; border: string; title: string; icon: string }
> = {
  red: {
    bg: 'bg-[#FEF2F2]',
    border: 'border-[#FECACA]',
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

const WHY_QUEUE_ICONS: Record<
  'rating' | 'plan' | 'training' | 'delay',
  (className: string) => ReactNode
> = {
  rating: (className) => <Icons.Analytics01 size={14} className={className} />,
  plan: (className) => <Icons.PieChart08 size={14} className={className} />,
  training: (className) => <Icons.Brochure size={14} className={className} />,
  delay: (className) => <Icons.Clock01 size={14} className={className} />,
}

/** Figma `Details-RightView - ENG.svg` — 360×722 right sidebar */
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
      <div className="w-full max-w-[360px] rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
        {t('pages.training.inbox.detail.empty', 'Select an operator from the list')}
      </div>
    )
  }

  const detail = MOCK_OPERATOR_DETAIL
  const scoreRadius = 17
  const scoreCircumference = 2 * Math.PI * scoreRadius
  const scoreOffset = scoreCircumference - (operator.compositeScore / 100) * scoreCircumference

  return (
    <div className="flex w-full max-w-[360px] flex-col overflow-hidden rounded-xl border border-[#EBECE8] bg-white">
      {showTabs ? (
        <div className="relative flex border-b border-[#EBECE8]">
          <button
            type="button"
            onClick={() => onTabChange?.('details')}
            className={`flex-1 px-4 py-3 text-xs font-medium ${
              activeTab === 'details' ? 'text-[#204E4D]' : 'text-[#676767]'
            }`}
          >
            {t('pages.training.inbox.detail.tabDetails', 'Details')}
          </button>
          <button
            type="button"
            onClick={() => onTabChange?.('feed')}
            className={`flex-1 px-4 py-3 text-xs font-medium ${
              activeTab === 'feed' ? 'text-[#204E4D]' : 'text-[#676767]'
            }`}
          >
            {t('pages.training.inbox.detail.tabFeed', 'Event Feed')} ({eventFeedCount})
          </button>
          <span
            className={`absolute bottom-0 h-0.5 w-1/2 bg-[#80D80A] transition-transform ${
              activeTab === 'feed' ? 'translate-x-full' : 'translate-x-0'
            }`}
            aria-hidden
          />
        </div>
      ) : null}

      {activeTab === 'feed' && showTabs ? (
        <div className="max-h-[min(720px,calc(100vh-280px))] overflow-y-auto">
          <MockInboxEventFeed />
        </div>
      ) : (
        <div className="flex max-h-[min(720px,calc(100vh-280px))] flex-col overflow-y-auto">
          {/* Header — gradient per Figma paint0_linear */}
          <div className="bg-gradient-to-b from-[#F2F3F0] to-white px-4 pt-4 pb-3">
            <div className="flex gap-3">
              <div className="relative flex-shrink-0">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold text-[#05040D]"
                  style={{ backgroundColor: operator.avatarColor }}
                >
                  {operator.initials}
                </div>
                <span
                  className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    operator.online ? 'bg-[#22C55E]' : 'bg-[#A1A1A1]'
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-[#05040D]">{operator.name}</h2>
                  <span className="text-[11px] text-[#676767]">
                    {operator.online
                      ? t('pages.training.inbox.detail.online', 'Online')
                      : t('pages.training.inbox.detail.offline', 'Offline')}
                  </span>
                  <span className="rounded-full bg-[#EBECE8] px-2 py-0.5 text-[11px] font-medium text-[#05040D]">
                    ext {operator.extension}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#676767]">
                  A · {operator.department} · {operator.segment} · {operator.queueEnteredLabel}
                </p>
                {operator.priority === 'critical' ? (
                  <span className="mt-2 inline-flex rounded-full bg-[#FEF2F2] px-2.5 py-0.5 text-[11px] font-medium text-[#EF4444]">
                    {t('pages.training.inbox.detail.critical', 'Critical')}
                  </span>
                ) : null}
                <p className="mt-2 text-xs leading-4 text-[#05040D]">{detail.statusBannerText}</p>
              </div>

              <div className="relative h-12 w-12 flex-shrink-0">
                <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r={scoreRadius}
                    strokeWidth="4"
                    fill="none"
                    className="stroke-[#EDEDED]"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r={scoreRadius}
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={scoreCircumference}
                    strokeDashoffset={scoreOffset}
                    className={SCORE_RING[operator.scoreBand]}
                  />
                </svg>
                <span
                  className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${SCORE_TEXT[operator.scoreBand]}`}
                >
                  {operator.compositeScore}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 px-4 pb-4">
            {/* KPI row — 4×103×80 cards */}
            <div className="grid grid-cols-4 gap-2">
              {detail.statsRow.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`flex min-h-20 flex-col justify-center rounded-lg border px-2 py-2.5 ${
                    index === 0 || stat.cardTone === 'red'
                      ? 'border-[#FEE2E2] bg-[#FEF2F2]'
                      : 'border-[#EBECE8] bg-white'
                  }`}
                >
                  <span className="text-[10px] leading-3 font-medium tracking-wide text-[#676767] uppercase">
                    {stat.label}
                  </span>
                  <span className="mt-1 text-base leading-5 font-semibold text-[#05040D]">
                    {stat.value}
                  </span>
                  {stat.subValue ? (
                    <span className="text-[11px] leading-[15px] text-[#676767]">
                      {stat.subValue}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Why entered the queue — full-width stacked cards */}
            <div>
              <h3 className="mb-3 text-sm font-medium tracking-[-0.02em] text-[#05040D]">
                {t('pages.training.inbox.detail.whyInQueue', 'Why entered the queue')}
              </h3>
              <div className="flex flex-col gap-1.5">
                {detail.whyInQueue.map((item) => {
                  const tone = QUEUE_CARD[item.tone]
                  return (
                    <div
                      key={item.id}
                      className={`flex min-h-[53px] items-center gap-3 rounded-lg border px-3 py-2.5 ${tone.bg} ${tone.border}`}
                    >
                      <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-white">
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
              <div className="flex min-h-[64px] items-center gap-3 rounded-lg bg-[#F3FAF9] p-3">
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

            {showTabs ? (
              <div>
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
    <div className="flex min-h-[64px] items-center gap-3 rounded-lg bg-[#F2F3F0]/50 p-3">
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
