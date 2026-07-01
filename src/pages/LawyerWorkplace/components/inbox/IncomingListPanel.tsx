import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
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
    <span className="bg-light-100 text-dark-500 rounded-full px-2.5 py-0.5 text-[11px]">
      {children}
    </span>
  )
}

function NumBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        'flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] leading-none',
        active ? 'bg-primary-300 text-dark-500' : 'text-dark-500 bg-gray-100'
      )}
    >
      {count}
    </span>
  )
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

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 pt-4 pb-3"
        style={{ background: 'linear-gradient(180deg, #F2F3F0 0%, #FFF 100%)' }}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-dark-500 text-[13px]">
              {t('pages.lawyerWorkplace.incoming.title', 'Incoming')}
            </h2>
            <CountPill>
              {t('pages.lawyerWorkplace.incoming.count', {
                total: countAll,
                unprocessed: String(unprocessedCount).padStart(2, '0'),
                defaultValue: `${countAll} / ${String(unprocessedCount).padStart(2, '0')}`,
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
        <div className="mb-3 flex gap-1 rounded-lg bg-white p-1 shadow-sm">
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
                    : 'text-dark-500 hover:bg-gray-50'
                )}
              >
                <span className={isActive ? 'text-white' : 'text-dark-500'}>{f.icon}</span>
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
            className="text-light-500 hover:text-primary-500 absolute top-1/2 left-2 -translate-y-1/2 transition-colors"
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
            className="text-dark-500 focus:border-primary-400 h-8 w-full rounded-lg border border-gray-200 bg-white py-1.5 pr-3 pl-8 text-[12px] outline-none placeholder:text-gray-400"
          />
          {searchDraft && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-light-500 hover:text-dark-500 absolute top-1/2 right-2 -translate-y-1/2"
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
                  className="text-light-500 hover:text-dark-500 flex h-6 w-6 items-center justify-center rounded disabled:opacity-30"
                  aria-label={t('pagination.prev', 'Previous page')}
                >
                  <Icons.ArrowLeft size={12} strokeWidth={2} />
                </button>
                <span className="text-light-600 text-[10px] whitespace-nowrap">
                  {pageStart}–{pageEnd} / {total}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange(page + 1)}
                  className="text-light-500 hover:text-dark-500 flex h-6 w-6 items-center justify-center rounded disabled:opacity-30"
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
                      : 'text-dark-500 bg-white hover:bg-gray-50'
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

      <div className="mx-4 shrink-0 border-b border-gray-100" />

      {/* ── Letter list ──────────────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={listRef}
          className="h-full overflow-y-auto bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              {t('pages.lawyerWorkplace.incoming.loading', 'Loading letters…')}
            </p>
          ) : isError ? (
            <p className="px-4 py-10 text-center text-sm text-red-500">
              {t('pages.lawyerWorkplace.incoming.loadError', 'Could not load inbox')}
            </p>
          ) : letters.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              {t('pages.lawyerWorkplace.incoming.empty', 'No letters in this folder')}
            </p>
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
          style={{ background: 'linear-gradient(to bottom, #F9FAFB 30%, transparent)' }}
        >
          <button
            type="button"
            aria-label={t('pages.lawyerWorkplace.incoming.scrollUp', 'Scroll up')}
            onClick={() => scrollBy(-220)}
            className={cn(
              'pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md transition-all hover:border-gray-300 hover:text-gray-700 hover:shadow-lg',
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
          style={{ background: 'linear-gradient(to top, #F9FAFB 30%, transparent)' }}
        >
          <button
            type="button"
            aria-label={t('pages.lawyerWorkplace.incoming.scrollDown', 'Scroll down')}
            onClick={() => scrollBy(220)}
            className={cn(
              'pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md transition-all hover:border-gray-300 hover:text-gray-700 hover:shadow-lg',
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
