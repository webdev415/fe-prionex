import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import type { IncomingFolder, IncomingMailboxFilter, LetterListItem } from '../../types'
import { LetterListItem as LetterListItemRow } from './LetterListItem'

// ─── Config ───────────────────────────────────────────────────────────────────

const FOLDERS: { id: IncomingFolder; labelKey: string; icon: React.ReactElement }[] = [
  {
    id: 'inbox',
    labelKey: 'pages.lawyerWorkplace.folders.inbox',
    icon: <Icons.InboxIcon size={16} strokeWidth={1.5} />,
  },
  {
    id: 'quarantine',
    labelKey: 'pages.lawyerWorkplace.folders.quarantine',
    icon: <Icons.KanbanIcon size={16} strokeWidth={1.5} />,
  },
  {
    id: 'sent',
    labelKey: 'pages.lawyerWorkplace.folders.sent',
    icon: <Icons.MailSend01 size={16} strokeWidth={1.5} />,
  },
]

const FILTERS: { id: IncomingMailboxFilter; labelKey: string; fallback: string }[] = [
  { id: 'all', labelKey: 'pages.lawyerWorkplace.filters.allMailboxes', fallback: 'All' },
  { id: 'new', labelKey: 'pages.lawyerWorkplace.filters.new', fallback: 'New' },
  {
    id: 'in_progress',
    labelKey: 'pages.lawyerWorkplace.filters.inProgress',
    fallback: 'In progress',
  },
  { id: 'done', labelKey: 'pages.lawyerWorkplace.filters.done', fallback: 'Done' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CountPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted text-foreground rounded-full px-2.5 py-0.5 text-[11px]">
      {children}
    </span>
  )
}

function NumBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        'flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] leading-none',
        active ? 'bg-white/20 text-white' : 'text-foreground bg-muted'
      )}
    >
      {count}
    </span>
  )
}

