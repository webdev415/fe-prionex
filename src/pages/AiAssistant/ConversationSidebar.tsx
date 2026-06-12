/**
 * Conversation history panel for the AI assistant page (Claude-style).
 *
 * Renders the saved conversations grouped by activity date (Today /
 * Yesterday / Earlier), with search, a new-chat action and — in the desktop
 * variant — a collapse toggle that shrinks the panel into a narrow icon rail.
 * The drawer variant is used inside the mobile overlay and exposes a close
 * button instead of the collapse toggle.
 *
 * The backend conversation summary carries no title/preview text, so items
 * are labelled "Chat #id" with absolute + relative timestamps. Once the API
 * exposes a title (first user message preview), only `conversationLabel`
 * below needs to change.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useAssistantConversations } from '@/features/aiAssistant/hooks'
import type { AssistantConversationSummary } from '@/features/aiAssistant/api'

const CONVERSATIONS_FILTERS = { limit: 100 } as const

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export type ConversationSidebarProps = {
  activeConversationId: number | null
  onSelectConversation: (id: number) => void
  onNewChat: () => void
  /** Desktop only: render the narrow icon rail instead of the full panel. */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  variant?: 'desktop' | 'drawer'
  /** Drawer only: close the overlay. */
  onClose?: () => void
  className?: string
}

type ConversationGroupKey = 'today' | 'yesterday' | 'earlier'

const GROUP_ORDER: ConversationGroupKey[] = ['today', 'yesterday', 'earlier']

const GROUP_LABEL_KEYS: Record<ConversationGroupKey, string> = {
  today: 'pages.aiAssistant.historyToday',
  yesterday: 'pages.aiAssistant.historyYesterday',
  earlier: 'pages.aiAssistant.historyEarlier',
}

function conversationTimestamp(conversation: AssistantConversationSummary): number {
  return new Date(conversation.last_message_at ?? conversation.created_at).getTime()
}

