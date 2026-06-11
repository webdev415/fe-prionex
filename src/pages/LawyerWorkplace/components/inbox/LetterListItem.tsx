import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterListItem as LetterListItemType } from '../../types'

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<LetterListItemType['status'], { label: string; className: string }> = {
  new: { label: 'NEW', className: 'bg-error-100 text-error-700' },
  in_progress: { label: 'IN PROGRESS', className: 'bg-secondary-100 text-secondary-800' },
  on_board: { label: 'ON BOARD', className: 'bg-warning-100 text-warning-700' },
  sent_to_kanban: { label: 'KANBAN', className: 'bg-blue-100 text-blue-500' },
  auto_processed: { label: 'AUTO', className: 'bg-gray-100 text-gray-600' },
}

// ─── Type badge colours ───────────────────────────────────────────────────────

const TYPE_COLOUR: Record<string, string> = {
  complaint: 'bg-error-100 text-error-700',
  nbu_inquiry: 'bg-secondary-100 text-secondary-800',
  court_claim: 'bg-warning-100 text-warning-700',
  attorney_request: 'bg-[#EDE9FE] text-[#6D28D9]',
  inquiry: 'bg-success-100 text-success-700',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

function formatTime(iso: string): string {
  const d = new Date(iso)
  const hhmm = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  // Midnight-normalize for pure calendar-day comparison
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const msgStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((todayStart - msgStart) / 86_400_000)

  if (diffDays === 0) return hhmm // today → "09:12"
  if (diffDays === 1) return `Yesterday · ${hhmm}` // yesterday → "Yesterday · 09:12"
  // Older → "Jun 9 · 09:12"  (short month, no year to keep it compact)
  return `${MONTHS[d.getMonth()]} ${d.getDate()} · ${hhmm}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface LetterListItemProps {
  letter: LetterListItemType
  isSelected: boolean
  onSelect: (letterId: string) => void
}

export function LetterListItem({ letter, isSelected, onSelect }: LetterListItemProps) {
  const status = STATUS_META[letter.status]
  const typeColour = letter.letterType
    ? (TYPE_COLOUR[letter.letterType] ?? 'bg-gray-100 text-gray-600')
    : null

  return (
    <button
      type="button"
      onClick={() => onSelect(letter.id)}
      className={cn(
        'relative mx-3 my-2 w-[calc(100%-24px)] rounded-[12px] border p-3.5 text-left transition-colors',
        isSelected
          ? 'border-primary-500 bg-primary-50'
          : letter.isUnprocessed
            ? 'bg-error-50 hover:bg-error-100/60 border-white'
            : 'border-white bg-white hover:bg-gray-50/40'
      )}
    >
      {/* Row 1: Sender name + time */}
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-dark-500 min-w-0 truncate text-[13px] leading-tight font-medium">
          {letter.senderName}
        </span>
        <span className="text-light-700 shrink-0 text-[11px]">{formatTime(letter.receivedAt)}</span>
      </div>

      {/* Row 2: sender → mailbox (inline; mailbox wraps to next line when needed) + status badge */}
      <div className="mb-0.5 flex items-start gap-2">
        <p className="text-light-700 flex min-w-0 flex-1 flex-wrap text-[11.5px] leading-snug">
          <span className="inline-flex items-center whitespace-nowrap">
            <span>{letter.senderEmail}</span>
            <span
              className="text-light-700 inline-flex items-baseline px-0.5 py-0.5 align-baseline"
              aria-hidden="true"
            >
              <Icons.ArrowRight02 size={10} strokeWidth={1.5} />
            </span>
          </span>
          <span>{letter.mailbox}</span>
        </p>

        {/* Status badge — right-aligned on email row */}
        {status && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide whitespace-nowrap uppercase',
              status.className
            )}
          >
            {status.label}
          </span>
        )}
      </div>

      {/* Row 3: Subject */}
      <p className="text-dark-500 mt-2 mb-2 line-clamp-2 text-[12.5px] leading-snug">
        {letter.subject}
      </p>

      {/* Row 4: Type badge + client info */}
      <div className="flex flex-wrap items-center gap-1.5">
        {typeColour ? (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              typeColour
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span>{letter.letterTypeLabel}</span>
          </span>
        ) : (
          <span className="bg-light-100 border-dotted-[1px] text-light-700 flex items-center gap-1 rounded-full border-gray-200 px-2 py-0.5 text-[10.5px] font-medium">
            <span className="bg-light-700 h-1.5 w-1.5 rounded-full" />
            <span>Unclassified</span>
          </span>
        )}

        {letter.clientCode && letter.clientName ? (
          <div className="flex items-center gap-1">
            <span className="text-dark-500 text-[11px]">{letter.clientName}</span>
            <span className="text-light-700 text-[11px]"> · </span>
            <span className="text-light-700 text-[11px]">{letter.clientCode}</span>
          </div>
        ) : (
          <em className="text-error-700 text-[11px] italic">unidentified</em>
        )}
      </div>
    </button>
  )
}
