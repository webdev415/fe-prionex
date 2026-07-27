/**
 * Conversation history panel for the AI assistant page (Claude-style).
 *
 * Renders the saved conversations with a pinned group on top and the rest
 * grouped by activity date (Today / Yesterday / Earlier), with search, a
 * new-chat action, per-item actions (pin, rename, archive) behind a hover
 * kebab / right-click menu, and an archive view toggled from the footer.
 * The desktop variant has a collapse toggle that shrinks the panel into a
 * narrow icon rail; the drawer variant is used inside the mobile overlay and
 * exposes a close button instead.
 *
 * Items are labelled with the user-given `title`, falling back to "Chat #id"
 * while the conversation has no name. All mutations go through a PATCH with
 * an optimistic list update (see useUpdateAssistantConversation).
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  useAssistantConversations,
  useUpdateAssistantConversation,
} from '@/features/aiAssistant/hooks'
import type { AssistantConversationSummary } from '@/features/aiAssistant/api'

const ACTIVE_FILTERS = { limit: 100, archived: false } as const
const ARCHIVED_FILTERS = { limit: 100, archived: true } as const

const MAX_TITLE_LENGTH = 120

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

type ConversationGroupKey = 'pinned' | 'today' | 'yesterday' | 'earlier'

const DATE_GROUP_ORDER: Exclude<ConversationGroupKey, 'pinned'>[] = [
  'today',
  'yesterday',
  'earlier',
]

const GROUP_LABEL_KEYS: Record<ConversationGroupKey, string> = {
  pinned: 'pages.aiAssistant.historyPinned',
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

function groupKeyFor(ts: number, nowTs: number): Exclude<ConversationGroupKey, 'pinned'> {
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
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'

const MENU_ITEM_CLASS =
  'text-foreground flex cursor-pointer items-center gap-2 text-sm font-light data-[highlighted]:bg-muted'

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
  const [showArchived, setShowArchived] = useState(false)
  const [menuId, setMenuId] = useState<number | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const conversationsQuery = useAssistantConversations(
    showArchived ? ARCHIVED_FILTERS : ACTIVE_FILTERS
  )
  const updateMutation = useUpdateAssistantConversation()

  // "Now" reference for grouping/relative labels. Render must stay pure, so
  // instead of Date.now() use the fetch timestamp of the list (refresh on
  // every refetch) with the mount time as the pre-data fallback.
  const [mountTs] = useState(() => Date.now())
  const nowTs = conversationsQuery.dataUpdatedAt || mountTs

  const language = i18n.language

  const conversationLabel = (item: AssistantConversationSummary): string => {
    const title = item.title?.trim()
    return title || t('pages.aiAssistant.historyConversationTitle', { id: item.id })
  }

  const groups = useMemo(() => {
    const items = [...(conversationsQuery.data ?? [])].sort(
      (a, b) => conversationTimestamp(b) - conversationTimestamp(a)
    )
    const query = search.trim().toLowerCase()
    const filtered = query
      ? items.filter((item) => {
          // Search by the user-given title (case-insensitive) and by "#id".
          const haystack = `${item.title ?? ''} #${item.id}`.toLowerCase()
          return haystack.includes(query)
        })
      : items

    const byKey = new Map<ConversationGroupKey, AssistantConversationSummary[]>()
    for (const item of filtered) {
      // The archive view ignores pinning — it is a flat date-grouped list.
      const key: ConversationGroupKey =
        item.pinned && !showArchived ? 'pinned' : groupKeyFor(conversationTimestamp(item), nowTs)
      const bucket = byKey.get(key)
      if (bucket) {
        bucket.push(item)
      } else {
        byKey.set(key, [item])
      }
    }
    const order: ConversationGroupKey[] = ['pinned', ...DATE_GROUP_ORDER]
    return order
      .filter((key) => byKey.has(key))
      .map((key) => ({ key, items: byKey.get(key) as AssistantConversationSummary[] }))
  }, [conversationsQuery.data, search, nowTs, showArchived])

  const hasConversations = (conversationsQuery.data?.length ?? 0) > 0
  const renameTooLong = renameDraft.trim().length > MAX_TITLE_LENGTH

  const notifyUpdateError = () => toast.error(t('pages.aiAssistant.historyUpdateError'))

  const handleTogglePin = (item: AssistantConversationSummary) => {
    updateMutation.mutate(
      { id: item.id, patch: { pinned: !item.pinned } },
      { onError: notifyUpdateError }
    )
  }

  const handleToggleArchived = (item: AssistantConversationSummary) => {
    // Derive the next state from the item itself, not from the view mode —
    // an optimistic update racing a refetch may leave an already-archived
    // item briefly visible in the active list (and vice versa).
    const archived = !item.archived
    updateMutation.mutate({ id: item.id, patch: { archived } }, { onError: notifyUpdateError })
    if (archived && item.id === activeConversationId) {
      // Archiving the open dialog closes it — the page falls back to a new chat.
      onNewChat()
    }
  }

  const startRename = (item: AssistantConversationSummary) => {
    // The row swaps to an inline input, unmounting the menu while it is still
    // open — Radix never reports the close, so drop the state by hand.
    setMenuId(null)
    setRenamingId(item.id)
    setRenameDraft(item.title ?? '')
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameDraft('')
  }

  const commitRename = (item: AssistantConversationSummary) => {
    const title = renameDraft.trim()
    if (title.length > MAX_TITLE_LENGTH) return
    if (!title || title === (item.title ?? '')) {
      cancelRename()
      return
    }
    cancelRename()
    updateMutation.mutate({ id: item.id, patch: { title } }, { onError: notifyUpdateError })
  }

  const switchMode = (archived: boolean) => {
    setShowArchived(archived)
    setSearch('')
    setMenuId(null)
    cancelRename()
  }

  if (variant === 'desktop' && collapsed) {
    return (
      <div
        className={cn(
          'border-border bg-card flex h-full w-14 flex-col items-center gap-1.5 rounded-2xl border py-3 shadow-sm',
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
        <span className="bg-border my-1 h-px w-6" aria-hidden />
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
        'bg-card flex h-full min-h-0 w-full flex-col',
        variant === 'desktop' && 'border-border rounded-2xl border shadow-sm',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-1">
        <span className="text-foreground inline-flex min-w-0 items-center gap-2 text-sm font-medium tracking-tight">
          {showArchived ? (
            <Icons.Archive size={16} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
          ) : (
            <Icons.MessageMultiple01
              size={16}
              strokeWidth={1.5}
              className="text-muted-foreground shrink-0"
            />
          )}
          <span className="truncate">
            {showArchived
              ? t('pages.aiAssistant.historyArchive')
              : t('pages.aiAssistant.historyTitle')}
          </span>
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

      {showArchived ? (
        <div className="px-3 pt-1">
          <button
            type="button"
            data-testid="archive-back"
            onClick={() => switchMode(false)}
            className="border-border text-foreground hover:bg-muted bg-card flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-light transition-colors"
          >
            <Icons.ArrowLeft size={16} strokeWidth={1.5} />
            {t('pages.aiAssistant.historyBackToChats')}
          </button>
        </div>
      ) : (
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
      )}

      <div className="px-3 pt-2 pb-1">
        <div className="border-border bg-muted/60 focus-within:border-primary-300 flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors">
          <Icons.Search size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('pages.aiAssistant.historySearchPlaceholder')}
            aria-label={t('pages.aiAssistant.historySearchPlaceholder')}
            className="text-foreground placeholder:text-muted-foreground w-full min-w-0 border-0 bg-transparent text-sm font-light focus:outline-none"
          />
        </div>
      </div>

      <div className="ai-chat-input-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2">
        {conversationsQuery.isPending && (
          <div className="space-y-2 px-1 pt-1" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="bg-muted h-12 animate-pulse rounded-xl" />
            ))}
          </div>
        )}

        {conversationsQuery.isError && (
          <div className="flex flex-col items-start gap-2 px-2 pt-2">
            <p className="text-muted-foreground text-xs leading-snug font-light">
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
          <div className="flex flex-col items-center gap-2 px-2 pt-8 text-center">
            {showArchived ? (
              <Icons.Archive size={24} strokeWidth={1} className="text-muted-foreground/60" />
            ) : (
              <Icons.MessageMultiple01
                size={24}
                strokeWidth={1}
                className="text-muted-foreground/60"
              />
            )}
            <p className="text-muted-foreground text-xs leading-snug font-light">
              {showArchived
                ? t('pages.aiAssistant.historyArchiveEmpty')
                : t('pages.aiAssistant.historyEmpty')}
            </p>
          </div>
        )}

        {conversationsQuery.isSuccess && hasConversations && groups.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-2 pt-8 text-center">
            <Icons.Search size={24} strokeWidth={1} className="text-muted-foreground/60" />
            <p className="text-muted-foreground text-xs leading-snug font-light">
              {t('pages.aiAssistant.historyNoResults')}
            </p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.key}>
            <p className="text-muted-foreground inline-flex items-center gap-1 px-2 pt-3 pb-1 text-[11px] font-medium tracking-wide uppercase first:pt-1">
              {group.key === 'pinned' && <Icons.Pin size={11} strokeWidth={2} aria-hidden />}
              {t(GROUP_LABEL_KEYS[group.key])}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const ts = conversationTimestamp(item)
                const isActive = item.id === activeConversationId
                const isRenaming = item.id === renamingId

                if (isRenaming) {
                  return (
                    <li key={item.id}>
                      <div
                        className={cn(
                          'bg-card rounded-xl border px-3 py-2',
                          renameTooLong ? 'border-error-300' : 'border-primary-300'
                        )}
                      >
                        <input
                          type="text"
                          // Focus the editor as soon as it mounts and select
                          // the current name so typing replaces it (the
                          // jsx-a11y/no-autofocus-safe equivalent: this is a
                          // user-initiated inline edit, not a page landing).
                          ref={(node) => {
                            if (node && document.activeElement !== node) {
                              node.focus()
                              node.select()
                            }
                          }}
                          value={renameDraft}
                          data-testid="conversation-rename-input"
                          aria-label={t('pages.aiAssistant.historyRename')}
                          placeholder={t('pages.aiAssistant.historyRenamePlaceholder')}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              commitRename(item)
                            } else if (event.key === 'Escape') {
                              event.preventDefault()
                              cancelRename()
                            }
                          }}
                          onBlur={cancelRename}
                          className="text-foreground placeholder:text-muted-foreground w-full min-w-0 border-0 bg-transparent text-sm font-light focus:outline-none"
                        />
                        {renameTooLong && (
                          <p className="text-error-600 pt-0.5 text-[11px] font-light">
                            {t('pages.aiAssistant.historyRenameTooLong', {
                              max: MAX_TITLE_LENGTH,
                            })}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                }

                return (
                  <li key={item.id} className="group/convo relative">
                    <button
                      type="button"
                      data-testid={`conversation-item-${item.id}`}
                      aria-current={isActive ? 'true' : undefined}
                      onClick={() => onSelectConversation(item.id)}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setMenuId(item.id)
                      }}
                      title={new Date(ts).toLocaleString(language || 'en')}
                      className={cn(
                        'flex w-full cursor-pointer flex-col gap-0.5 rounded-xl border py-2 pr-9 pl-3 text-left transition-colors',
                        isActive
                          ? 'border-primary-200 bg-primary-50'
                          : 'hover:bg-muted border-transparent'
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={cn(
                            'min-w-0 truncate text-sm font-light',
                            isActive ? 'text-primary-700' : 'text-foreground'
                          )}
                        >
                          {conversationLabel(item)}
                        </span>
                        {item.pinned && !showArchived && (
                          <Icons.Pin
                            size={12}
                            strokeWidth={1.5}
                            aria-hidden
                            className={cn(
                              'shrink-0',
                              isActive ? 'text-primary-500' : 'text-muted-foreground'
                            )}
                          />
                        )}
                      </span>
                      <span className="text-muted-foreground truncate text-[11px] font-light">
                        {formatDateTime(ts, nowTs, language)}
                        {' · '}
                        {formatRelativeTime(ts, nowTs, language)}
                      </span>
                    </button>

                    <DropdownMenu
                      modal={false}
                      open={menuId === item.id}
                      onOpenChange={(open) => setMenuId(open ? item.id : null)}
                    >
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          data-testid={`conversation-menu-${item.id}`}
                          aria-label={t('pages.aiAssistant.historyMenuAria')}
                          className={cn(
                            'text-muted-foreground absolute top-1/2 right-1.5 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg opacity-0 transition-opacity',
                            'hover:bg-muted hover:text-foreground group-hover/convo:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
                            isActive && 'opacity-100'
                          )}
                        >
                          <Icons.MoreVertical size={15} strokeWidth={1.5} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="bg-card w-48">
                        {!showArchived && (
                          <DropdownMenuItem
                            className={MENU_ITEM_CLASS}
                            onSelect={() => handleTogglePin(item)}
                          >
                            {item.pinned ? (
                              <>
                                <Icons.PinOff size={14} strokeWidth={1.5} />
                                {t('pages.aiAssistant.historyUnpin')}
                              </>
                            ) : (
                              <>
                                <Icons.Pin size={14} strokeWidth={1.5} />
                                {t('pages.aiAssistant.historyPin')}
                              </>
                            )}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className={MENU_ITEM_CLASS}
                          onSelect={() => startRename(item)}
                        >
                          <Icons.PencilEdit size={14} strokeWidth={1.5} />
                          {t('pages.aiAssistant.historyRename')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-muted" />
                        <DropdownMenuItem
                          className={MENU_ITEM_CLASS}
                          onSelect={() => handleToggleArchived(item)}
                        >
                          {item.archived ? (
                            <>
                              <Icons.Unarchive size={14} strokeWidth={1.5} />
                              {t('pages.aiAssistant.historyUnarchiveAction')}
                            </>
                          ) : (
                            <>
                              <Icons.Archive size={14} strokeWidth={1.5} />
                              {t('pages.aiAssistant.historyArchiveAction')}
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-border/80 border-t px-3 py-2">
        <button
          type="button"
          data-testid="archive-toggle"
          aria-pressed={showArchived}
          onClick={() => switchMode(!showArchived)}
          className={cn(
            'flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-light transition-colors',
            showArchived
              ? 'bg-primary-50 text-primary-700'
              : 'hover:bg-muted hover:text-foreground text-muted-foreground'
          )}
        >
          <Icons.Archive size={16} strokeWidth={1.5} />
          {t('pages.aiAssistant.historyArchive')}
        </button>
      </div>
    </div>
  )
}