function IncomingListSkeleton() {
  const { t } = useTranslation('common')

  return (
    <div className="px-3 py-2" role="status" aria-busy="true">
      <span className="sr-only">
        {t('pages.lawyerWorkplace.incoming.loading', 'Loading letters…')}
      </span>
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="border-border mx-0 my-2 animate-pulse rounded-[12px] border p-3.5"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="bg-muted h-3.5 w-32 rounded" />
            <div className="bg-muted h-3 w-12 rounded" />
          </div>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="bg-muted h-3 w-full max-w-[220px] rounded" />
            <div className="bg-muted h-5 w-16 rounded-full" />
          </div>
          <div className="bg-muted mb-2 h-3.5 w-full max-w-[280px] rounded" />
          <div className="flex gap-1.5">
            <div className="bg-muted h-5 w-20 rounded-full" />
            <div className="bg-muted h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface IncomingEmptyStateConfig {
  icon: React.ReactElement
  title: string
  description: string
}

function getIncomingEmptyState(
  activeFolder: IncomingFolder,
  activeFilter: IncomingMailboxFilter,
  committedSearch: string,
  t: TFunction
): IncomingEmptyStateConfig {
  if (committedSearch.trim()) {
    return {
      icon: <Icons.Search size={22} strokeWidth={1.5} className="text-muted-foreground" />,
      title: t('pages.lawyerWorkplace.incoming.empty.search.title', 'No matching letters'),
      description: t(
        'pages.lawyerWorkplace.incoming.empty.search.description',
        'Try a different search term or clear the search to see all letters.'
      ),
    }
  }

  if (activeFilter !== 'all') {
    const filterMeta = FILTERS.find((filter) => filter.id === activeFilter)
    const filterLabel = filterMeta
      ? t(filterMeta.labelKey, filterMeta.fallback)
      : t('pages.lawyerWorkplace.filters.allMailboxes', 'All mailboxes')

    return {
      icon: <Icons.Filter size={22} strokeWidth={1.5} className="text-muted-foreground" />,
      title: t('pages.lawyerWorkplace.incoming.empty.filter.title', 'No letters in this view'),
      description: t('pages.lawyerWorkplace.incoming.empty.filter.description', {
        filter: filterLabel,
        defaultValue: `Nothing matches the «${filterLabel}» filter. Try another status or show all mailboxes.`,
      }),
    }
  }

  const folderIcon =
    activeFolder === 'inbox' ? (
      <Icons.InboxIcon size={22} strokeWidth={1.5} className="text-muted-foreground" />
    ) : activeFolder === 'quarantine' ? (
      <Icons.KanbanIcon size={22} strokeWidth={1.5} className="text-muted-foreground" />
    ) : (
      <Icons.MailSend01 size={22} strokeWidth={1.5} className="text-muted-foreground" />
    )

  return {
    icon: folderIcon,
    title: t(`pages.lawyerWorkplace.incoming.empty.folders.${activeFolder}.title`, {
      defaultValue:
        activeFolder === 'inbox'
          ? 'Inbox is empty'
          : activeFolder === 'quarantine'
            ? 'No quarantined letters'
            : 'No sent letters',
    }),
    description: t(`pages.lawyerWorkplace.incoming.empty.folders.${activeFolder}.description`, {
      defaultValue:
        activeFolder === 'inbox'
          ? 'Synced letters from your mailboxes will show up here. You can also compose a new outgoing letter.'
          : activeFolder === 'quarantine'
            ? 'Letters held for review before processing appear in this folder.'
            : 'Outgoing letters and replies sent from the workplace appear here.',
    }),
  }
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export interface IncomingListPanelProps {
  letters: LetterListItem[]
  selectedLetterId: string | null
  activeFolder: IncomingFolder
  activeFilter: IncomingMailboxFilter
  unprocessedCount: number
  isLoading?: boolean
  isError?: boolean
  onRetry?: () => void
  // Pagination
  page: number
  totalPages: number
  total: number
  // Filter counts (from API)
  countAll: number
  countNew: number
  countInProgress: number
  countDone: number
  // Committed search (already sent to backend)
  committedSearch: string
  onFolderChange: (folder: IncomingFolder) => void
  onFilterChange: (filter: IncomingMailboxFilter) => void
  onPageChange: (page: number) => void
  onSearchCommit: (query: string) => void
  onSelectLetter: (letterId: string) => void
  onNewLetter: () => void
}

export function IncomingListPanel({
  letters,
  selectedLetterId,
  activeFolder,
  activeFilter,
  unprocessedCount,
  isLoading = false,
  isError = false,
  onRetry,
  page,
  totalPages,
  total,
  countAll,
  countNew,
  countInProgress,
  countDone,
  committedSearch,
  onFolderChange,
  onFilterChange,
  onPageChange,
  onSearchCommit,
  onSelectLetter,
  onNewLetter,
}: IncomingListPanelProps) {
  const { t } = useTranslation('common')

  // Local draft of search — committed only on button click or Enter
  const [searchDraft, setSearchDraft] = useState(committedSearch)

  // Keep draft in sync if parent resets committedSearch externally (e.g. folder change)
  useEffect(() => {
    setSearchDraft(committedSearch)
  }, [committedSearch])

  const handleSearchSubmit = () => {
    onSearchCommit(searchDraft)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearchSubmit()
    if (e.key === 'Escape') {
      setSearchDraft('')
      onSearchCommit('')
    }
  }

  const handleClearSearch = () => {
    setSearchDraft('')
    onSearchCommit('')
  }

  // Count for each filter tab
  const filterCount = (id: IncomingMailboxFilter) => {
    if (id === 'new') return countNew
    if (id === 'in_progress') return countInProgress
    if (id === 'done') return countDone
    return countAll
  }

  // ── Scroll arrows ──────────────────────────────────────────────────────────
  const listRef = useRef<HTMLDivElement>(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(false)

  const syncScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    setCanScrollUp(el.scrollTop > 4)
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const frame = requestAnimationFrame(syncScroll)
    el.addEventListener('scroll', syncScroll, { passive: true })
    const ro = new ResizeObserver(syncScroll)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', syncScroll)
      ro.disconnect()
    }
  }, [syncScroll, letters])

  const rafRef = useRef<number | null>(null)
  const scrollBy = useCallback((delta: number) => {
    const el = listRef.current
    if (!el) return
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const startTop = el.scrollTop
    const endTop = Math.max(0, Math.min(startTop + delta, el.scrollHeight - el.clientHeight))
    if (startTop === endTop) return
    const duration = 320
    const startTime = performance.now()
    const easeInOut = (v: number) => (v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2)
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      el.scrollTop = startTop + (endTop - startTop) * easeInOut(progress)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(step)
  }, [])

  // Scroll list to top when page changes
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = 0
  }, [page])

  // ── Pagination helpers ─────────────────────────────────────────────────────
  const PAGE_SIZE = 50
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(page * PAGE_SIZE, total)
  const emptyState =
    !isLoading && !isError && letters.length === 0
      ? getIncomingEmptyState(activeFolder, activeFilter, committedSearch, t)
      : null

  return (
    <div className="border-border bg-card flex h-full min-w-0 flex-col overflow-hidden border-r">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 pt-4 pb-3"
        style={{ background: 'linear-gradient(180deg, var(--background) 0%, var(--card) 100%)' }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-foreground text-[13px]">
              {t('pages.lawyerWorkplace.incoming.title', 'Incoming')}
            </h2>
            <CountPill>
              {t('pages.lawyerWorkplace.incoming.count', {
                unprocessed: String(unprocessedCount).padStart(2, '0'),
                total: countAll,
                defaultValue: `${String(unprocessedCount).padStart(2, '0')} / ${countAll}`,
              })}
            </CountPill>
          </div>
          <Button
            type="button"
            variant="primary"
            size="xs"
            onClick={onNewLetter}
            className="shrink-0 rounded-full text-[11px]"
          >
            {t('pages.lawyerWorkplace.incoming.newLetter', 'New letter')}
          </Button>
        </div>

        {/* Folder tabs */}
        <div className="bg-card mb-3 flex gap-1 rounded-lg p-1 shadow-sm">
          {FOLDERS.map((f) => {
            const isActive = activeFolder === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onFolderChange(f.id)}
                className={cn(
                  'flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 rounded-md px-1.5 py-2 text-[11px] font-medium transition-all sm:gap-1.5 sm:px-2 sm:text-[12px]',
                  isActive
                    ? 'bg-secondary-800 text-white shadow-sm'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <span className={isActive ? 'text-white' : 'text-foreground'}>{f.icon}</span>
                {t(f.labelKey)}
              </button>
            )
          })}
        </div>

        {/* Search bar — submitted on icon click or Enter */}
        <div className="relative mb-3">
          <button
            type="button"
            onClick={handleSearchSubmit}
            className="text-muted-foreground hover:text-primary-500 absolute top-1/2 left-2 -translate-y-1/2 transition-colors"
            aria-label={t('actions.search', 'Search')}
          >
            <Icons.Search size={14} strokeWidth={1.5} />
          </button>
          <input
            type="text"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t(
              'pages.lawyerWorkplace.incoming.searchPlaceholder',
              'Sender, subject...'
            )}
            className="text-foreground focus:border-primary-400 border-border bg-input placeholder:text-muted-foreground h-8 w-full rounded-lg border py-1.5 pr-3 pl-8 text-[12px] outline-none"
          />
          {searchDraft && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
            >
              <Icons.Cancel01 size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Status filter pills + pagination in same row */}
        <div className="flex flex-col items-start justify-between gap-1">
          {/* Simple pagination: ← 1–50 of 207 → */}
          {total > 0 && (
            <div className="flex w-full items-end justify-end">
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                  className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded disabled:opacity-30"
                  aria-label={t('pagination.prev', 'Previous page')}
                >
                  <Icons.ArrowLeft size={12} strokeWidth={2} />
                </button>
                <span className="text-muted-foreground text-[10px] whitespace-nowrap">
                  {pageStart}–{pageEnd} / {total}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange(page + 1)}
                  className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded disabled:opacity-30"
                  aria-label={t('pagination.next', 'Next page')}
                >
                  <Icons.ArrowRight size={12} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.id
              const count = filterCount(f.id)
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onFilterChange(f.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] transition-colors',
                    isActive
                      ? 'bg-secondary-800 text-white'
                      : 'text-foreground bg-card hover:bg-muted'
                  )}
                >
                  {t(f.labelKey, f.fallback)}
                  <NumBadge count={count} active={isActive} />
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="border-border mx-4 shrink-0 border-b" />

      {/* ── Letter list ──────────────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={listRef}
          className="bg-card h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {isLoading ? (
            <IncomingListSkeleton />
          ) : isError ? (
            <div
              className="flex flex-col items-center justify-center px-6 py-14 text-center"
              role="alert"
            >
              <div className="bg-error-50 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                <Icons.Warning size={22} strokeWidth={1.5} className="text-error-500" />
              </div>
              <p className="text-foreground text-[14px] font-medium">
                {t('pages.lawyerWorkplace.incoming.loadError.title', 'Could not load inbox')}
              </p>
              <p className="text-muted-foreground mt-1 max-w-sm text-[12px] leading-relaxed">
                {t(
                  'pages.lawyerWorkplace.incoming.loadError.description',
                  'Check your connection and try again.'
                )}
              </p>
              {onRetry ? (
                <Button
                  type="button"
                  variant="cancel"
                  size="sm"
                  onClick={onRetry}
                  className="mt-5 h-9 rounded-md"
                >
                  {t('actions.retry', 'Retry')}
                </Button>
              ) : null}
            </div>
          ) : emptyState ? (
            <div
              className="flex flex-col items-center justify-center px-6 py-14 text-center"
              role="status"
            >
              <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                {emptyState.icon}
              </div>
              <p className="text-foreground text-[14px] font-medium">{emptyState.title}</p>
              <p className="text-muted-foreground mt-1 max-w-sm text-[12px] leading-relaxed">
                {emptyState.description}
              </p>
            </div>
          ) : (
            letters.map((letter) => (
              <LetterListItemRow
                key={letter.id}
                letter={letter}
                isSelected={selectedLetterId === letter.id}
                onSelect={onSelectLetter}
              />
            ))
          )}
        </div>

        {/* Scroll up arrow */}
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 flex h-14 flex-col items-center justify-start pt-1 transition-opacity duration-200',
            canScrollUp ? 'opacity-100' : 'opacity-0'
          )}
          style={{ background: 'linear-gradient(to bottom, var(--background) 30%, transparent)' }}
        >
          <button
            type="button"
            aria-label={t('pages.lawyerWorkplace.incoming.scrollUp', 'Scroll up')}
            onClick={() => scrollBy(-220)}
            className={cn(
              'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border shadow-md transition-all hover:shadow-lg',
              canScrollUp ? 'cursor-pointer' : 'pointer-events-none'
            )}
          >
            <Icons.ArrowUp size={12} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scroll down arrow */}
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 flex h-14 flex-col items-center justify-end pb-1 transition-opacity duration-200',
            canScrollDown ? 'opacity-100' : 'opacity-0'
          )}
          style={{ background: 'linear-gradient(to top, var(--background) 30%, transparent)' }}
        >
          <button
            type="button"
            aria-label={t('pages.lawyerWorkplace.incoming.scrollDown', 'Scroll down')}
            onClick={() => scrollBy(220)}
            className={cn(
              'border-border bg-card text-muted-foreground hover:border-border hover:text-foreground pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border shadow-md transition-all hover:shadow-lg',
              canScrollDown ? 'cursor-pointer' : 'pointer-events-none'
            )}
          >
            <Icons.ArrowDown size={12} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
