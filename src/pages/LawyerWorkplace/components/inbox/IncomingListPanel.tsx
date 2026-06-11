import { useRef, useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import type { IncomingFolder, IncomingMailboxFilter, LetterListItem } from '../../types'
import { LetterListItem as LetterListItemRow } from './LetterListItem'

// ─── Config ───────────────────────────────────────────────────────────────────

const FOLDERS: { id: IncomingFolder; label: string; icon: React.ReactElement }[] = [
  {
    id: 'inbox',
    label: 'Inbox',
    icon: <Icons.InboxIcon size={16} strokeWidth={1.5} />,
  },
  {
    id: 'quarantine',
    label: 'Quarantine',
    icon: <Icons.KanbanIcon size={16} strokeWidth={1.5} />,
  },
  {
    id: 'sent',
    label: 'Sent',
    icon: <Icons.MailSend01 size={16} strokeWidth={1.5} />,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CountPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-light-100 text-dark-500 rounded-full px-2.5 py-0.5 text-[11px]">
      {children}
    </span>
  )
}

/** Circular numeric badge used on filter pills. */
function NumBadge({ count, variant }: { count: number; variant: 'lime' | 'gray' }) {
  return (
    <span
      className={cn(
        'flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] leading-none',
        variant === 'lime' ? 'bg-primary-300 text-dark-500' : 'text-dark-500 bg-gray-100'
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
  onFolderChange: (folder: IncomingFolder) => void
  onFilterChange: (filter: IncomingMailboxFilter) => void
  onSelectLetter: (letterId: string) => void
}

export function IncomingListPanel({
  letters,
  selectedLetterId,
  activeFolder,
  activeFilter,
  onFolderChange,
  onFilterChange,
  onSelectLetter,
}: IncomingListPanelProps) {
  const newCount = letters.filter((l) => l.status === 'new').length
  const inProgressCount = letters.filter((l) => l.status === 'in_progress').length
  const unprocessedCount = letters.filter((l) => l.isUnprocessed).length

  // ── Custom scroll arrows ───────────────────────────────────────────────────
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
    // Defer so DOM has painted the full list
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

  // RAF-based smooth scroll with ease-in-out — gives consistent, smooth feel
  // across all browsers unlike the native scrollBy({ behavior: 'smooth' }).
  const rafRef = useRef<number | null>(null)

  const scrollBy = useCallback((delta: number) => {
    const el = listRef.current
    if (!el) return

    // Cancel any in-progress animation so rapid clicks don't stack
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const startTop = el.scrollTop
    const endTop = Math.max(0, Math.min(startTop + delta, el.scrollHeight - el.clientHeight))
    if (startTop === endTop) return

    const duration = 320 // ms
    const startTime = performance.now()

    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

    const step = (now: number) => {
      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      el.scrollTop = startTop + (endTop - startTop) * easeInOut(t)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(step)
  }, [])

  return (
    <div className="flex h-full flex-col border-r border-gray-200 bg-white">
      {/* ── Header ───────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 pt-4 pb-3"
        style={{ background: 'linear-gradient(180deg, #F2F3F0 0%, #FFF 100%)' }}
      >
        {/* Title + bordered count pill */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-dark-500 text-[13px]">Incoming</h2>
          <CountPill>
            {letters.length} / {String(unprocessedCount).padStart(2, '0')}
          </CountPill>
        </div>

        {/* Folder tabs — white card with border + shadow */}
        <div className="mb-3 flex gap-1 rounded-lg bg-white p-1 shadow-sm">
          {FOLDERS.map((f) => {
            const isActive = activeFolder === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onFolderChange(f.id)}
                className={cn(
                  'flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[12px] font-medium transition-all',
                  isActive
                    ? 'bg-secondary-800 text-white shadow-sm'
                    : 'text-dark-500 hover:text-dark-500 hover:bg-gray-50'
                )}
              >
                <span className={isActive ? 'text-white' : 'text-dark-500'}>{f.icon}</span>
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Filter pills */}
        <div className="flex items-center justify-between gap-3">
          {/* All mailboxes — filled when active */}
          <button
            type="button"
            onClick={() => onFilterChange('all')}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-[12px] transition-colors',
              activeFilter === 'all'
                ? 'bg-secondary-800 text-white'
                : 'text-dark-500 bg-white hover:bg-gray-50'
            )}
          >
            All mailboxes
            <NumBadge count={6} variant={activeFilter === 'all' ? 'lime' : 'gray'} />
          </button>

          {/* New — no bg/border when inactive */}
          <button
            type="button"
            onClick={() => onFilterChange('new')}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[12px] transition-colors',
              activeFilter === 'new'
                ? 'bg-secondary-800 text-white'
                : 'text-dark-500 bg-white hover:bg-gray-50'
            )}
          >
            New
            <NumBadge count={newCount} variant={activeFilter === 'new' ? 'lime' : 'gray'} />
          </button>

          {/* In progress — no bg/border when inactive */}
          <button
            type="button"
            onClick={() => onFilterChange('in_progress')}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-[12px] transition-colors',
              activeFilter === 'in_progress'
                ? 'bg-secondary-800 text-white'
                : 'text-dark-500 bg-white hover:bg-gray-50'
            )}
          >
            In progress
            <NumBadge
              count={inProgressCount}
              variant={activeFilter === 'in_progress' ? 'lime' : 'gray'}
            />
          </button>
        </div>
      </div>

      {/* Separator */}
      <div className="mx-4 shrink-0 border-b border-gray-100" />

      {/* ── Letter list — custom scroll (no native scrollbar) ─── */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Scrollable content — scrollbar hidden */}
        <div
          ref={listRef}
          className="h-full overflow-y-auto bg-white [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {letters.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              No letters in this folder
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

        {/* Top fade + scroll-up arrow */}
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 flex h-14 flex-col items-center justify-start pt-1 transition-opacity duration-200',
            canScrollUp ? 'opacity-100' : 'opacity-0'
          )}
          style={{ background: 'linear-gradient(to bottom, #F9FAFB 30%, transparent)' }}
        >
          <button
            type="button"
            aria-label="Scroll up"
            onClick={() => scrollBy(-220)}
            className={cn(
              'pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-md transition-all hover:border-gray-300 hover:text-gray-700 hover:shadow-lg',
              canScrollUp ? 'cursor-pointer' : 'pointer-events-none'
            )}
          >
            <Icons.ArrowUp size={12} strokeWidth={2.5} />
          </button>
        </div>

        {/* Bottom fade + scroll-down arrow */}
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-0 flex h-14 flex-col items-center justify-end pb-1 transition-opacity duration-200',
            canScrollDown ? 'opacity-100' : 'opacity-0'
          )}
          style={{ background: 'linear-gradient(to top, #F9FAFB 30%, transparent)' }}
        >
          <button
            type="button"
            aria-label="Scroll down"
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
