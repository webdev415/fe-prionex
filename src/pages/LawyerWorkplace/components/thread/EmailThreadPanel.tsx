import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatDateSeparator, formatLetterTime } from '../../utils/formatters'
import type { LetterDetail, ThreadAttachment } from '../../types'
import { ReplyComposer } from './ReplyComposer'

function formatReferenceId(referenceId: string): string {
  return referenceId.replace(/-/g, ' · ')
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-light-700 shrink-0 text-[11px]">{label}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  )
}

function AttachmentPill({ attachment }: { attachment: ThreadAttachment }) {
  const { t } = useTranslation('common')
  const isPdf = attachment.mimeType === 'application/pdf'
  return (
    <div className="flex h-[56px] min-w-0 items-center gap-2.5 rounded-[12px] border border-gray-100 bg-white px-2.5 py-2 shadow-sm sm:min-w-[220px]">
      <span className="text-secondary-800 flex shrink-0 items-center justify-center rounded rounded-[12px] bg-gray-50 px-2 py-3 text-[12px] font-medium tracking-wide uppercase">
        {isPdf
          ? t('pages.lawyerWorkplace.thread.attachmentPdf', 'PDF')
          : t('pages.lawyerWorkplace.thread.attachmentDoc', 'DOC')}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-dark-500 truncate text-[11px] font-medium">{attachment.filename}</p>
        <p className="text-light-700 text-[10px]">{attachment.sizeLabel}</p>
      </div>
      <button
        type="button"
        className="text-light-700 hover:text-secondary-700 shrink-0 cursor-pointer transition-colors"
        aria-label={t('pages.lawyerWorkplace.thread.download', 'Download')}
      >
        <Icons.CloudDownload size={18} strokeWidth={2} />
      </button>
    </div>
  )
}

function MessageCard({ message }: { message: LetterDetail['thread'][number] }) {
  const { t, i18n } = useTranslation('common')
  const isIncoming = message.direction === 'incoming'
  const hasBody = message.body.trim().length > 0
  const hasAttachments = (message.attachments?.length ?? 0) > 0

  return (
    <div className="overflow-hidden rounded-[12px] bg-white shadow-sm">
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
                {t('pages.lawyerWorkplace.thread.toMailbox', {
                  mailbox: message.toMailbox,
                  defaultValue: `to ${message.toMailbox}`,
                })}
                {message.viaLabel ? ` · ${message.viaLabel}` : ''}
              </span>
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-light-700 text-[10.5px]">
            {formatLetterTime(message.sentAt, t, i18n.language)}
          </p>
          <p
            className={cn(
              'mt-0.5 text-[9.5px] font-normal tracking-wider uppercase',
              isIncoming ? 'text-success-700' : 'text-secondary-700'
            )}
          >
            {isIncoming
              ? t('pages.lawyerWorkplace.thread.received', 'RECEIVED')
              : t('pages.lawyerWorkplace.thread.sent', 'SENT')}
          </p>
        </div>
      </div>

      {hasBody && (
        <div className="border-t border-gray-200 px-4 py-3">
          <p className="text-dark-500 text-[13px] leading-relaxed whitespace-pre-wrap">
            {message.body}
          </p>
        </div>
      )}

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

export interface EmailThreadPanelProps {
  letter: LetterDetail | null
  replyDraft: string
  onReplyDraftChange: (value: string) => void
  onBack?: () => void
  onOpenParameters?: () => void
}

export function EmailThreadPanel({
  letter,
  replyDraft,
  onReplyDraftChange,
  onBack,
  onOpenParameters,
}: EmailThreadPanelProps) {
  const { t, i18n } = useTranslation('common')

  if (!letter) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-gray-50/50">
        <p className="text-sm text-gray-400">
          {t('pages.lawyerWorkplace.thread.selectLetter', 'Select a letter to view the thread')}
        </p>
      </div>
    )
  }

  const threadCount = letter.thread.length

  const showCompactNav = Boolean(onBack || onOpenParameters)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-gray-50/20">
      {showCompactNav && (
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-3 py-2 xl:hidden">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-dark-500 hover:text-secondary-800 flex cursor-pointer items-center gap-1.5 text-[13px] font-medium lg:hidden"
            >
              <Icons.ArrowLeft size={18} strokeWidth={1.5} />
              {t('pages.lawyerWorkplace.thread.backToList', 'Back to list')}
            </button>
          ) : (
            <span className="hidden lg:block" />
          )}

          {onOpenParameters && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-light-700 hover:text-dark-500 ml-auto text-[12px] hover:bg-gray-50"
              leftIcon={<Icons.Setting07 size={16} strokeWidth={1.5} />}
              onClick={onOpenParameters}
            >
              {t('pages.lawyerWorkplace.thread.parameters', 'Parameters')}
            </Button>
          )}
        </div>
      )}

      <div className="shrink-0 border-b border-gray-200 bg-white px-3 py-2.5 sm:px-6 sm:py-4">
        <div className="mb-1.5 flex min-w-0 items-start gap-2 sm:items-center sm:gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-5">
            <span className="bg-light-100 text-light-700 w-fit shrink-0 rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase">
              {formatReferenceId(letter.referenceId)}
            </span>
            <h3 className="text-dark-500 min-w-0 text-[15px] leading-snug font-medium sm:truncate sm:text-[18px]">
              {letter.subject}
            </h3>
          </div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            aria-label={t('pages.lawyerWorkplace.thread.archive', 'Archive')}
            title={t('pages.lawyerWorkplace.thread.archive', 'Archive')}
            className="shrink-0 rounded-md text-[12px] sm:hidden"
            leftIcon={<Icons.Download05 size={16} strokeWidth={1.5} />}
          />
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
          <p className="min-w-0 flex-1 text-[10.5px] sm:truncate sm:text-[11.5px]">
            <span className="text-dark-500 break-all sm:break-normal">{letter.senderEmail}</span>
            <span
              className="text-light-700 inline-flex items-center px-0.5 py-0.5 align-middle"
              aria-hidden="true"
            >
              <Icons.ArrowRight02 size={10} strokeWidth={1.5} />
            </span>
            <span className="text-light-700 break-all sm:break-normal">
              {letter.recipientEmail}
            </span>
            {threadCount > 1 && (
              <span className="text-light-700 block sm:inline">
                {' '}
                /{' '}
                {t('pages.lawyerWorkplace.thread.messagesInThread', {
                  count: threadCount,
                  defaultValue: `${threadCount} messages in thread`,
                })}
              </span>
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="hidden rounded-md text-[12px] sm:inline-flex"
            leftIcon={<Icons.Download05 size={16} strokeWidth={1.5} />}
          >
            {t('pages.lawyerWorkplace.thread.archive', 'Archive')}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5">
        {letter.thread.map((message, index) => {
          const showDateSep =
            index === 0 ||
            formatDateSeparator(message.sentAt, i18n.language) !==
              formatDateSeparator(letter.thread[index - 1]!.sentAt, i18n.language)

          return (
            <div key={message.id}>
              {showDateSep && (
                <DateSeparator label={formatDateSeparator(message.sentAt, i18n.language)} />
              )}
              <MessageCard message={message} />
            </div>
          )
        })}
      </div>

      <ReplyComposer
        fromMailbox={letter.recipientEmail}
        toMailbox={letter.senderEmail}
        value={replyDraft}
        onChange={onReplyDraftChange}
      />
    </div>
  )
}
