/**
 * NotificationBell
 *
 * Unified notification bell that replaces TaskBell.
 * Shows: overdue tasks, pending payments, incoming calls, tag events.
 *
 * - Inactive (grey) when no notifications
 * - Active (with badge) when notifications exist
 * - Shakes when new notifications arrive
 * - Click opens a dropdown list with type-specific rendering
 */

import { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { safeHttpUrl } from '@/lib/safeUrl'
import { useAuthStore } from '@/stores/authStore'
import { formatTaskDueDateForDisplay } from '@/lib/formatters'
import { cn } from '@/lib/utils'

import {
  useMarkAsRead,
  useNotifications,
  useUnreadCount,
  useDismissNotification,
  useMarkAllAsRead,
  useStarNotification,
  useUnstarNotification,
  useUpdateTaskFromBell,
} from '@/features/notifications/hooks/useNotifications'
import { useNotificationSocket } from '@/features/notifications/hooks/useNotificationSocket'
import { NotificationType } from '@/features/notifications/types'
import type { NotificationItem } from '@/features/notifications/types'

function getIntlLocale(language: string): string {
  const base = language.split('-')[0] ?? 'en'
  if (base === 'uk') return 'uk-UA'
  return 'en-GB'
}

function translatePaymentMethod(method: string | undefined, t: TFunction): string {
  if (!method) return ''
  const key = `notificationBell.paymentMethod.${method.toLowerCase()}`
  return t(key, { defaultValue: method })
}

function formatDateTime(isoDate: string, timezone: string | undefined, language: string): string {
  try {
    // Convention: DB stores UTC. Naive strings (no Z/offset) are interpreted
    // as UTC; we display in the user's profile timezone.
    let dateStr = isoDate.replace(' ', 'T')
    if (!dateStr.endsWith('Z') && !/[-+]\d{2}:\d{2}$/.test(dateStr)) {
      dateStr += 'Z'
    }
    const tz = timezone ?? 'UTC'
    const intlLocale = getIntlLocale(language)
    const parts = new Intl.DateTimeFormat(intlLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: tz,
    }).formatToParts(new Date(dateStr))
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
    return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}`
  } catch {
    return isoDate
  }
}

function formatRelativeTime(isoDate: string, t: TFunction): string {
  try {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return t('notificationBell.relative.justNow')
    if (diffMin < 60) return t('notificationBell.relative.minutesAgo', { count: diffMin })
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return t('notificationBell.relative.hoursAgo', { count: diffHr })
    const diffDays = Math.floor(diffHr / 24)
    return t('notificationBell.relative.daysAgo', { count: diffDays })
  } catch {
    return isoDate
  }
}

// Tab structure for the bell dropdown. Order matters: this is the
// rendered order in the horizontal tab strip. Extending the system to
// support new notification types in the future = add a new tab key
// here + a new render branch in the tab-content panel. Types with no
// dedicated tab fall into the generic "other" tab automatically, so a
// new backend type can never silently disappear from the bell again
// (Tanya's 13.08 complaint: unseen types inflated the badge, then
// "mark all read" erased every trace of them).
const TABS = [
  'tasks',
  'starred',
  'training',
  'payments',
  'calls',
  'rrPayments',
  'ubki',
  'other',
  'read',
] as const
type Tab = (typeof TABS)[number]

// ─── Type routing ────────────────────────────────────────────────

const TASK_TAB_TYPES: string[] = [
  NotificationType.TASK_OVERDUE,
  NotificationType.CORRECTION_TASK_OVERDUE,
]

const NON_TASK_TAB_TYPES: string[] = [
  NotificationType.PAYMENT_PENDING,
  NotificationType.INCOMING_CALL,
  NotificationType.CALLBACK_REQUESTED,
  NotificationType.RR_PAYMENT_DUE,
  NotificationType.UBKI_FAILURE_ALERT,
  NotificationType.UBKI_CONNECTION_DOWN,
  NotificationType.UBKI_DAILY_SUMMARY,
]

// Trainer/operator coaching & training assignments — the "Навчання" tab.
// The 30-min 1-on-1 reminder lives here too (same card as the scheduled
// event, "1-на-1 скоро" label) — not in "Інше" as a generic row.
const TRAINING_TAB_TYPES: string[] = [
  NotificationType.ONE_ON_ONE_SCHEDULED,
  NotificationType.ONE_ON_ONE_REMINDER,
  NotificationType.COURSE_ASSIGNED,
  NotificationType.ASSIGNMENT_TAKEN,
  NotificationType.CORRECTION_TASK_ASSIGNED,
  NotificationType.DRILL_ASSIGNED,
  // Group trainings (KAN-752) — same card as the 1-on-1 events: the
  // assignment fan-out and the 30-min-before reminder.
  NotificationType.TRAINING_SCHEDULED,
  NotificationType.TRAINING_REMINDER,
]

// System-noise types: never rendered and excluded from the badge.
// ta_chain_created fires on every logged chain (11.5K unread rows for a
// single trainer on prod) — pure feed noise with no per-item action.
const HIDDEN_TYPES: ReadonlySet<string> = new Set([NotificationType.TA_CHAIN_CREATED])

// Known types with no dedicated tab — fetched for and rendered
// generically in the "other" tab.
const KNOWN_MISC_TYPES: string[] = [
  NotificationType.TAG_ASSIGNED,
  NotificationType.TAG_REMOVED,
  NotificationType.TAG_EXPIRED,
  NotificationType.CORRECTION_TASK_COMPLETED,
  NotificationType.CORRECTION_TASK_RETURNED,
  NotificationType.FEEDBACK_RECEIVED,
  NotificationType.FEEDBACK_REPLIED,
  NotificationType.SCORECARD_SENT,
  NotificationType.SCORE_DROP_DETECTED,
  NotificationType.SCORE_GROWTH_DETECTED,
  NotificationType.LEGAL_TASK_DUE_TOMORROW,
  NotificationType.LEGAL_TASK_DUE_TODAY,
  NotificationType.DRILL_COMPLETED,
  NotificationType.DRILL_CONFIRMED,
  NotificationType.DRILL_RETURNED,
  NotificationType.DRILL_OVERDUE,
  // Post-session nudge to the trainer; the backend ships a ready-to-read
  // title/body, so the generic card is enough.
  NotificationType.ONE_ON_ONE_FEEDBACK_DUE,
]

// Read-history window for the "Прочитані" tab.
const READ_HISTORY_DAYS = 30

// ─── Session cache of unknown types ever seen unread ─────────────
// /unread/count's by_type only reports UNREAD types, so the moment an
// unknown type is marked read (e.g. «Позначити як прочитані») it
// vanishes from by_type — and without this cache it would drop out of
// the misc/read fetches, hiding its trail all over again. Module-level
// so it survives bell remounts within the session. Known trade-off: in
// a NEW session an unknown type that is already fully read is not
// discoverable (the backend has no "distinct read types" endpoint), so
// its history resurfaces only once the type shows up unread again.
const seenUnknownTypesStore = {
  types: [] as string[],
  listeners: new Set<() => void>(),
  add(freshTypes: string[]) {
    const added = freshTypes.filter((notifType) => !this.types.includes(notifType))
    if (added.length === 0) return
    this.types = [...this.types, ...added]
    this.listeners.forEach((listener) => listener())
  },
  subscribe: (listener: () => void) => {
    seenUnknownTypesStore.listeners.add(listener)
    return () => seenUnknownTypesStore.listeners.delete(listener)
  },
  getSnapshot: () => seenUnknownTypesStore.types,
}

function useSeenUnknownTypes(unknownUnreadKey: string): string[] {
  useEffect(() => {
    if (unknownUnreadKey !== '') {
      seenUnknownTypesStore.add(unknownUnreadKey.split(','))
    }
  }, [unknownUnreadKey])
  return useSyncExternalStore(seenUnknownTypesStore.subscribe, seenUnknownTypesStore.getSnapshot)
}

function EmptyState({ label }: { t: TFunction; label: string }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 px-4 py-8">
      <Icons.Bell size={28} strokeWidth={1.5} />
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  )
}

function NotificationTabStrip({
  activeTab,
  onTabChange,
  tabCounts,
  t,
}: {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  tabCounts: Record<Tab, number>
  t: TFunction
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 1)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    updateScrollState()
    const frame = requestAnimationFrame(updateScrollState)
    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)
    el.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      el.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [updateScrollState, t])

  useEffect(() => {
    const activeEl = tabRefs.current[activeTab]
    if (!activeEl) return
    activeEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
    const timer = window.setTimeout(updateScrollState, 320)
    return () => window.clearTimeout(timer)
  }, [activeTab, updateScrollState])

  const scrollTabs = (direction: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * Math.max(120, el.clientWidth * 0.55), behavior: 'smooth' })
  }

  return (
    <div className="border-border relative flex items-stretch border-b">
      <button
        type="button"
        aria-label={t('notificationBell.tabsScrollLeft', 'Scroll tabs left')}
        onClick={() => scrollTabs(-1)}
        disabled={!canScrollLeft}
        className={cn(
          'from-card text-muted-foreground hover:text-foreground absolute top-0 bottom-0 left-0 z-10 flex w-8 items-center justify-start bg-gradient-to-r from-60% to-transparent pl-1.5 transition-all duration-200',
          canScrollLeft
            ? 'pointer-events-auto translate-x-0 opacity-100'
            : 'pointer-events-none -translate-x-1 opacity-0'
        )}
      >
        <Icons.ArrowLeft size={14} strokeWidth={2} />
      </button>

      <div
        ref={scrollerRef}
        className={cn(
          'flex w-full overflow-x-auto scroll-smooth text-xs',
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          canScrollLeft && 'pl-6',
          canScrollRight && 'pr-6'
        )}
      >
        {TABS.map((tab) => {
          const count = tabCounts[tab]
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              ref={(node) => {
                tabRefs.current[tab] = node
              }}
              type="button"
              onClick={() => onTabChange(tab)}
              className={cn(
                'flex-shrink-0 border-b-2 px-3 py-2 font-medium whitespace-nowrap transition-colors duration-200',
                isActive
                  ? 'border-primary-500 text-primary-600'
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              )}
            >
              {t(`notificationBell.tabs.${tab}`)}
              {count > 0 && (
                <span
                  className={cn(
                    'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors duration-200',
                    isActive ? 'bg-primary-100 text-primary-700' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        aria-label={t('notificationBell.tabsScrollRight', 'Scroll tabs right')}
        onClick={() => scrollTabs(1)}
        disabled={!canScrollRight}
        className={cn(
          'from-card text-muted-foreground hover:text-foreground absolute top-0 right-0 bottom-0 z-10 flex w-8 items-center justify-end bg-gradient-to-l from-60% to-transparent pr-1.5 transition-all duration-200',
          canScrollRight
            ? 'pointer-events-auto translate-x-0 opacity-100'
            : 'pointer-events-none translate-x-1 opacity-0'
        )}
      >
        <Icons.ArrowRight size={14} strokeWidth={2} />
      </button>
    </div>
  )
}

export function NotificationBell() {
  const { t } = useTranslation('common')
  const userTimezone = useAuthStore((state) => state.user?.timezone)

  const [isOpen, setIsOpen] = useState(false)

  // Tab state — Tasks is the default (operators' most-frequent action).
  const [activeTab, setActiveTab] = useState<Tab>('tasks')

  const { data: taskNotifData } = useNotifications({
    page: 1,
    page_size: 200,
    type: TASK_TAB_TYPES,
  })
  const { data: otherNotifData } = useNotifications({
    page: 1,
    page_size: 50,
    type: NON_TASK_TAB_TYPES,
  })
  const { data: unreadData } = useUnreadCount()

  // Badge = unread of VISIBLE types only. /unread/count has no type
  // filter, but returns per-type counts — sum them minus the hidden
  // (never-rendered) types so the badge always reconciles with what the
  // popup can actually show.
  const byType = unreadData?.by_type
  const count = byType
    ? Object.entries(byType).reduce(
        (sum, [notifType, typeCount]) =>
          HIDDEN_TYPES.has(notifType) ? sum : sum + (typeCount || 0),
        0
      )
    : (unreadData?.total ?? 0)

  // "Other" tab types: every known-but-untabbed type PLUS any type the
  // backend reports unread that the frontend doesn't know yet. The
  // dynamic part is what guarantees future types surface (generically)
  // instead of silently inflating the badge.
  const tabAssignedTypes = new Set<string>([
    ...TASK_TAB_TYPES,
    ...NON_TASK_TAB_TYPES,
    ...TRAINING_TAB_TYPES,
    ...HIDDEN_TYPES,
  ])
  const unknownUnreadTypes = Object.keys(byType ?? {}).filter(
    (notifType) => !tabAssignedTypes.has(notifType) && !KNOWN_MISC_TYPES.includes(notifType)
  )
  const unknownUnreadKey = unknownUnreadTypes.join(',')
  const seenUnknownTypes = useSeenUnknownTypes(unknownUnreadKey)
  const miscTypes = [
    ...new Set([...KNOWN_MISC_TYPES, ...unknownUnreadTypes, ...seenUnknownTypes]),
  ].sort()

  // Secondary tabs fetch on open only (no background polling for them).
  const { data: trainingNotifData } = useNotifications(
    { page: 1, page_size: 50, type: TRAINING_TAB_TYPES },
    { enabled: isOpen }
  )
  const { data: miscNotifData } = useNotifications(
    { page: 1, page_size: 50, type: miscTypes },
    { enabled: isOpen }
  )
  // Read history — GET /notifications?read=true (records are never
  // deleted on mark-as-read, only flagged), windowed to the last 30 days
  // client-side. Fetched only while the tab is shown.
  //
  // The fetch MUST be type-scoped (``type`` is a repeatable query param,
  // Notification.type.in_ on the backend): the backend sorts created_at
  // DESC and pages server-side, so an unscoped page 1×100 gets swallowed
  // by the noisiest hidden type — ta_chain_created is 11.5K rows for a
  // single trainer on prod, and «Позначити як прочитані» flips them all
  // to read at once. The client-side HIDDEN_TYPES filter would then
  // render the tab almost empty, collapsing the 30-day window to hours —
  // exactly the lost-trail scenario this tab exists to prevent.
  const readHistoryTypes = [
    ...new Set([...TASK_TAB_TYPES, ...NON_TASK_TAB_TYPES, ...TRAINING_TAB_TYPES, ...miscTypes]),
  ].sort()
  const { data: readNotifData, dataUpdatedAt: readFetchedAt } = useNotifications(
    { page: 1, page_size: 100, read: true, type: readHistoryTypes },
    { enabled: isOpen && activeTab === 'read' }
  )

  const dismissMutation = useDismissNotification()
  const markAllReadMutation = useMarkAllAsRead()

  const taskNotifs = taskNotifData?.items ?? []
  const otherNotifs = otherNotifData?.items ?? []
  const trainingNotifs = trainingNotifData?.items ?? []
  const miscNotifs = miscNotifData?.items ?? []
  const readNotifs = readNotifData?.items ?? []

  const [isShaking, setIsShaking] = useState(false)
  const prevCountRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Socket.IO connection for real-time updates
  const onNewNotification = useCallback((_notification: NotificationItem) => {
    // Shake is handled by count change effect below
  }, [])
  useNotificationSocket(onNewNotification)

  // Shake when new notifications arrive
  useEffect(() => {
    const prev = prevCountRef.current
    prevCountRef.current = count
    if (count > prev && prev !== 0) {
      const timer = setTimeout(() => {
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 900)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [count])

  // Close dropdown on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    } else {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isOpen, handleOutsideClick])

  const hasNotifications = count > 0

  // Per-tab filtered slices. Task-based tabs read from ``taskNotifs``
  // (the dedicated 200-cap fetch) so the per-user task cap is fully
  // exposed; non-task tabs read from ``otherNotifs`` (the 50-cap fetch
  // for lower-volume types) so tasks can't cannibalize their slots.
  const tasksTabItems = taskNotifs.filter((n) => !n.starred)
  const starredTabItems = taskNotifs.filter((n) => n.starred)
  const paymentsTabItems = otherNotifs.filter((n) => n.type === NotificationType.PAYMENT_PENDING)
  const callsTabItems = otherNotifs.filter(
    (n) =>
      n.type === NotificationType.INCOMING_CALL || n.type === NotificationType.CALLBACK_REQUESTED
  )
  const rrPaymentsTabItems = otherNotifs.filter((n) => n.type === NotificationType.RR_PAYMENT_DUE)
  const ubkiTabItems = otherNotifs.filter(
    (n) =>
      n.type === NotificationType.UBKI_FAILURE_ALERT ||
      n.type === NotificationType.UBKI_CONNECTION_DOWN ||
      n.type === NotificationType.UBKI_DAILY_SUMMARY
  )
  const trainingTabItems = trainingNotifs
  // Defensive re-filter: the misc fetch already excludes hidden types
  // server-side, but never let a hidden type slip into the panel.
  const miscTabItems = miscNotifs.filter((n) => !HIDDEN_TYPES.has(n.type))
  // "Now" for the 30-day window = the fetch timestamp (render must stay
  // pure; the cutoff naturally advances with every refetch of the tab).
  const readCutoffMs = readFetchedAt - READ_HISTORY_DAYS * 86_400_000
  const readTabItems = readNotifs.filter(
    (n) =>
      !HIDDEN_TYPES.has(n.type) && new Date(n.read_at ?? n.created_at).getTime() >= readCutoffMs
  )

  const markAsReadMutation = useMarkAsRead()
  const starMutation = useStarNotification()
  const unstarMutation = useUnstarNotification()
  const updateTaskMutation = useUpdateTaskFromBell()

  const handleNotificationClick = (
    e: React.MouseEvent,
    notificationId: string,
    isRead: boolean
  ) => {
    if (e.button === 2) return
    if (!isRead) {
      markAsReadMutation.mutate(notificationId)
    }
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      setIsOpen(false)
    }
  }

  // Payment / Call cards: existing notification-dismiss behavior, unchanged.
  const handleDismiss = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    try {
      await dismissMutation.mutateAsync(notificationId)
    } catch {
      toast.error(t('notificationBell.errors.dismissFailed'))
    }
  }

  // Task cards: ✗ icon now CANCELS the task (not just dismisses the
  // notification). The notification auto-dismisses on the next poll
  // cycle when the task status drops out of the overdue set.
  // Optimistic UI removes the card immediately so the ~15s lag is invisible.
  const handleCancelTask = (e: React.MouseEvent, taskId: number) => {
    e.stopPropagation()
    updateTaskMutation.mutate(
      { taskId, status: 'cancelled' },
      {
        onError: () =>
          toast.error(t('notificationBell.errors.cancelFailed', 'Failed to cancel task')),
      }
    )
  }

  // Task cards: ✓ button COMPLETES the task. Same auto-dismiss flow.
  const handleCompleteTask = (e: React.MouseEvent, taskId: number) => {
    e.stopPropagation()
    updateTaskMutation.mutate(
      { taskId, status: 'completed' },
      {
        onError: () =>
          toast.error(t('notificationBell.errors.completeFailed', 'Failed to complete task')),
      }
    )
  }

  const handleStar = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    starMutation.mutate(notificationId, {
      onError: () => toast.error(t('notificationBell.errors.starFailed', 'Failed to star')),
    })
  }

  const handleUnstar = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    unstarMutation.mutate(notificationId, {
      onError: () => toast.error(t('notificationBell.errors.unstarFailed', 'Failed to unstar')),
    })
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        aria-label={
          hasNotifications
            ? t('notificationBell.ariaLabelWithCount', { count })
            : t('notificationBell.ariaLabel')
        }
        onClick={() => setIsOpen((prev) => !prev)}
        className="hover:bg-muted relative flex h-9 w-9 items-center justify-center rounded-full transition-colors focus:outline-none"
      >
        <Icons.Bell
          size={20}
          strokeWidth={1.5}
          className={cn(
            'transition-colors',
            hasNotifications ? 'text-foreground' : 'text-muted-foreground',
            isShaking && 'animate-bell-shake'
          )}
        />
        {hasNotifications && (
          <span className="bg-error-500 absolute top-0.5 right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-0.5 text-[10px] leading-none font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="border-border bg-card absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border shadow-xl">
          <div className="border-border flex items-center justify-between border-b px-4 py-3">
            <span className="text-foreground text-sm font-semibold">
              {t('notificationBell.title')}
            </span>
            <div className="flex items-center gap-2">
              {hasNotifications && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      markAllReadMutation.mutate(undefined, {
                        onError: () => toast.error(t('notificationBell.errors.markAllReadFailed')),
                      })
                    }
                    className="text-primary-500 hover:text-primary-700 text-[10px] font-medium"
                  >
                    {t('notificationBell.markAllRead')}
                  </button>
                  <span className="bg-error-100 text-error-600 rounded-full px-2 py-0.5 text-xs font-medium">
                    {count}
                  </span>
                </>
              )}
            </div>
          </div>

          <NotificationTabStrip
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabCounts={{
              tasks: tasksTabItems.length,
              starred: starredTabItems.length,
              training: trainingTabItems.length,
              payments: paymentsTabItems.length,
              calls: callsTabItems.length,
              rrPayments: rrPaymentsTabItems.length,
              ubki: ubkiTabItems.length,
              other: miscTabItems.length,
              read: readTabItems.length,
            }}
            t={t}
          />

          {/* Tab content panel */}
          <div className="max-h-80 overflow-y-auto">
            {activeTab === 'tasks' &&
              (tasksTabItems.length === 0 ? (
                <EmptyState t={t} label={t('notificationBell.empty.tasks', 'No overdue tasks')} />
              ) : (
                tasksTabItems.map((n) => (
                  <TaskNotificationItem
                    key={n.id}
                    notification={n}
                    onNotificationClick={handleNotificationClick}
                    onCancelTask={handleCancelTask}
                    onCompleteTask={handleCompleteTask}
                    onStar={handleStar}
                    onUnstar={handleUnstar}
                    userTimezone={userTimezone}
                  />
                ))
              ))}

            {activeTab === 'starred' &&
              (starredTabItems.length === 0 ? (
                <EmptyState t={t} label={t('notificationBell.empty.starred', 'No starred tasks')} />
              ) : (
                starredTabItems.map((n) => (
                  <TaskNotificationItem
                    key={n.id}
                    notification={n}
                    onNotificationClick={handleNotificationClick}
                    onCancelTask={handleCancelTask}
                    onCompleteTask={handleCompleteTask}
                    onStar={handleStar}
                    onUnstar={handleUnstar}
                    userTimezone={userTimezone}
                  />
                ))
              ))}

            {activeTab === 'payments' &&
              (paymentsTabItems.length === 0 ? (
                <EmptyState
                  t={t}
                  label={t('notificationBell.empty.payments', 'No pending payments')}
                />
              ) : (
                paymentsTabItems.map((n) => (
                  <PaymentNotificationItem
                    key={n.id}
                    notification={n}
                    userTimezone={userTimezone}
                    onNotificationClick={handleNotificationClick}
                  />
                ))
              ))}

            {activeTab === 'calls' &&
              (callsTabItems.length === 0 ? (
                <EmptyState t={t} label={t('notificationBell.empty.calls', 'No inbound calls')} />
              ) : (
                callsTabItems.map((n) => (
                  <CallNotificationItem
                    key={n.id}
                    notification={n}
                    onNotificationClick={handleNotificationClick}
                    onDismiss={handleDismiss}
                  />
                ))
              ))}

            {activeTab === 'rrPayments' &&
              (rrPaymentsTabItems.length === 0 ? (
                <EmptyState
                  t={t}
                  label={t('notificationBell.empty.rrPayments', 'No RR payments due')}
                />
              ) : (
                rrPaymentsTabItems.map((n) => (
                  <RRPaymentNotificationItem
                    key={n.id}
                    notification={n}
                    onNotificationClick={handleNotificationClick}
                    onDismiss={handleDismiss}
                  />
                ))
              ))}

            {activeTab === 'ubki' &&
              (ubkiTabItems.length === 0 ? (
                <EmptyState t={t} label={t('notificationBell.empty.ubki', 'No UBKI alerts')} />
              ) : (
                ubkiTabItems.map((n) => (
                  <UbkiNotificationItem
                    key={n.id}
                    notification={n}
                    onNotificationClick={handleNotificationClick}
                    onDismiss={handleDismiss}
                  />
                ))
              ))}

            {activeTab === 'training' &&
              (trainingTabItems.length === 0 ? (
                <EmptyState
                  t={t}
                  label={t('notificationBell.empty.training', 'No training notifications')}
                />
              ) : (
                trainingTabItems.map((n) => (
                  <TrainingNotificationItem
                    key={n.id}
                    notification={n}
                    onNotificationClick={handleNotificationClick}
                    onDismiss={handleDismiss}
                    userTimezone={userTimezone}
                  />
                ))
              ))}

            {activeTab === 'other' &&
              (miscTabItems.length === 0 ? (
                <EmptyState
                  t={t}
                  label={t('notificationBell.empty.other', 'No other notifications')}
                />
              ) : (
                miscTabItems.map((n) => (
                  <GenericNotificationItem
                    key={n.id}
                    notification={n}
                    onNotificationClick={handleNotificationClick}
                    onDismiss={handleDismiss}
                  />
                ))
              ))}

            {/* Read history — the last 30 days of read notifications.
                Deliberately non-destructive: no dismiss button, so
                "Позначити як прочитані" can never erase the trail again. */}
            {activeTab === 'read' &&
              (readTabItems.length === 0 ? (
                <EmptyState
                  t={t}
                  label={t('notificationBell.empty.read', 'No read notifications')}
                />
              ) : (
                readTabItems.map((n) => (
                  <GenericNotificationItem
                    key={n.id}
                    notification={n}
                    onNotificationClick={handleNotificationClick}
                  />
                ))
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared types for sub-components ─────────────────────────────

type NotificationClickFn = (e: React.MouseEvent, notificationId: string, isRead: boolean) => void
type DismissFn = (e: React.MouseEvent, id: string) => void

const clientHref = (clientId: number) => `/dashboard/clients/${clientId}`

// ─── Payment notification item (no dismiss — auto-dismissed on verify/cancel) ──

function PaymentNotificationItem({
  notification: n,
  userTimezone,
  onNotificationClick,
}: {
  notification: NotificationItem
  userTimezone?: string
  onNotificationClick: NotificationClickFn
}) {
  const { t, i18n } = useTranslation('common')
  const meta = n.metadata
  const daysPending = Number(meta.days_pending) || 0
  const cardClassName =
    'flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left disabled:cursor-default'
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {!n.read && <span className="bg-primary-500 h-2 w-2 shrink-0 rounded-full" />}
        <p className="text-foreground line-clamp-1 text-xs font-semibold">
          {meta.client_name ?? t('notificationBell.clientNumber', { id: meta.client_id })}
          <span className="text-foreground ml-1 font-normal">
            ({t('notificationBell.idLabel', { id: meta.client_id })})
          </span>
          <span className="text-foreground ml-1 font-normal">/ {meta.payment_number}</span>
        </p>
        <span className="bg-warning-100 text-warning-600 rounded px-1.5 py-0.5 text-[10px] font-medium">
          {t('notificationBell.payment.pending')}
        </span>
        <span className="bg-error-100 text-error-600 rounded px-1.5 py-0.5 text-[10px] font-medium">
          {t('notificationBell.payment.daysPending', { count: daysPending })}
        </span>
      </div>
      <p className="text-foreground w-full min-w-0 truncate text-xs">
        ₴ {Number(meta.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        <span className="ml-2">{translatePaymentMethod(meta.payment_method, t)}</span>
      </p>
      <div className="text-foreground flex items-center gap-1">
        <Icons.Clock01 size={11} strokeWidth={1.5} />
        <span className="text-[11px]">
          {meta.recorded_at ? formatDateTime(meta.recorded_at, userTimezone, i18n.language) : '—'}
        </span>
      </div>
    </>
  )
  return (
    <div className="group border-border hover:bg-muted relative flex border-b transition-colors last:border-b-0">
      {meta.client_id ? (
        <Link
          to={clientHref(meta.client_id)}
          onClick={(e) => onNotificationClick(e, n.id, n.read)}
          onAuxClick={(e) => onNotificationClick(e, n.id, n.read)}
          className={cardClassName}
        >
          {body}
        </Link>
      ) : (
        <div className={`${cardClassName} cursor-default opacity-60`}>{body}</div>
      )}
    </div>
  )
}

// ─── Task notification item ──────────────────────────────────────

function TaskNotificationItem({
  notification: n,
  onNotificationClick,
  onCancelTask,
  onCompleteTask,
  onStar,
  onUnstar,
  userTimezone,
}: {
  notification: NotificationItem
  onNotificationClick: NotificationClickFn
  onCancelTask: (e: React.MouseEvent, taskId: number) => void
  onCompleteTask: (e: React.MouseEvent, taskId: number) => void
  onStar: (e: React.MouseEvent, notificationId: string) => void
  onUnstar: (e: React.MouseEvent, notificationId: string) => void
  userTimezone?: string
}) {
  const { t } = useTranslation('common')
  const meta = n.metadata
  const taskId = meta.task_id as number | undefined
  // Correction-task notifications (Dialogue Evaluation Assign task) are
  // call-centric: no client_id/debt_id/priority — render the notification
  // title and stay clickable so the unread state can be cleared.
  const isCorrection = n.type === NotificationType.CORRECTION_TASK_OVERDUE
  const hasClient = meta.client_name != null || meta.client_id != null
  const cardClassName =
    'flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left disabled:cursor-default'
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5 pr-5">
        {!n.read && <span className="bg-primary-500 h-2 w-2 shrink-0 rounded-full" />}
        {hasClient ? (
          <p className="text-foreground line-clamp-1 text-xs font-semibold">
            {meta.client_name ?? t('notificationBell.clientNumber', { id: meta.client_id })}
            {meta.client_id && (
              <span className="text-foreground ml-1 font-normal">
                ({t('notificationBell.idLabel', { id: meta.client_id })})
              </span>
            )}
            {meta.debt_id && (
              <span className="text-foreground ml-1 font-normal">
                / {t('notificationBell.debtLabel', { id: meta.debt_id })}
              </span>
            )}
          </p>
        ) : (
          <p className="text-foreground line-clamp-1 text-xs font-semibold">{n.title}</p>
        )}
        {meta.priority && (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium capitalize',
              meta.priority === 'high' && 'bg-error-100 text-error-600',
              meta.priority === 'normal' && 'bg-information-100 text-information-600',
              meta.priority === 'low' && 'bg-muted text-muted-foreground'
            )}
          >
            {t(`notificationBell.taskPriority.${meta.priority}`, {
              defaultValue: meta.priority,
            })}
          </span>
        )}
        {meta.status && (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium capitalize',
              meta.status === 'pending' && 'bg-warning-100 text-warning-600',
              meta.status === 'in_progress' && 'bg-information-100 text-information-600',
              meta.status === 'completed' && 'bg-success-100 text-success-600',
              meta.status === 'extended' && 'bg-information-100 text-information-600',
              meta.status === 'rejected' && 'bg-error-100 text-error-600',
              meta.status === 'incoming_line_result' && 'bg-warning-100 text-warning-600'
            )}
          >
            {t(`notificationBell.taskStatus.${meta.status}`, {
              defaultValue: meta.status?.replace(/_/g, ' ') ?? '',
            })}
          </span>
        )}
        {meta.subject_name && !meta.status && (
          <span className="bg-information-100 text-information-600 rounded px-1.5 py-0.5 text-[10px] font-medium">
            {meta.subject_name}
          </span>
        )}
      </div>
      {(meta.description || n.body) && (
        <p className="text-foreground w-full min-w-0 truncate text-xs">
          {meta.description || n.body}
        </p>
      )}
      <div className="text-foreground flex items-center gap-1">
        <Icons.Clock01 size={11} strokeWidth={1.5} />
        <span className="text-[11px]">
          {meta.due_date ? formatTaskDueDateForDisplay(meta.due_date, userTimezone) : '—'}
        </span>
      </div>
    </>
  )
  return (
    <div className="group border-border hover:bg-muted relative flex border-b transition-colors last:border-b-0">
      {meta.client_id ? (
        <Link
          to={clientHref(meta.client_id)}
          onClick={(e) => onNotificationClick(e, n.id, n.read)}
          onAuxClick={(e) => onNotificationClick(e, n.id, n.read)}
          className={cardClassName}
        >
          {body}
        </Link>
      ) : isCorrection ? (
        // No client to navigate to — clickable only to clear the unread dot.
        <button
          type="button"
          onClick={(e) => onNotificationClick(e, n.id, n.read)}
          className={cardClassName}
        >
          {body}
        </button>
      ) : (
        <div className={`${cardClassName} cursor-default opacity-60`}>{body}</div>
      )}
      {/* Action cluster — visible on hover. Complete + Star/Unstar +
          Cancel. Star toggles to Unstar in the Starred tab (driven by
          n.starred). The X icon (Cancel01) is repurposed from
          "dismiss notification" to "cancel task". */}
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {taskId !== undefined && (
          <button
            type="button"
            aria-label={t('notificationBell.taskActions.completeAria', 'Complete task')}
            title={t('notificationBell.taskActions.completeTitle', 'Complete task')}
            onClick={(e) => onCompleteTask(e, taskId)}
            className="text-muted-foreground hover:bg-success-50 hover:text-success-600 flex h-5 w-5 items-center justify-center rounded"
          >
            <Icons.Tick02 size={12} strokeWidth={2} />
          </button>
        )}
        {n.starred ? (
          <button
            type="button"
            aria-label={t('notificationBell.taskActions.unstarAria', 'Unstar')}
            title={t('notificationBell.taskActions.unstarTitle', 'Unstar')}
            onClick={(e) => onUnstar(e, n.id)}
            className="text-foreground hover:bg-muted hover:text-foreground flex h-5 w-5 items-center justify-center rounded"
          >
            <Icons.StarFilled size={12} strokeWidth={2} />
          </button>
        ) : (
          <button
            type="button"
            aria-label={t('notificationBell.taskActions.starAria', 'Star task')}
            title={t('notificationBell.taskActions.starTitle', 'Star task')}
            onClick={(e) => onStar(e, n.id)}
            className="text-warning-500 hover:bg-warning-50 hover:text-warning-600 flex h-5 w-5 items-center justify-center rounded"
          >
            <Icons.StarFilled size={12} strokeWidth={2} />
          </button>
        )}
        {taskId !== undefined && (
          <button
            type="button"
            aria-label={t('notificationBell.taskActions.cancelAria', 'Cancel task')}
            title={t('notificationBell.taskActions.cancelTitle', 'Cancel task')}
            onClick={(e) => onCancelTask(e, taskId)}
            className="text-muted-foreground hover:bg-error-50 hover:text-error-600 flex h-5 w-5 items-center justify-center rounded"
          >
            <Icons.Cancel01 size={12} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Call notification item ──────────────────────────────────────

function CallNotificationItem({
  notification: n,
  onNotificationClick,
  onDismiss,
}: {
  notification: NotificationItem
  onNotificationClick: NotificationClickFn
  onDismiss: DismissFn
}) {
  const { t } = useTranslation('common')
  const meta = n.metadata
  const cardClassName =
    'flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left disabled:cursor-default'
  const body = (
    <>
      <div className="flex items-center gap-2">
        {!n.read && <span className="bg-primary-500 h-2 w-2 shrink-0 rounded-full" />}
        <Icons.Phone size={14} strokeWidth={1.5} className="text-success-500" />
        <p className="text-foreground text-xs font-semibold">{n.title}</p>
      </div>
      <p className="text-foreground text-xs">{n.body}</p>
      <span className="text-muted-foreground text-[11px]">
        {n.created_at ? formatRelativeTime(n.created_at, t) : ''}
      </span>
    </>
  )
  return (
    <div className="group border-border hover:bg-muted relative flex border-b transition-colors last:border-b-0">
      {meta.client_id ? (
        <Link
          to={clientHref(meta.client_id)}
          onClick={(e) => onNotificationClick(e, n.id, n.read)}
          onAuxClick={(e) => onNotificationClick(e, n.id, n.read)}
          className={cardClassName}
        >
          {body}
        </Link>
      ) : (
        <div className={`${cardClassName} cursor-default opacity-60`}>{body}</div>
      )}
      <button
        type="button"
        aria-label={t('notificationBell.dismissAria')}
        onClick={(e) => onDismiss(e, n.id)}
        className="text-muted-foreground hover:text-foreground absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Icons.Cancel01 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

// ─── RR Payment notification item ────────────────────────────────
// Dismiss-only action (operators clear the card; the next poll cycle
// in notification-service handles natural cleanup).

// UBKI integration alerts (failure rate / connection down / daily summary).
// System-level notifications with no client link — a plain title/body card.
function UbkiNotificationItem({
  notification: n,
  onNotificationClick,
  onDismiss,
}: {
  notification: NotificationItem
  onNotificationClick: NotificationClickFn
  onDismiss: DismissFn
}) {
  const { t } = useTranslation('common')
  return (
    <div className="group border-border hover:bg-muted relative flex border-b transition-colors last:border-b-0">
      <button
        type="button"
        onClick={(e) => onNotificationClick(e, n.id, n.read)}
        className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left"
      >
        <div className="flex flex-wrap items-center gap-1.5 pr-5">
          {!n.read && <span className="bg-primary-500 h-2 w-2 shrink-0 rounded-full" />}
          <p className="text-foreground line-clamp-1 text-xs font-semibold">{n.title}</p>
        </div>
        {n.body && (
          <p className="text-foreground w-full min-w-0 text-xs whitespace-normal">{n.body}</p>
        )}
        <div className="text-foreground flex items-center gap-1">
          <Icons.Clock01 size={11} strokeWidth={1.5} />
          <span className="text-[11px]">{formatRelativeTime(n.created_at, t)}</span>
        </div>
      </button>
      <button
        type="button"
        aria-label={t('notificationBell.dismissAria')}
        onClick={(e) => onDismiss(e, n.id)}
        className="text-muted-foreground hover:text-foreground absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Icons.Cancel01 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

function RRPaymentNotificationItem({
  notification: n,
  onNotificationClick,
  onDismiss,
}: {
  notification: NotificationItem
  onNotificationClick: NotificationClickFn
  onDismiss: DismissFn
}) {
  const { t } = useTranslation('common')
  const meta = n.metadata
  const cardClassName =
    'flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left disabled:cursor-default'
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5 pr-5">
        {!n.read && <span className="bg-primary-500 h-2 w-2 shrink-0 rounded-full" />}
        <p className="text-foreground line-clamp-1 text-xs font-semibold">
          {t('notificationBell.rrPayment.title', { defaultValue: n.title })}
        </p>
        {meta.amount && (
          <span className="bg-information-100 text-information-600 rounded px-1.5 py-0.5 text-[10px] font-medium">
            ₴ {meta.amount}
          </span>
        )}
      </div>
      {n.body && <p className="text-foreground line-clamp-3 w-full min-w-0 text-xs">{n.body}</p>}
      <div className="text-foreground flex items-center gap-1">
        <Icons.Clock01 size={11} strokeWidth={1.5} />
        <span className="text-[11px]">
          {meta.due_date ?? '—'}
          {typeof meta.days_left === 'number' && (
            <span className="text-muted-foreground ml-1">
              (
              {t('notificationBell.daysLeft', {
                count: meta.days_left,
                defaultValue: 'in {{count}} days',
              })}
              )
            </span>
          )}
        </span>
      </div>
    </>
  )
  return (
    <div className="group border-border hover:bg-muted relative flex border-b transition-colors last:border-b-0">
      {meta.client_id ? (
        <Link
          to={clientHref(meta.client_id)}
          onClick={(e) => onNotificationClick(e, n.id, n.read)}
          onAuxClick={(e) => onNotificationClick(e, n.id, n.read)}
          className={cardClassName}
        >
          {body}
        </Link>
      ) : (
        <div className={`${cardClassName} cursor-default opacity-60`}>{body}</div>
      )}
      <button
        type="button"
        aria-label={t('notificationBell.dismissAria')}
        onClick={(e) => onDismiss(e, n.id)}
        className="text-muted-foreground hover:text-foreground absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Icons.Cancel01 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

// `meeting_url` is free text a trainer types when scheduling a group
// training, so it reaches us unvalidated. Render it as a link only when
// it is http(s): a `javascript:` href would execute on click, and
// `data:`/`blob:` open an opaque origin — both are phishing vectors even
// from an internal author. Anything else is dropped (the card still
// shows topic and time).
// ─── Training notification item ──────────────────────────────────
// Coaching & training assignments (1-on-1s, courses, drills,
// correction tasks). 1-on-1 cards surface who/when from metadata when
// the publisher provided them; every other case falls back to the
// stored title/body so the card is never blank.

function TrainingNotificationItem({
  notification: n,
  onNotificationClick,
  onDismiss,
  userTimezone,
}: {
  notification: NotificationItem
  onNotificationClick: NotificationClickFn
  onDismiss: DismissFn
  userTimezone?: string
}) {
  const { t, i18n } = useTranslation('common')
  const meta = n.metadata
  const typeLabel = t(`notificationBell.trainingTypes.${n.type}`, { defaultValue: '' })
  const isOneOnOne =
    n.type === NotificationType.ONE_ON_ONE_SCHEDULED ||
    n.type === NotificationType.ONE_ON_ONE_REMINDER
  const trainerName =
    typeof meta.trainer_name === 'string'
      ? meta.trainer_name
      : typeof meta.trainer_full_name === 'string'
        ? meta.trainer_full_name
        : undefined
  const scheduledAt = typeof meta.scheduled_at === 'string' ? meta.scheduled_at : undefined
  const durationMinutes =
    typeof meta.duration_minutes === 'number' ? meta.duration_minutes : undefined
  // Group trainings (KAN-752): n.title is the generic headline ("Вас
  // призначено на груповий тренінг"), so the topic comes from
  // metadata.title; meeting_url is optional (offline trainings have a
  // location instead). Missing fields fall back to n.body below, which
  // the backend already renders with both.
  const isGroupTraining =
    n.type === NotificationType.TRAINING_SCHEDULED || n.type === NotificationType.TRAINING_REMINDER
  const topic = typeof meta.title === 'string' ? meta.title : undefined
  const meetingUrl = safeHttpUrl(meta.meeting_url)
  return (
    <div className="group border-border hover:bg-muted relative flex flex-col border-b transition-colors last:border-b-0">
      <button
        type="button"
        onClick={(e) => onNotificationClick(e, n.id, n.read)}
        className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left"
      >
        <div className="flex flex-wrap items-center gap-1.5 pr-5">
          {!n.read && <span className="bg-primary-500 h-2 w-2 shrink-0 rounded-full" />}
          <p className="text-foreground line-clamp-1 text-xs font-semibold">{n.title}</p>
          {typeLabel && (
            <span className="bg-information-100 text-information-600 rounded px-1.5 py-0.5 text-[10px] font-medium">
              {typeLabel}
            </span>
          )}
        </div>
        {isOneOnOne && trainerName && (
          <p className="text-foreground line-clamp-1 w-full min-w-0 text-xs">
            {t('notificationBell.training.withTrainer', { name: trainerName })}
          </p>
        )}
        {isGroupTraining && topic && (
          <p className="text-foreground line-clamp-2 w-full min-w-0 text-xs">«{topic}»</p>
        )}
        {(isOneOnOne || isGroupTraining) && scheduledAt ? (
          <div className="text-foreground flex items-center gap-1">
            <Icons.Clock01 size={11} strokeWidth={1.5} />
            <span className="text-[11px]">
              {formatDateTime(scheduledAt, userTimezone, i18n.language)}
              {durationMinutes !== undefined && (
                <span className="text-muted-foreground ml-1">
                  · {t('notificationBell.training.durationMin', { count: durationMinutes })}
                </span>
              )}
            </span>
          </div>
        ) : (
          n.body && (
            <p className="text-foreground w-full min-w-0 text-xs whitespace-normal">{n.body}</p>
          )
        )}
        <span className="text-muted-foreground text-[11px]">
          {n.created_at ? formatRelativeTime(n.created_at, t) : ''}
        </span>
      </button>
      {/* Sibling of the card button, not a child: an <a> inside a
          <button> is invalid nesting and would swallow the click into
          mark-as-read instead of opening the meeting. */}
      {isGroupTraining && meetingUrl && (
        <a
          href={meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-information-600 -mt-1.5 line-clamp-1 px-4 pb-3 text-[11px] hover:underline"
        >
          {t('notificationBell.training.joinMeeting')}
        </a>
      )}
      <button
        type="button"
        aria-label={t('notificationBell.dismissAria')}
        onClick={(e) => onDismiss(e, n.id)}
        className="text-muted-foreground hover:text-foreground absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Icons.Cancel01 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

// ─── Generic notification item ───────────────────────────────────
// Fallback card for any type without a dedicated renderer — including
// backend types this build doesn't know yet. Guarantees a new type can
// never inflate the badge while staying invisible in the popup. Also
// used (without dismiss) by the read-history tab.

function GenericNotificationItem({
  notification: n,
  onNotificationClick,
  onDismiss,
}: {
  notification: NotificationItem
  onNotificationClick: NotificationClickFn
  onDismiss?: DismissFn
}) {
  const { t } = useTranslation('common')
  const meta = n.metadata
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5 pr-5">
        {!n.read && <span className="bg-primary-500 h-2 w-2 shrink-0 rounded-full" />}
        <p className="text-foreground line-clamp-1 text-xs font-semibold">{n.title || n.type}</p>
      </div>
      {n.body && (
        <p className="text-foreground line-clamp-3 w-full min-w-0 text-xs whitespace-normal">
          {n.body}
        </p>
      )}
      <span className="text-muted-foreground text-[11px]">
        {n.created_at ? formatRelativeTime(n.created_at, t) : ''}
      </span>
    </>
  )
  const cardClassName = 'flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left'
  return (
    <div className="group border-border hover:bg-muted relative flex border-b transition-colors last:border-b-0">
      {meta.client_id ? (
        <Link
          to={clientHref(meta.client_id)}
          onClick={(e) => onNotificationClick(e, n.id, n.read)}
          onAuxClick={(e) => onNotificationClick(e, n.id, n.read)}
          className={cardClassName}
        >
          {body}
        </Link>
      ) : (
        <button
          type="button"
          onClick={(e) => onNotificationClick(e, n.id, n.read)}
          className={cardClassName}
        >
          {body}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          aria-label={t('notificationBell.dismissAria')}
          onClick={(e) => onDismiss(e, n.id)}
          className="text-muted-foreground hover:text-foreground absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Icons.Cancel01 size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
