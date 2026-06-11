import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterDetail, ThreadAttachment } from '../../types'
import { ReplyComposer } from './ReplyComposer'

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function formatReferenceId(referenceId: string): string {
  return referenceId.replace(/-/g, ' · ')
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const hhmm = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const msgStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((todayStart - msgStart) / 86_400_000)

  if (diffDays === 0) return hhmm
  if (diffDays === 1) return `Yesterday · ${hhmm}`
  return `${MONTHS[d.getMonth()]} ${d.getDate()} · ${hhmm}`
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso)
  const datePart = d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  return `${datePart} · ${weekday}`
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-light-700 shrink-0 text-[11px]">{label}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  )
}

// ─── Attachment pill ──────────────────────────────────────────────────────────

function AttachmentPill({ attachment }: { attachment: ThreadAttachment }) {
  const isPdf = attachment.mimeType === 'application/pdf'
  return (
    <div className="flex h-[56px] min-w-[220px] items-center gap-2.5 rounded-[12px] border border-gray-100 bg-white px-2.5 py-2 shadow-sm">
      <span className="text-secondary-800 flex shrink-0 items-center justify-center rounded rounded-[12px] bg-gray-50 px-2 py-3 text-[12px] font-medium tracking-wide uppercase">
        {isPdf ? 'PDF' : 'DOC'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-dark-500 truncate text-[11px] font-medium">{attachment.filename}</p>
        <p className="text-light-700 text-[10px]">{attachment.sizeLabel}</p>
      </div>
      <button
        type="button"
        className="text-light-700 hover:text-secondary-700 shrink-0 cursor-pointer transition-colors"
        aria-label="Download"
      >
        <Icons.CloudDownload size={18} strokeWidth={2} />
      </button>
    </div>
  )
}

// ─── Thread message card ──────────────────────────────────────────────────────

function MessageCard({ message }: { message: LetterDetail['thread'][number] }) {
  const isIncoming = message.direction === 'incoming'
  const hasBody = message.body.trim().length > 0
  const hasAttachments = (message.attachments?.length ?? 0) > 0

  return (
    <div className="overflow-hidden rounded-[12px] bg-white shadow-sm">
      {/* Message header */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2.5">
        <div className="bg-secondary-100 text-secondary-800 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-sans text-[14px] font-medium">
          {initials(message.senderName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
            <span className="text-dark-500 text-[13px] font-semibold">{message.senderName}</span>
            <span className="text-light-700 text-[11px]">{message.senderEmail}</span>
          </div>
          {message.toMailbox && (
            <p className="text-light-700 mt-0.5 flex flex-wrap items-center gap-0.5 text-[11px]">
              <span>
                to {message.toMailbox}
                {message.viaLabel ? ` · ${message.viaLabel}` : ''}
              </span>
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-light-700 text-[10.5px]">{formatTime(message.sentAt)}</p>
          <p
            className={cn(
              'mt-0.5 text-[9.5px] font-normal tracking-wider uppercase',
              isIncoming ? 'text-success-700' : 'text-secondary-700'
            )}
          >
            {isIncoming ? 'RECEIVED' : 'SENT'}
          </p>
        </div>
      </div>

      {/* Body — divider only appears when body exists */}
      {hasBody && (
        <div className="border-t border-gray-200 px-4 py-3">
          <p className="text-dark-500 text-[13px] leading-relaxed whitespace-pre-wrap">
            {message.body}
          </p>
        </div>
      )}

      {/* Attachments — no divider above when body is absent; dashed divider when body exists */}
      {hasAttachments && (
        <div
          className={cn(
            'mx-4 grid grid-cols-1 gap-2 sm:grid-cols-2',
            hasBody ? 'border-t border-dashed border-gray-200 pt-2.5 pb-3' : 'pb-3'
          )}
        >
          {message.attachments!.map((att) => (
            <AttachmentPill key={att.id} attachment={att} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export interface EmailThreadPanelProps {
  letter: LetterDetail | null
  replyDraft: string
  onReplyDraftChange: (value: string) => void
  markAsNbuResponse: boolean
  onMarkAsNbuResponseChange: (checked: boolean) => void
}

export function EmailThreadPanel({
  letter,
  replyDraft,
  onReplyDraftChange,
  markAsNbuResponse,
  onMarkAsNbuResponseChange,
}: EmailThreadPanelProps) {
  if (!letter) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-gray-50/50">
        <p className="text-sm text-gray-400">Select a letter to view the thread</p>
      </div>
    )
  }

  const threadCount = letter.thread.length

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-gray-50/20">
      {/* ── Thread header ─────────────────────────────────────── */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        {/* Row 1: reference badge + subject (inline) */}
        <div className="mb-1.5 flex min-w-0 items-center gap-5">
          <span className="bg-light-100 text-light-700 shrink-0 rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase">
            {formatReferenceId(letter.referenceId)}
          </span>
          <h3 className="text-dark-500 min-w-0 truncate text-[18px] leading-snug font-medium">
            {letter.subject}
          </h3>
        </div>

        {/* Row 2: email path + archive (archive aligned with this row) */}
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-[11.5px]">
            <span className="text-dark-500">{letter.senderEmail}</span>
            <span
              className="text-light-700 inline-flex items-center px-0.5 py-0.5 align-middle"
              aria-hidden="true"
            >
              <Icons.ArrowRight02 size={10} strokeWidth={1.5} />
            </span>
            <span className="text-light-700">{letter.recipientEmail}</span>
            {threadCount > 1 && (
              <span className="text-light-700"> / {threadCount} messages in thread</span>
            )}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-light-700 hover:text-dark-500 shrink-0 text-[12px] hover:bg-gray-50"
            leftIcon={<Icons.Download05 size={16} strokeWidth={1.5} />}
          >
            Archive
          </Button>
        </div>
      </div>

      {/* ── Message list (scrollable) ─────────────────────────── */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {letter.thread.map((message, index) => {
          const showDateSep =
            index === 0 ||
            formatDateSeparator(message.sentAt) !==
              formatDateSeparator(letter.thread[index - 1]!.sentAt)

          return (
            <div key={message.id}>
              {showDateSep && <DateSeparator label={formatDateSeparator(message.sentAt)} />}
              <MessageCard message={message} />
            </div>
          )
        })}
      </div>

      {/* ── Reply composer (fixed at bottom) ─────────────────── */}
      <ReplyComposer
        fromMailbox={letter.recipientEmail}
        toMailbox={letter.senderEmail}
        value={replyDraft}
        onChange={onReplyDraftChange}
        markAsNbuResponse={markAsNbuResponse}
        onMarkAsNbuResponseChange={onMarkAsNbuResponseChange}
      />
    </div>
  )
}
