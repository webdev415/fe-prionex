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
import { useNavigate } from 'react-router-dom'
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
} from '@/features/notifications/hooks/useNotifications'
import { useNotificationSocket } from '@/features/notifications/hooks/useNotificationSocket'
import { NotificationType } from '@/features/notifications/types'
import type { NotificationItem } from '@/features/notifications/types'

function formatDateTime(isoDate: string, timezone?: string): string {
  try {
    // Convention: DB stores UTC. Naive strings (no Z/offset) are interpreted
    // as UTC; we display in the user's profile timezone.
    let dateStr = isoDate.replace(' ', 'T')
    if (!dateStr.endsWith('Z') && !/[-+]\d{2}:\d{2}$/.test(dateStr)) {
      dateStr += 'Z'
    }
    const tz = timezone ?? 'UTC'
    const parts = new Intl.DateTimeFormat('en-GB', {
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

function formatRelativeTime(isoDate: string): string {
  try {
    const date = new Date(isoDate)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin} min ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDays = Math.floor(diffHr / 24)
    return `${diffDays}d ago`
  } catch {
    return isoDate
  }
}

export function NotificationBell() {
  const navigate = useNavigate()
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
      const t = setTimeout(() => {
        setIsShaking(true)
        setTimeout(() => setIsShaking(false), 900)
      }, 0)
      return () => clearTimeout(t)
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

  // Group notifications by type for section headers
  const paymentNotifications = notifications.filter(
    (n) => n.type === NotificationType.PAYMENT_PENDING
  )
  const taskNotifications = notifications.filter((n) => n.type === NotificationType.TASK_OVERDUE)
  const callNotifications = notifications.filter(
    (n) =>
      n.type === NotificationType.INCOMING_CALL || n.type === NotificationType.CALLBACK_REQUESTED
  )
  const tagNotifications = notifications.filter(
    (n) =>
      n.type === NotificationType.TAG_ASSIGNED ||
      n.type === NotificationType.TAG_REMOVED ||
      n.type === NotificationType.TAG_EXPIRED
  )
  const taChainNotifications = notifications.filter(
    (n) => n.type === NotificationType.TA_CHAIN_CREATED
  )

  const markAsReadMutation = useMarkAsRead()

  const handleNavigate = (
    notificationId: string,
    clientId: number | undefined,
    isRead: boolean
  ) => {
    if (!isRead) {
      markAsReadMutation.mutate(notificationId)
    }
    if (clientId) {
      navigate(`/dashboard/clients/${clientId}`)
      setIsOpen(false)
    }
  }

  const handleDismiss = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    try {
      await dismissMutation.mutateAsync(notificationId)
    } catch {
      toast.error('Failed to dismiss notification')
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Bell button */}
      <button
        type="button"
        aria-label={`Notifications${hasNotifications ? ` (${count})` : ''}`}
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
            <span className="text-dark-500 text-sm font-semibold">Notifications</span>
            <div className="flex items-center gap-2">
              {hasNotifications && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      markAllReadMutation.mutate(undefined, {
                        onError: () => toast.error('Failed to mark all as read'),
                      })
                    }
                    className="text-[10px] font-medium text-blue-500 hover:text-blue-700"
                  >
                    Mark all read
                  </button>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                    {count}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-gray-300">
                <Icons.Bell size={28} strokeWidth={1.5} />
                <p className="text-xs text-gray-400">No notifications</p>
              </div>
            ) : (
              <>
                {/* Pending Payments section */}
                {paymentNotifications.length > 0 && (
                  <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold text-black">
                    Pending Payments
                  </div>
                )}
                {paymentNotifications.map((n) => (
                  <PaymentNotificationItem
                    key={n.id}
                    notification={n}
                    userTimezone={userTimezone}
                    onNavigate={handleNavigate}
                  />
                ))}

                {/* Tasks section */}
                {taskNotifications.length > 0 && (
                  <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold text-black">
                    Tasks
                  </div>
                )}
                {taskNotifications.map((n) => (
                  <TaskNotificationItem
                    key={n.id}
                    notification={n}
                    onNavigate={handleNavigate}
                    onDismiss={handleDismiss}
                    userTimezone={userTimezone}
                  />
                ))}

                {/* Calls section */}
                {callNotifications.length > 0 && (
                  <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold text-black">
                    Calls
                  </div>
                )}
                {callNotifications.map((n) => (
                  <CallNotificationItem
                    key={n.id}
                    notification={n}
                    onNavigate={handleNavigate}
                    onDismiss={handleDismiss}
                  />
                ))}

                {/* Tags section */}
                {tagNotifications.length > 0 && (
                  <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold text-black">
                    Tags
                  </div>
                )}
                {tagNotifications.map((n) => (
                  <TagNotificationItem
                    key={n.id}
                    notification={n}
                    onNavigate={handleNavigate}
                    onDismiss={handleDismiss}
                  />
                ))}

                {/* TA Chains section */}
                {taChainNotifications.length > 0 && (
                  <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold text-black">
                    TA Chains
                  </div>
                )}
                {taChainNotifications.map((n) => (
                  <TaChainNotificationItem
                    key={n.id}
                    notification={n}
                    onNavigate={handleNavigate}
                    onDismiss={handleDismiss}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared types for sub-components ─────────────────────────────

type NavigateFn = (notificationId: string, clientId: number | undefined, isRead: boolean) => void
type DismissFn = (e: React.MouseEvent, id: string) => void

// ─── Payment notification item (no dismiss — auto-dismissed on verify/cancel) ──

function PaymentNotificationItem({
  notification: n,
  userTimezone,
  onNavigate,
}: {
  notification: NotificationItem
  userTimezone?: string
  onNavigate: NavigateFn
}) {
  const meta = n.metadata
  return (
    <div className="group relative flex border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
      <button
        type="button"
        disabled={!meta.client_id}
        onClick={() => onNavigate(n.id, meta.client_id, n.read)}
        className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left disabled:cursor-default"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
          <p className="line-clamp-1 text-xs font-semibold text-black">
            {meta.client_name ?? `Client #${meta.client_id}`}
            <span className="ml-1 font-normal text-black">(ID: {meta.client_id})</span>
            <span className="ml-1 font-normal text-black">/ {meta.payment_number}</span>
          </p>
          <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-600">
            pending
          </span>
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
            {meta.days_pending}d
          </span>
        </div>
        <p className="w-full min-w-0 truncate text-xs text-black">
          ₴ {Number(meta.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          <span className="ml-2 uppercase">{meta.payment_method}</span>
        </p>
        <div className="flex items-center gap-1 text-black">
          <Icons.Clock01 size={11} strokeWidth={1.5} />
          <span className="text-[11px]">
            {meta.recorded_at ? formatDateTime(meta.recorded_at, userTimezone) : '—'}
          </span>
        </div>
      </button>
    </div>
  )
}

// ─── Task notification item ──────────────────────────────────────

function TaskNotificationItem({
  notification: n,
  onNavigate,
  onDismiss,
  userTimezone,
}: {
  notification: NotificationItem
  onNavigate: NavigateFn
  onDismiss: DismissFn
  userTimezone?: string
}) {
  const meta = n.metadata
  return (
    <div className="group relative flex border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
      <button
        type="button"
        disabled={!meta.client_id}
        onClick={() => onNavigate(n.id, meta.client_id, n.read)}
        className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left disabled:cursor-default"
      >
        <div className="flex flex-wrap items-center gap-1.5 pr-5">
          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
          <p className="line-clamp-1 text-xs font-semibold text-black">
            {meta.client_name ?? `Client #${meta.client_id}`}
            {meta.client_id && (
              <span className="ml-1 font-normal text-black">(ID: {meta.client_id})</span>
            )}
            {meta.debt_id && (
              <span className="ml-1 font-normal text-black">/ Debt: {meta.debt_id}</span>
            )}
          </p>
          {meta.priority && (
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-medium capitalize',
                meta.priority === 'high' && 'bg-red-100 text-red-600',
                meta.priority === 'normal' && 'bg-blue-100 text-blue-600',
                meta.priority === 'low' && 'bg-gray-100 text-gray-500'
              )}
            >
              {meta.priority}
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
              {meta.status?.replace(/_/g, ' ')}
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
      </button>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => onDismiss(e, n.id)}
        className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-600"
      >
        <Icons.Cancel01 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

// ─── Call notification item ──────────────────────────────────────

function CallNotificationItem({
  notification: n,
  onNavigate,
  onDismiss,
}: {
  notification: NotificationItem
  onNavigate: NavigateFn
  onDismiss: DismissFn
}) {
  const meta = n.metadata
  return (
    <div className="group relative flex border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
      <button
        type="button"
        disabled={!meta.client_id}
        onClick={() => onNavigate(n.id, meta.client_id, n.read)}
        className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left disabled:cursor-default"
      >
        <div className="flex items-center gap-2">
          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
          <Icons.Phone size={14} strokeWidth={1.5} className="text-green-500" />
          <p className="text-xs font-semibold text-black">{n.title}</p>
        </div>
        <p className="text-xs text-black">{n.body}</p>
        <span className="text-[11px] text-gray-400">
          {n.created_at ? formatRelativeTime(n.created_at) : ''}
        </span>
      </button>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => onDismiss(e, n.id)}
        className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-600"
      >
        <Icons.Cancel01 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

// ─── Tag notification item ───────────────────────────────────────

function TagNotificationItem({
  notification: n,
  onNavigate,
  onDismiss,
}: {
  notification: NotificationItem
  onNavigate: NavigateFn
  onDismiss: DismissFn
}) {
  const meta = n.metadata
  return (
    <div className="group relative flex border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
      <button
        type="button"
        disabled={!meta.client_id}
        onClick={() => onNavigate(n.id, meta.client_id, n.read)}
        className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left disabled:cursor-default"
      >
        <div className="flex items-center gap-2">
          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
          <Icons.Bell size={14} strokeWidth={1.5} className="text-purple-500" />
          <p className="text-xs font-semibold text-black">{n.title}</p>
        </div>
        {n.body && <p className="text-xs text-black">{n.body}</p>}
        <span className="text-[11px] text-gray-400">
          {n.created_at ? formatRelativeTime(n.created_at) : ''}
        </span>
      </button>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => onDismiss(e, n.id)}
        className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-600"
      >
        <Icons.Cancel01 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}

// ─── TA Chain notification item ──────────────────────────────────

function TaChainNotificationItem({
  notification: n,
  onNavigate,
  onDismiss,
}: {
  notification: NotificationItem
  onNavigate: NavigateFn
  onDismiss: DismissFn
}) {
  const meta = n.metadata
  return (
    <div className="group relative flex border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50">
      <button
        type="button"
        disabled={!meta.client_id}
        onClick={() => onNavigate(n.id, meta.client_id, n.read)}
        className="flex min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left disabled:cursor-default"
      >
        <div className="flex items-center gap-2 pr-5">
          {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
          <Icons.Bell size={14} strokeWidth={1.5} className="text-emerald-600" />
          <p className="line-clamp-1 text-xs font-semibold text-black">
            {meta.client_name ?? `Client #${meta.client_id}`}
            {meta.client_id && (
              <span className="ml-1 font-normal text-black">(ID: {meta.client_id})</span>
            )}
          </p>
        </div>
        {meta.chain_name && (
          <p className="line-clamp-1 text-xs text-black">
            <span className="font-medium">Chain:</span> {meta.chain_name}
          </p>
        )}
        {meta.result_name && (
          <p className="line-clamp-1 text-xs text-black">
            <span className="font-medium">Result:</span>{' '}
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              {meta.result_name}
            </span>
          </p>
        )}
        {meta.operator_name && (
          <p className="line-clamp-1 text-[11px] text-gray-500">by {meta.operator_name}</p>
        )}
        <span className="text-[11px] text-gray-400">
          {n.created_at ? formatRelativeTime(n.created_at) : ''}
        </span>
      </button>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => onDismiss(e, n.id)}
        className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-600"
      >
        <Icons.Cancel01 size={12} strokeWidth={2} />
      </button>
    </div>
  )
}
