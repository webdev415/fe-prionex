import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useOperatorCoachingDetail } from '../hooks'
import type { CoachingPeriod, ScoreBand } from '../types'

/**
 * Right-side operator detail panel (KAN-413 §3.5, §1.8). Shared by:
 *   - KAN-413 Inbox (all three view modes)
 *   - KAN-414 Team tab (clicking a team operator card)
 *
 * Visual layout mirrors Figma `Details-RightView - ENG.svg` (promoted from
 * `MockOperatorDetailPanel`). KPIs that the BE doesn't yet surface
 * (daily plan, online duration, internship date) render as `—` placeholders
 * so the card stays the right shape; the "Why entered the queue" list is
 * derived from `OperatorDetail.triggers` returned by the coaching detail
 * endpoint.
 */
export interface OperatorDetailPanelProps {
  operatorId: number | undefined
  operatorName?: string | undefined
  /** Optional avatar tint passed in from the inbox row adapter. */
  avatarColor?: string
  initials?: string
  online?: boolean
  /** Trainer extension if known (operator's asterisk extension). */
  extension?: string
  /** Department label shown in the header chrome. */
  department?: string
  /** Segment label (Hard/Soft collection etc.). */
  segment?: string
  /** "Queue entered" label like "2h ago" derived from `assignment.updated_at`. */
  queueEnteredLabel?: string
  period?: CoachingPeriod
  fromDate?: string
  toDate?: string
  showTabs?: boolean
  activeTab?: 'details' | 'feed'
  onTabChange?: (tab: 'details' | 'feed') => void
  eventFeedCount?: number
  /** Render slot for the team event feed shown when `activeTab === 'feed'`.
   *  Kept as a slot so the coaching feature module stays decoupled from the
   *  page-layer mock data that still backs the feed. */
  feedSlot?: ReactNode
  onListen?: () => void
  onAssignTask?: () => void
  onPlanOneOnOne?: () => void
  onTakeCharge?: () => void
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

const WHY_QUEUE_ICONS: Record<
  'rating' | 'plan' | 'training' | 'delay',
  (className: string) => ReactNode
> = {
  rating: (className) => <Icons.Analytics01 size={14} className={className} />,
  plan: (className) => <Icons.PieChart08 size={14} className={className} />,
  training: (className) => <Icons.Brochure size={14} className={className} />,
  delay: (className) => <Icons.Clock01 size={14} className={className} />,
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function categorizeTrigger(
  code: string
): { tone: 'red' | 'amber' | 'green'; icon: 'rating' | 'plan' | 'training' | 'delay' } {
  const c = code.toLowerCase()
  if (c.includes('rating') || c.includes('scorecard') || c.includes('conflict')) {
    return { tone: 'red', icon: 'rating' }
  }
  if (c.includes('plan') || c.includes('daily')) return { tone: 'amber', icon: 'plan' }
  if (c.includes('training') || c.includes('course') || c.includes('drill')) {
    return { tone: 'red', icon: 'training' }
  }
  if (c.includes('delay') || c.includes('idle') || c.includes('no_calls')) {
    return { tone: 'amber', icon: 'delay' }
  }
  return { tone: 'amber', icon: 'rating' }
}

function humanizeTrigger(code: string): string {
  return code
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim()
}

export function OperatorDetailPanel({
  operatorId,
  operatorName,
  avatarColor = '#FED7AA',
  initials,
  online = false,
  extension,
  department,
  segment,
  queueEnteredLabel,
  period = 'last_7d',
  fromDate,
  toDate,
  showTabs = false,
  activeTab = 'details',
  onTabChange,
  eventFeedCount = 0,
  feedSlot,
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
      <div className="w-full max-w-[360px] rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
        {t('pages.training.inbox.detail.empty', 'Select an operator from the list')}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-[360px] rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
        {t('pages.training.inbox.detail.loading', 'Loading…')}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="w-full max-w-[360px] rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-red-500">
        {t('pages.training.inbox.detail.error', 'Could not load operator details.')}
      </div>
    )
  }

  const displayName = operatorName ?? `#${data.operator_id}`
  const score = data.composite_score
  const band = data.score_band
  const scoreRadius = 17
  const scoreCircumference = 2 * Math.PI * scoreRadius
  const scoreOffset = scoreCircumference - (score / 100) * scoreCircumference

  const statsRow: { label: string; value: string; subValue?: string; cardTone: 'red' | 'gray' }[] =
    [
      {
        label: t('pages.training.inbox.detail.stats.scorecard', 'Avg scorecard'),
        value:
          data.kpis.avg_scorecard_pct != null
            ? `${Math.round(data.kpis.avg_scorecard_pct)}%`
            : '—',
        cardTone: band === 'red' ? 'red' : 'gray',
      },
      {
        label: t('pages.training.inbox.detail.stats.scriptAdherence', 'Script adherence'),
        value:
          data.kpis.script_adherence_pct != null
            ? `${Math.round(data.kpis.script_adherence_pct)}%`
            : '—',
        cardTone: 'gray',
      },
      {
        label: t('pages.training.inbox.detail.stats.openTasks', 'Open tasks'),
        value: String(data.open_tasks_count),
        subValue:
          data.active_markers_count > 0
            ? t('pages.training.inbox.detail.stats.markers', '{{count}} markers', {
                count: data.active_markers_count,
              })
            : undefined,
        cardTone: data.kpis.red_flag_count > 0 ? 'red' : 'gray',
      },
    ]

  const whyInQueue = data.triggers.map((code, idx) => {
    const meta = categorizeTrigger(code)
    return {
      id: idx + 1,
      label: humanizeTrigger(code),
      meta: '',
      tone: meta.tone,
      icon: meta.icon,
    }
  })

  const computedInitials = initials ?? initialsFor(displayName)

  return (
    <div className="flex w-full max-w-[360px] flex-col overflow-hidden rounded-xl border border-[#EBECE8] bg-white">
      {showTabs ? (
        <div className="relative flex border-b border-[#EBECE8]">
          <button
            type="button"
            onClick={() => onTabChange?.('details')}
            className={`flex flex-1 items-center gap-2 px-4 py-3 text-xs font-medium ${
              activeTab === 'details' ? 'text-[#204E4D]' : 'text-[#676767]'
            }`}
          >
            <Icons.UserStatus
              size={16}
              className={activeTab === 'details' ? 'text-[#204E4D]' : ''}
            />
            {t('pages.training.inbox.detail.tabDetails', 'Details')}
          </button>
          <button
            type="button"
            onClick={() => onTabChange?.('feed')}
            className={`flex flex-1 items-center justify-between gap-2 px-4 py-3 text-xs font-medium ${
              activeTab === 'feed' ? 'text-[#204E4D]' : 'text-[#676767]'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icons.Activity01
                size={16}
                className={activeTab === 'feed' ? 'text-[#204E4D]' : ''}
              />
              {t('pages.training.inbox.detail.tabFeed', 'Event Feed')}
            </span>
            <span className="rounded-full bg-[#EBECE8] px-2 py-0.5 text-[11px] font-medium text-[#05040D]">
              {eventFeedCount}
            </span>
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
          {feedSlot ?? (
            <p className="px-4 py-8 text-center text-xs text-gray-500">
              {t(
                'pages.training.inbox.detail.feedComingSoon',
                'Team event feed lands with the next round.'
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="flex max-h-[min(720px,calc(100vh-280px))] flex-col overflow-y-auto">
          <div className="bg-gradient-to-b from-[#F2F3F0] to-white px-4 pt-4 pb-3">
            <div className="flex gap-3">
              <div className="relative flex-shrink-0">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold text-[#05040D]"
                  style={{ backgroundColor: avatarColor }}
                >
                  {computedInitials}
                </div>
                <span
                  className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    online ? 'bg-[#22C55E]' : 'bg-[#A1A1A1]'
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="text-sm font-semibold text-[#05040D]">{displayName}</h2>
                  <span className="text-[11px] text-[#676767]">
                    {online
                      ? t('pages.training.inbox.detail.online', 'Online')
                      : t('pages.training.inbox.detail.offline', 'Offline')}
                  </span>
                  {extension ? (
                    <span className="rounded-full bg-[#EBECE8] px-2 py-0.5 text-[11px] font-medium text-[#05040D]">
                      ext {extension}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#676767]">
                  {[department, segment, queueEnteredLabel].filter(Boolean).join(' · ')}
                </p>
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
                    className={SCORE_RING[band]}
                  />
                </svg>
                <span
                  className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${SCORE_TEXT[band]}`}
                >
                  {score}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              {statsRow.map((stat, index) => (
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

            <div>
              <div className="flex flex-row justify-between">
                <span className="mb-3 text-sm font-medium tracking-[-0.02em] text-[#05040D]">
                  {t('pages.training.inbox.detail.whyInQueue', 'Why entered the queue')}
                </span>
                {band === 'red' ? (
                  <span className="inline-flex rounded-full bg-[#FEF2F2] px-2.5 py-0.5 text-[11px] font-medium text-[#EF4444]">
                    {t('pages.training.inbox.detail.critical', 'Critical')}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                {whyInQueue.length === 0 ? (
                  <p className="text-[11px] text-[#676767]">
                    {t(
                      'pages.training.inbox.detail.noTriggers',
                      'No triggers fired in the current window.'
                    )}
                  </p>
                ) : (
                  whyInQueue.map((item) => {
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
                          {item.meta ? (
                            <p className="text-[11px] leading-[15px] text-[#676767]">
                              {item.meta}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-medium tracking-[-0.02em] text-[#05040D]">
                {t('pages.training.inbox.detail.trainerActionsLabel', 'Trainer actions')}
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                <TrainerAction
                  icon={<Icons.Phone size={16} className="text-[#05040D]" />}
                  label={t('pages.training.inbox.detail.actions.listen', 'Listen to the call')}
                  onClick={onListen}
                />
                <TrainerAction
                  icon={<Icons.CheckmarkSquare03 size={16} className="text-[#05040D]" />}
                  label={t('pages.training.inbox.detail.actions.assignTask', 'Assign task')}
                  onClick={onAssignTask}
                />
                <TrainerAction
                  icon={<Icons.Calendar size={16} className="text-[#05040D]" />}
                  label={t('pages.training.inbox.detail.actions.planOneOnOne', '1-on-1 session')}
                  onClick={onPlanOneOnOne}
                />
                <TrainerAction
                  icon={<Icons.UserStatus size={16} className="text-[#05040D]" />}
                  label={t('pages.training.inbox.detail.actions.takeCharge', 'Take charge')}
                  onClick={onTakeCharge}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TrainerAction({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex h-[34.5px] items-center gap-1 rounded-md border border-[#DFDFDF] bg-white px-3 text-left disabled:opacity-60"
    >
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">{icon}</span>
      <span className="truncate text-xs leading-4 font-medium tracking-[-0.02em] text-[#05040D]">
        {label}
      </span>
    </button>
  )
}

export default OperatorDetailPanel
