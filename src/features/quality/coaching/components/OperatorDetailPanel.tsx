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
  /** Team / group label (e.g. "Charlie"). */
  groupName?: string
  /** Segment label (Hard/Soft collection etc.). */
  segment?: string
  /** Today's accumulated work minutes (analytics screen-time). */
  todayActiveMinutes?: number | null
  /** ISO-8601 timestamp of the first activity event today. */
  todayFirstActiveAt?: string | null
  /** Daily plan progress (KAN-411 task quotas; placeholder until shipped). */
  dailyPlanPct?: number | null
  dailyPlanDone?: number | null
  dailyPlanTotal?: number | null
  /** Operator hire date (ISO yyyy-mm-dd). */
  hiredAt?: string | null
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
  /** Optional badges gallery (KAN-411 Feature 3.2). Rendered between the
   *  "Why entered the queue" block and the trainer actions when supplied. */
  badgesSlot?: ReactNode
  /** Trainer action handlers — Figma shows 8 actions in a 2-col grid. */
  onListenRealtime?: () => void
  onListen?: () => void
  onRate?: () => void
  onAssignCourse?: () => void
  onAssignDrill?: () => void
  onPlanOneOnOne?: () => void
  onLeaveComment?: () => void
  onAssignTask?: () => void
  /** Legacy "Take charge" handler — retained for the Team-tab side panel. */
  onTakeCharge?: () => void
}

const SCORE_RING: Record<ScoreBand, string> = {
  red: 'stroke-error-500',
  amber: 'stroke-amber-400',
  green: 'stroke-emerald-500',
}

const SCORE_TEXT: Record<ScoreBand, string> = {
  red: 'text-error-600',
  amber: 'text-amber-600',
  green: 'text-emerald-600',
}

const QUEUE_CARD: Record<
  'red' | 'amber' | 'green',
  { bg: string; border: string; title: string; icon: string }