function startOfDay(ts: number): number {
  const date = new Date(ts)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function groupKeyFor(ts: number, nowTs: number): ConversationGroupKey {
  const todayStart = startOfDay(nowTs)
  if (ts >= todayStart) return 'today'
  if (ts >= todayStart - DAY) return 'yesterday'
  return 'earlier'
}

function formatRelativeTime(ts: number, nowTs: number, language: string): string {
  const formatter = new Intl.RelativeTimeFormat(language || 'en', { numeric: 'auto' })
  const diff = ts - nowTs
  const minutes = Math.round(diff / MINUTE)
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute')
  const hours = Math.round(diff / HOUR)
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour')
  const days = Math.round(diff / DAY)
  if (Math.abs(days) < 30) return formatter.format(days, 'day')
  return formatter.format(Math.round(days / 30), 'month')
}

function formatDateTime(ts: number, nowTs: number, language: string): string {
  const date = new Date(ts)
  const time = date.toLocaleTimeString(language || 'en', { hour: '2-digit', minute: '2-digit' })
  if (startOfDay(ts) === startOfDay(nowTs)) return time
  const day = date.toLocaleDateString(language || 'en', { day: '2-digit', month: '2-digit' })
  return `${day} ${time}`
}

const ICON_BUTTON_CLASS =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-light-100 hover:text-dark-500'

export function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewChat,
  collapsed = false,
  onCollapsedChange,
  variant = 'desktop',
  onClose,
  className,
}: ConversationSidebarProps) {
  const { t, i18n } = useTranslation('common')
  const [search, setSearch] = useState('')
  const conversationsQuery = useAssistantConversations(CONVERSATIONS_FILTERS)

  // "Now" reference for grouping/relative labels. Render must stay pure, so
  // instead of Date.now() use the fetch timestamp of the list (refresh on
  // every refetch) with the mount time as the pre-data fallback.
  const [mountTs] = useState(() => Date.now())
  const nowTs = conversationsQuery.dataUpdatedAt || mountTs

  const language = i18n.language

  const groups = useMemo(() => {
    const items = [...(conversationsQuery.data ?? [])].sort(
      (a, b) => conversationTimestamp(b) - conversationTimestamp(a)
    )
    const query = search.trim().toLowerCase()
    const filtered = query
      ? items.filter((item) => {
          const ts = conversationTimestamp(item)
          const haystack =
            `#${item.id} ${formatDateTime(ts, nowTs, language)} ${formatRelativeTime(ts, nowTs, language)}`.toLowerCase()
          return haystack.includes(query)
        })
      : items

    const byKey = new Map<ConversationGroupKey, AssistantConversationSummary[]>()
    for (const item of filtered) {
      const key = groupKeyFor(conversationTimestamp(item), nowTs)
      const bucket = byKey.get(key)
      if (bucket) {
        bucket.push(item)
      } else {
        byKey.set(key, [item])
      }
    }
    return GROUP_ORDER.filter((key) => byKey.has(key)).map((key) => ({
      key,
      items: byKey.get(key) as AssistantConversationSummary[],
    }))
  }, [conversationsQuery.data, search, nowTs, language])

  const hasConversations = (conversationsQuery.data?.length ?? 0) > 0

  if (variant === 'desktop' && collapsed) {
    return (
      <div
        className={cn(
          'border-light-200 flex h-full w-14 flex-col items-center gap-1.5 rounded-2xl border bg-white py-3 shadow-sm',
          className
        )}
      >
        <button
          type="button"
          aria-label={t('pages.aiAssistant.historyExpandAria')}
          onClick={() => onCollapsedChange?.(false)}
          className={ICON_BUTTON_CLASS}
        >
          <Icons.ArrowRight size={16} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label={t('pages.aiAssistant.historyNewChat')}
          onClick={onNewChat}
          className={cn(ICON_BUTTON_CLASS, 'text-primary-600 hover:text-primary-700')}
        >
          <Icons.BubbleChatEdit size={16} strokeWidth={1.5} />
        </button>
        <span className="bg-light-200 my-1 h-px w-6" aria-hidden />
        <button
          type="button"
          aria-label={t('pages.aiAssistant.historyTitle')}
          onClick={() => onCollapsedChange?.(false)}
          className={ICON_BUTTON_CLASS}
        >
          <Icons.MessageMultiple01 size={16} strokeWidth={1.5} />
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full flex-col bg-white',
        variant === 'desktop' && 'border-light-200 rounded-2xl border shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1">
        <span className="text-dark-500 inline-flex min-w-0 items-center gap-2 text-sm font-medium tracking-tight">
          <Icons.MessageMultiple01 size={16} strokeWidth={1.5} className="shrink-0 text-gray-400" />
          <span className="truncate">{t('pages.aiAssistant.historyTitle')}</span>
        </span>
        {variant === 'desktop' ? (
          <button
            type="button"
            aria-label={t('pages.aiAssistant.historyCollapseAria')}
            onClick={() => onCollapsedChange?.(true)}
            className={ICON_BUTTON_CLASS}
          >
            <Icons.ArrowLeft size={16} strokeWidth={1.5} />
          </button>
        ) : (
          <button
            type="button"
            aria-label={t('pages.aiAssistant.historyCloseAria')}
            onClick={onClose}
            className={ICON_BUTTON_CLASS}
          >
            <Icons.Close size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div className="px-3 pt-1">
        <button
          type="button"
          onClick={onNewChat}
          className="border-primary-200/70 bg-primary-50/70 text-primary-700 hover:bg-primary-100/70 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-light transition-colors"
        >
          <Icons.BubbleChatEdit size={16} strokeWidth={1.5} />
          {t('pages.aiAssistant.historyNewChat')}
        </button>
      </div>

      <div className="px-3 pt-2 pb-1">
        <div className="border-light-200 bg-light-50/60 focus-within:border-primary-300 flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors">
          <Icons.Search size={14} strokeWidth={1.5} className="shrink-0 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('pages.aiAssistant.historySearchPlaceholder')}
            aria-label={t('pages.aiAssistant.historySearchPlaceholder')}
            className="text-dark-500 w-full min-w-0 border-0 bg-transparent text-sm font-light placeholder:text-gray-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="ai-chat-input-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2">
        {conversationsQuery.isPending && (
          <div className="space-y-2 px-1 pt-1" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="bg-light-100 h-12 animate-pulse rounded-xl" />
            ))}
          </div>
        )}

        {conversationsQuery.isError && (
          <div className="flex flex-col items-start gap-2 px-2 pt-2">
            <p className="text-xs leading-snug font-light text-gray-500">
              {t('pages.aiAssistant.historyLoadError')}
            </p>
            <button
              type="button"
              onClick={() => void conversationsQuery.refetch()}
              className="text-primary-600 hover:text-primary-700 inline-flex cursor-pointer items-center gap-1 text-xs font-medium"
            >
              <Icons.Reload size={12} strokeWidth={1.5} />
              {t('pages.aiAssistant.historyRetry')}
            </button>
          </div>
        )}

        {conversationsQuery.isSuccess && !hasConversations && (
          <p className="px-2 pt-2 text-xs leading-snug font-light text-gray-400">
            {t('pages.aiAssistant.historyEmpty')}
          </p>
        )}

        {conversationsQuery.isSuccess && hasConversations && groups.length === 0 && (
          <p className="px-2 pt-2 text-xs leading-snug font-light text-gray-400">
            {t('pages.aiAssistant.historyNoResults')}
          </p>
        )}

        {groups.map((group) => (
          <div key={group.key}>
            <p className="px-2 pt-3 pb-1 text-[11px] font-medium tracking-wide text-gray-400 uppercase first:pt-1">
              {t(GROUP_LABEL_KEYS[group.key])}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const ts = conversationTimestamp(item)
                const isActive = item.id === activeConversationId
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid={`conversation-item-${item.id}`}
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => onSelectConversation(item.id)}
                      title={new Date(ts).toLocaleString(language || 'en')}
                      className={cn(
                        'flex w-full cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors',
                        isActive
                          ? 'border-primary-200 bg-primary-50'
                          : 'hover:bg-light-50 border-transparent'
                      )}
                    >
                      <span
                        className={cn(
                          'truncate text-sm font-light',
                          isActive ? 'text-primary-700' : 'text-dark-500'
                        )}
                      >
                        {t('pages.aiAssistant.historyConversationTitle', { id: item.id })}
                      </span>
                      <span className="truncate text-[11px] font-light text-gray-400">
                        {formatDateTime(ts, nowTs, language)}
                        {' · '}
                        {formatRelativeTime(ts, nowTs, language)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
