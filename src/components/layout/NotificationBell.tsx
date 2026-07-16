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

import { useState, useRef, useEffect, useCallback } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
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
// here + a new render branch in the tab-content panel.
const TABS = ['tasks', 'starred', 'payments', 'calls', 'rrPayments', 'ubki'] as const
type Tab = (typeof TABS)[number]

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

  const { data: notificationsData } = useNotifications({ page: 1, page_size: 50 })
  const { data: unreadData } = useUnreadCount()
  const dismissMutation = useDismissNotification()
  const markAllReadMutation = useMarkAllAsRead()

  const notifications = notificationsData?.items ?? []
  const count = unreadData?.total ?? 0

  const [isOpen, setIsOpen] = useState(false)
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

  // Tab state — Tasks / Starred / Pending Payments / Inbound Calls.
  // Tasks-tab default matches operators' most-frequent action.
  const [activeTab, setActiveTab] = useState<Tab>('tasks')

  // Per-tab filtered slices (one query, filtered locally — same pattern
  // the previous flat-list rendering used). Task tabs split on starred.
  const isTaskType = (n: NotificationItem) =>
    n.type === NotificationType.TASK_OVERDUE || n.type === NotificationType.CORRECTION_TASK_OVERDUE
  const tasksTabItems = notifications.filter((n) => isTaskType(n) && !n.starred)
  const starredTabItems = notifications.filter((n) => isTaskType(n) && n.starred)
  const paymentsTabItems = notifications.filter((n) => n.type === NotificationType.PAYMENT_PENDING)
  const callsTabItems = notifications.filter(
    (n) =>
      n.type === NotificationType.INCOMING_CALL || n.type === NotificationType.CALLBACK_REQUESTED
  )
  const rrPaymentsTabItems = notifications.filter((n) => n.type === NotificationType.RR_PAYMENT_DUE)
  const ubkiTabItems = notifications.filter(
    (n) =>
      n.type === NotificationType.UBKI_FAILURE_ALERT ||
      n.type === NotificationType.UBKI_CONNECTION_DOWN ||
      n.type === NotificationType.UBKI_DAILY_SUMMARY
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
              payments: paymentsTabItems.length,
              calls: callsTabItems.length,
              rrPayments: rrPaymentsTabItems.length,
              ubki: ubkiTabItems.length,
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
