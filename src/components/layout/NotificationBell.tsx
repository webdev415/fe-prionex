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
const TABS = ['tasks', 'starred', 'payments', 'calls', 'rrPayments'] as const
type Tab = (typeof TABS)[number]

function EmptyState({ label }: { t: TFunction; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-gray-300">
      <Icons.Bell size={28} strokeWidth={1.5} />
      <p className="text-xs text-gray-400">{label}</p>
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
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-gray-100 focus:outline-none"
      >
        <Icons.Bell
          size={20}
          strokeWidth={1.5}
          className={cn(
            'transition-colors',
            hasNotifications ? 'text-dark-500' : 'text-gray-300',
            isShaking && 'animate-bell-shake'
          )}
        />
        {hasNotifications && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] leading-none font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="text-dark-500 text-sm font-semibold">
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
                    className="text-[10px] font-medium text-blue-500 hover:text-blue-700"
                  >
                    {t('notificationBell.markAllRead')}
                  </button>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                    {count}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Tab strip — horizontal, scrollable on overflow. */}
          <div className="flex overflow-x-auto border-b border-gray-100 text-xs">
            {TABS.map((tab) => {
              const count =
                tab === 'tasks'
                  ? tasksTabItems.length
                  : tab === 'starred'
                    ? starredTabItems.length
                    : tab === 'payments'
                      ? paymentsTabItems.length
                      : tab === 'calls'
                        ? callsTabItems.length
                        : rrPaymentsTabItems.length
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex-shrink-0 border-b-2 px-3 py-2 font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  {t(`notificationBell.tabs.${tab}`)}
                  {count > 0 && (
                    <span
                      className={cn(
                        'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                        isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

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
        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
        <p className="line-clamp-1 text-xs font-semibold text-black">
          {meta.client_name ?? t('notificationBell.clientNumber', { id: meta.client_id })}
          <span className="ml-1 font-normal text-black">
            ({t('notificationBell.idLabel', { id: meta.client_id })})
          </span>
          <span className="ml-1 font-normal text-black">/ {meta.payment_number}</span>
        </p>
        <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600">
          {t('notificationBell.payment.pending')}
        </span>
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
          {t('notificationBell.payment.daysPending', { count: daysPending })}
        </span>
      </div>
      <p className="w-full min-w-0 truncate text-xs text-black">
        ₴ {Number(meta.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        <span className="ml-2">{translatePaymentMethod(meta.payment_method, t)}</span>
      </p>
      <div className="flex items-center gap-1 text-black">
        <Icons.Clock01 size={11} strokeWidth={1.5} />
        <span className="text-[11px]">
          {meta.recorded_at ? formatDateTime(meta.recorded_at, userTimezone, i18n.language) : '—'}
        </span>
      </div>
    </>
  )
  return (
    <div className="group relative flex border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
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
        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
        {hasClient ? (
          <p className="line-clamp-1 text-xs font-semibold text-black">
            {meta.client_name ?? t('notificationBell.clientNumber', { id: meta.client_id })}
            {meta.client_id && (
              <span className="ml-1 font-normal text-black">
                ({t('notificationBell.idLabel', { id: meta.client_id })})
              </span>
            )}
            {meta.debt_id && (
              <span className="ml-1 font-normal text-black">
                / {t('notificationBell.debtLabel', { id: meta.debt_id })}
              </span>
            )}
          </p>
        ) : (
          <p className="line-clamp-1 text-xs font-semibold text-black">{n.title}</p>
        )}
        {meta.priority && (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium capitalize',
              meta.priority === 'high' && 'bg-red-100 text-red-600',
              meta.priority === 'normal' && 'bg-blue-100 text-blue-600',
              meta.priority === 'low' && 'bg-gray-100 text-gray-500'
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
              meta.status === 'pending' && 'bg-yellow-100 text-yellow-600',
              meta.status === 'in_progress' && 'bg-blue-100 text-blue-600',
              meta.status === 'completed' && 'bg-green-100 text-green-600',
              meta.status === 'extended' && 'bg-purple-100 text-purple-600',
              meta.status === 'rejected' && 'bg-red-100 text-red-600',
              meta.status === 'incoming_line_result' && 'bg-orange-100 text-orange-600'
            )}
          >
            {t(`notificationBell.taskStatus.${meta.status}`, {
              defaultValue: meta.status?.replace(/_/g, ' ') ?? '',
            })}
          </span>
        )}
        {meta.subject_name && !meta.status && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
            {meta.subject_name}
          </span>
        )}
      </div>
      {(meta.description || n.body) && (
        <p className="w-full min-w-0 truncate text-xs text-black">{meta.description || n.body}</p>
      )}
      <div className="flex items-center gap-1 text-black">
        <Icons.Clock01 size={11} strokeWidth={1.5} />
        <span className="text-[11px]">
          {meta.due_date ? formatTaskDueDateForDisplay(meta.due_date, userTimezone) : '—'}
        </span>
      </div>
    </>
  )
  return (
    <div className="group relative flex border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
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
            className="flex h-5 w-5 items-center justify-center rounded text-gray-300 hover:bg-green-50 hover:text-green-600"
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
            className="flex h-5 w-5 items-center justify-center rounded text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          >
            <Icons.StarFilled size={12} strokeWidth={2} />
          </button>
        ) : (
          <button
            type="button"
            aria-label={t('notificationBell.taskActions.starAria', 'Star task')}
            title={t('notificationBell.taskActions.starTitle', 'Star task')}
            onClick={(e) => onStar(e, n.id)}
            className="flex h-5 w-5 items-center justify-center rounded text-yellow-500 hover:bg-yellow-50 hover:text-yellow-600"
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
            className="flex h-5 w-5 items-center justify-center rounded text-gray-300 hover:bg-red-50 hover:text-red-600"
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
        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
        <Icons.Phone size={14} strokeWidth={1.5} className="text-green-500" />
        <p className="text-xs font-semibold text-black">{n.title}</p>
      </div>
      <p className="text-xs text-black">{n.body}</p>
      <span className="text-[11px] text-gray-400">
        {n.created_at ? formatRelativeTime(n.created_at, t) : ''}
      </span>
    </>
  )
  return (
    <div className="group relative flex border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
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
        className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-600"
      >
        <Icons.Cancel01 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

// ─── RR Payment notification item ────────────────────────────────
// Dismiss-only action (operators clear the card; the next poll cycle
// in notification-service handles natural cleanup).

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
        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
        <p className="line-clamp-1 text-xs font-semibold text-black">
          {t('notificationBell.rrPayment.title', { defaultValue: n.title })}
        </p>
        {meta.amount && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
            ₴ {meta.amount}
          </span>
        )}
      </div>
      {n.body && <p className="line-clamp-3 w-full min-w-0 text-xs text-black">{n.body}</p>}
      <div className="flex items-center gap-1 text-black">
        <Icons.Clock01 size={11} strokeWidth={1.5} />
        <span className="text-[11px]">
          {meta.due_date ?? '—'}
          {typeof meta.days_left === 'number' && (
            <span className="ml-1 text-gray-500">
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
    <div className="group relative flex border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
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
        className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-600"
      >
        <Icons.Cancel01 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}