> = {
  red: {
    bg: 'bg-error-50',
    border: 'border-error-200',
    title: 'text-error-700',
    icon: 'text-error-600',
  },
  amber: {
    bg: 'bg-warning-50',
    border: 'border-warning-200',
    title: 'text-warning-700',
    icon: 'text-warning-600',
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

function categorizeTrigger(code: string): {
  tone: 'red' | 'amber' | 'green'
  icon: 'rating' | 'plan' | 'training' | 'delay'
} {
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

function formatTodayActive(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m} min`
  return `${h}h ${String(m).padStart(2, '0')}min`
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function formatHireDate(iso: string | null | undefined): { year: string; date: string } {
  if (!iso) return { year: '—', date: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { year: '—', date: '' }
  return { year: String(d.getFullYear()), date: d.toLocaleDateString() }
}

export function OperatorDetailPanel({
  operatorId,
  operatorName,
  avatarColor = '#FED7AA',
  initials,
  online = false,
  extension,
  department,
  groupName,
  segment,
  todayActiveMinutes,
  todayFirstActiveAt,
  dailyPlanPct,
  dailyPlanDone,
  dailyPlanTotal,
  hiredAt,
  period = 'last_7d',
  fromDate,
  toDate,
  showTabs = false,
  activeTab = 'details',
  onTabChange,
  eventFeedCount = 0,
  feedSlot,
  badgesSlot,
  onListenRealtime,
  onListen,
  onRate,
  onAssignCourse,
  onAssignDrill,
  onPlanOneOnOne,
  onLeaveComment,
  onAssignTask,
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
      <div className="border-border bg-card text-muted-foreground w-full max-w-[360px] rounded-xl border p-6 text-center text-xs">
        {t('pages.training.inbox.detail.empty', 'Select an operator from the list')}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="border-border bg-card text-muted-foreground w-full max-w-[360px] rounded-xl border p-6 text-center text-xs">
        {t('pages.training.inbox.detail.loading', 'Loading…')}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="border-border bg-card text-error-600 w-full max-w-[360px] rounded-xl border p-6 text-center text-xs">
        {t('pages.training.inbox.detail.error', 'Could not load operator details.')}
      </div>
    )
  }

  const displayName = operatorName ?? `#${data.operator_id}`
  // Score and band are nullable for operators with no source signal
  // (see queue_service no-data fix). Render `—` with a neutral ring when
  // either is missing so the panel doesn't lie or render with broken UI.
  const score = data.composite_score
  const band: ScoreBand = data.score_band ?? 'amber'
  const hasScore = score !== null && score !== undefined
  const scoreRadius = 17
  const scoreCircumference = 2 * Math.PI * scoreRadius
  const scoreOffset = hasScore
    ? scoreCircumference - (score / 100) * scoreCircumference
    : scoreCircumference

  // Figma `Details-RightView` stats row: DAILY PLAN / ONLINE / EXPERIENCE.
  // - Daily plan: red-tinted when behind; placeholder until KAN-411 ships
  //   the task-quota endpoint.
  // - Online: today's accumulated work-time + clock-in label, derived from
  //   analytics-service screen-time (todayActiveMinutes prop).
  // - Experience: operator hire year + full date (from users.hired_at).
  // Prefer parent-passed props (already-cached values from the row
  // adapter), fall back to whatever the BE detail payload included.
  const effectiveGroupName = groupName ?? data.group_name ?? undefined
  const effectiveExtension = extension ?? data.asterisk_extension ?? undefined
  const effectiveHiredAt = hiredAt ?? data.hired_at ?? null
  const effectiveTodayMinutes = todayActiveMinutes ?? data.today_active_minutes ?? null
  const effectiveTodayFirstAt = todayFirstActiveAt ?? data.today_first_active_at ?? null
  const planHasData = dailyPlanPct != null && dailyPlanTotal != null && dailyPlanTotal > 0
  const planBehind = planHasData && (dailyPlanPct ?? 0) < 50
  const hire = formatHireDate(effectiveHiredAt)
  const statsRow: { label: string; value: string; subValue?: string; cardTone: 'red' | 'gray' }[] =
    [
      {
        label: t('pages.training.inbox.detail.stats.dailyPlan', 'Daily plan'),
        value: planHasData ? `${Math.round(dailyPlanPct ?? 0)}%` : '—',
        subValue:
          planHasData && dailyPlanDone != null ? `${dailyPlanDone}/${dailyPlanTotal}` : undefined,
        cardTone: planBehind ? 'red' : 'gray',
      },
      {
        label: t('pages.training.inbox.detail.stats.online', 'Online'),
        value: formatTodayActive(effectiveTodayMinutes),
        subValue: effectiveTodayFirstAt
          ? t('pages.training.inbox.detail.stats.onlineFrom', 'from {{time}}', {
              time: formatClock(effectiveTodayFirstAt),
            })
          : undefined,
        cardTone: 'gray',
      },
      {
        label: t('pages.training.inbox.detail.stats.experience', 'Experience'),
        value: hire.year,
        subValue: hire.date || undefined,
        cardTone: 'gray',
      },
    ]

  // Per-trigger meta line — derived from the operator's KPIs so each
  // trigger card has context under its title (Figma: "38 points · call
  // #C-1016", "14% at 11:00 · 4th day in a row", etc.). When a specific
  // call/score isn't available, fall back to the latest scorecard or the
  // raw KPI value so the line is never empty for known triggers.
  // Alias `data` into a non-null const so TS preserves narrowing across
  // the closure boundary below (across an arrow function TS would widen
  // `data` back to the hook's union type and require null checks).
  const detail = data
  const latestScorecard = detail.latest_scorecards?.[0]
  const triggerMeta = (code: string): string => {
    const c = code.toLowerCase()
    if (c.includes('rating') || c.includes('scorecard') || c.includes('conflict')) {
      if (latestScorecard?.weighted_score != null && latestScorecard.call_id) {
        return `${Math.round(Number(latestScorecard.weighted_score))} pts · call #${latestScorecard.call_id.slice(0, 6)}`
      }
      if (detail.kpis.avg_scorecard_pct != null) {
        return `Avg ${Math.round(detail.kpis.avg_scorecard_pct)}%`
      }
      return ''
    }
    if (c.includes('plan') || c.includes('daily')) {
      if (dailyPlanPct != null && dailyPlanTotal != null) {
        return `${Math.round(dailyPlanPct)}% — ${dailyPlanDone ?? 0}/${dailyPlanTotal}`
      }
      return ''
    }
    if (c.includes('training') || c.includes('course') || c.includes('drill')) {
      return data.open_tasks_count > 0 ? `${data.open_tasks_count} open` : ''
    }
    if (c.includes('delay') || c.includes('idle') || c.includes('no_calls')) {
      return effectiveTodayMinutes != null
        ? `${formatTodayActive(effectiveTodayMinutes)} today`
        : ''
    }
    return ''
  }

  const whyInQueue = data.triggers.map((code, idx) => {
    const meta = categorizeTrigger(code)
    return {
      id: idx + 1,
      label: humanizeTrigger(code),
      meta: triggerMeta(code),
      tone: meta.tone,
      icon: meta.icon,
    }
  })

  const computedInitials = initials ?? initialsFor(displayName)

  return (
    <div className="border-border bg-card flex w-full max-w-[360px] flex-col overflow-hidden rounded-xl border">
      {showTabs ? (
        <div className="border-border relative flex border-b">
          <button
            type="button"
            onClick={() => onTabChange?.('details')}
            className={`flex flex-1 items-center gap-2 px-4 py-3 text-xs font-medium ${
              activeTab === 'details' ? 'text-secondary' : 'text-muted-foreground'
            }`}
          >
            <Icons.UserStatus
              size={16}
              className={activeTab === 'details' ? 'text-secondary' : ''}
            />
            {t('pages.training.inbox.detail.tabDetails', 'Details')}
          </button>
          <button
            type="button"
            onClick={() => onTabChange?.('feed')}
            className={`flex flex-1 items-center justify-between gap-2 px-4 py-3 text-xs font-medium ${
              activeTab === 'feed' ? 'text-secondary' : 'text-muted-foreground'
            }`}
          >
            <span className="flex items-center gap-2">
              <Icons.Activity01
                size={16}
                className={activeTab === 'feed' ? 'text-secondary' : ''}
              />
              {t('pages.training.inbox.detail.tabFeed', 'Event Feed')}
            </span>
            <span className="bg-muted text-foreground rounded-full px-2 py-0.5 text-[11px] font-medium">
              {eventFeedCount}
            </span>
          </button>
          <span
            className={`bg-primary-500 absolute bottom-0 h-0.5 w-1/2 transition-transform ${
              activeTab === 'feed' ? 'translate-x-full' : 'translate-x-0'
            }`}
            aria-hidden
          />
        </div>
      ) : null}

      {activeTab === 'feed' && showTabs ? (
        <div className="max-h-[min(720px,calc(100vh-280px))] overflow-y-auto">
          {feedSlot ?? (
            <p className="text-muted-foreground px-4 py-8 text-center text-xs">
              {t(
                'pages.training.inbox.detail.feedComingSoon',
                'Team event feed lands with the next round.'
              )}
            </p>
          )}
        </div>
      ) : (
        <div className="flex max-h-[min(720px,calc(100vh-280px))] flex-col overflow-y-auto">
          <div className="from-background to-card bg-gradient-to-b px-4 pt-4 pb-3">
            <div className="flex gap-3">
              <div className="relative flex-shrink-0">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold"
                  style={{ backgroundColor: avatarColor, color: '#05040D' }}
                >
                  {computedInitials}
                </div>
                <span
                  className={`border-card absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 ${
                    online ? 'bg-success-500' : 'bg-muted-foreground'
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <h2 className="text-foreground text-sm font-semibold">{displayName}</h2>
                <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-4">
                  {[department, segment, effectiveGroupName]
                    .filter((v): v is string => Boolean(v))
                    .map((seg, idx, arr) => (
                      <span key={`seg-${idx}`}>
                        {seg}
                        {idx < arr.length - 1 ? <span className="ml-1.5">·</span> : null}
                      </span>
                    ))}
                  {effectiveExtension ? (
                    <>
                      <span className="mx-1">·</span>
                      <span className="bg-muted text-foreground rounded-full px-2 py-0.5 text-[10px] font-medium">
                        ext {effectiveExtension}
                      </span>
                    </>
                  ) : null}
                  <span className="mx-1">·</span>
                  <span>
                    {online
                      ? t('pages.training.inbox.detail.online', 'Online')
                      : t('pages.training.inbox.detail.offline', 'Offline')}
                  </span>
                  {effectiveTodayMinutes != null && effectiveTodayMinutes > 0 ? (
                    <>
                      <span className="mx-1">·</span>
                      <span>{formatTodayActive(effectiveTodayMinutes)}</span>
                    </>
                  ) : null}
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
                    className="stroke-border"
                  />
                  {hasScore ? (
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
                  ) : null}
                </svg>
                <span
                  className={`absolute inset-0 flex items-center justify-center text-sm font-semibold ${
                    hasScore ? SCORE_TEXT[band] : 'text-muted-foreground'
                  }`}
                >
                  {hasScore ? score : '—'}
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
                      ? 'border-error-100 bg-error-50'
                      : 'border-border bg-card'
                  }`}
                >
                  <span className="text-muted-foreground text-[10px] leading-3 font-medium tracking-wide uppercase">
                    {stat.label}
                  </span>
                  <span className="text-foreground mt-1 text-base leading-5 font-semibold">
                    {stat.value}
                  </span>
                  {stat.subValue ? (
                    <span className="text-muted-foreground text-[11px] leading-[15px]">
                      {stat.subValue}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <div>
              <div className="flex flex-row justify-between">
                <span className="text-foreground mb-3 text-sm font-medium tracking-[-0.02em]">
                  {t('pages.training.inbox.detail.whyInQueue', 'Why entered the queue')}
                </span>
                {band === 'red' ? (
                  <span className="bg-error-50 text-error-700 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                    {t('pages.training.inbox.detail.critical', 'Critical')}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                {whyInQueue.length === 0 ? (
                  <p className="text-muted-foreground text-[11px]">
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
                        <span className="bg-card flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full">
                          {WHY_QUEUE_ICONS[item.icon](tone.icon)}
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <p className={`text-xs leading-4 font-semibold ${tone.title}`}>
                            {item.label}
                          </p>
                          {item.meta ? (
                            <p className="text-muted-foreground text-[11px] leading-[15px]">
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

            {badgesSlot ? <div>{badgesSlot}</div> : null}

            <div>
              <h3 className="text-foreground mb-3 text-sm font-medium tracking-[-0.02em]">
                {t('pages.training.inbox.detail.trainerActionsLabel', 'Trainer actions')}
              </h3>
              {/* Figma — 8 actions in a 2-col grid. Buttons without a
                  handler render disabled (60% opacity) so trainers see
                  what's coming without functional surprises. The legacy
                  `onTakeCharge` prop still wires the Team-tab "Take
                  charge" flow when the trainer opens the panel from the
                  Team tab. */}
              <div className="grid grid-cols-2 gap-1.5">
                <TrainerAction
                  icon={<Icons.Mic02 size={16} className="text-foreground" />}
                  label={t(
                    'pages.training.inbox.detail.actions.listenRealtime',
                    'Listen in real-time'
                  )}
                  onClick={onListenRealtime}
                />
                <TrainerAction
                  icon={<Icons.Phone size={16} className="text-foreground" />}
                  label={t('pages.training.inbox.detail.actions.listen', 'Listen to the call')}
                  onClick={onListen}
                />
                <TrainerAction
                  icon={<Icons.ChartRing size={16} className="text-foreground" />}
                  label={t('pages.training.inbox.detail.actions.rate', 'Rate')}
                  onClick={onRate}
                />
                <TrainerAction
                  icon={<Icons.Brochure size={16} className="text-foreground" />}
                  label={t('pages.training.inbox.detail.actions.assignCourse', 'Assign course')}
                  onClick={onAssignCourse}
                />
                <TrainerAction
                  icon={<Icons.PieChart02 size={16} className="text-foreground" />}
                  label={t('pages.training.inbox.detail.actions.assignDrill', 'Assign drill')}
                  onClick={onAssignDrill}
                />
                <TrainerAction
                  icon={<Icons.Calendar size={16} className="text-foreground" />}
                  label={t('pages.training.inbox.detail.actions.planOneOnOne', '1-on-1 session')}
                  onClick={onPlanOneOnOne}
                />
                <TrainerAction
                  icon={<Icons.ChatFeedback01 size={16} className="text-foreground" />}
                  label={t('pages.training.inbox.detail.actions.leaveComment', 'Leave a comment')}
                  onClick={onLeaveComment}
                />
                <TrainerAction
                  icon={<Icons.CheckmarkSquare03 size={16} className="text-foreground" />}
                  label={t('pages.training.inbox.detail.actions.task', 'Task / checklist')}
                  onClick={onAssignTask}
                />
              </div>
              {onTakeCharge ? (
                <button
                  type="button"
                  onClick={onTakeCharge}
                  className="border-secondary bg-secondary text-secondary-foreground mt-2 flex h-[34.5px] w-full items-center justify-center gap-1 rounded-md border text-xs font-medium tracking-[-0.02em]"
                >
                  {t('pages.training.inbox.detail.actions.takeCharge', 'Take charge')}
                </button>
              ) : null}
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
      className="border-border bg-card flex h-[34.5px] items-center gap-1 rounded-md border px-3 text-left disabled:opacity-60"
    >
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">{icon}</span>
      <span className="text-foreground truncate text-xs leading-4 font-medium tracking-[-0.02em]">
        {label}
      </span>
    </button>
  )
}

export default OperatorDetailPanel
