import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  applyLetterTemplatePlaceholders,
  downloadLegalAttachment,
  useLegalComposerReplyTemplates,
  useLegalMailboxes,
  useReplyComposerState,
  useReplyToLegalThread,
  loadReplyDraftForMessage,
  type EdoType,
} from '@/features/lawyerWorkplace'
import { getErrorMessage } from '@/lib/errors'
import { getFilenameExtensionLabel } from '@/features/lawyerWorkplace/utils/attachmentExtension'
import { formatDateSeparator, formatLetterTime } from '../../utils/formatters'
import type { LetterDetail, ThreadAttachment } from '../../types'
import { ReplyComposer } from './ReplyComposer'
import { EmailMessageBody } from './EmailMessageBody'

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
      <div className="bg-muted h-px flex-1" />
      <span className="text-muted-foreground shrink-0 text-[11px]">{label}</span>
      <div className="bg-muted h-px flex-1" />
    </div>
  )
}

function AttachmentPill({
  attachment,
  messageId,
}: {
  attachment: ThreadAttachment
  messageId: string
}) {
  const { t } = useTranslation('common')
  const [downloading, setDownloading] = useState(false)
  const extensionLabel = getFilenameExtensionLabel(attachment.filename)

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadLegalAttachment(messageId, attachment.id, attachment.filename)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-card border-border flex h-[56px] min-w-0 items-center gap-2.5 rounded-[12px] border px-2.5 py-2 shadow-sm sm:min-w-[220px]">
      <span
        className="text-secondary-800 bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-center font-medium tracking-wide uppercase"
        title={extensionLabel}
      >
        <span
          className={cn(
            'max-w-full truncate px-0.5 leading-none',
            extensionLabel.length > 3 ? 'text-[9px]' : 'text-[11px]'
          )}
        >
          {extensionLabel}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-[11px] font-medium">{attachment.filename}</p>
        <p className="text-muted-foreground text-[10px]">{attachment.sizeLabel}</p>
      </div>
      <button
        type="button"
        disabled={downloading}
        onClick={handleDownload}
        className="text-muted-foreground hover:text-secondary-700 shrink-0 cursor-pointer transition-colors disabled:opacity-50"
        aria-label={t('pages.lawyerWorkplace.thread.download', 'Download')}
      >
        <Icons.CloudDownload size={18} strokeWidth={2} />
      </button>
    </div>
  )
}

function MessageCard({
  message,
  messageId,
}: {
  message: LetterDetail['thread'][number]
  messageId: string
}) {
  const { t, i18n } = useTranslation('common')
  const isIncoming = message.direction === 'incoming'
  const hasBody = message.body.trim().length > 0
  const hasAttachments = (message.attachments?.length ?? 0) > 0

  return (
    <div className="bg-card overflow-hidden rounded-[12px] shadow-sm">
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2.5">
        <div className="bg-secondary-100 text-secondary-800 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-sans text-[14px] font-medium">
          {initials(message.senderName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
            <span className="text-foreground text-[13px] font-semibold">{message.senderName}</span>
            <span className="text-muted-foreground text-[11px]">{message.senderEmail}</span>
          </div>
          {message.toMailbox && (
            <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-0.5 text-[11px]">
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
          <p className="text-muted-foreground text-[10.5px]">
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
        <div className="border-border border-t px-4 py-3">
          <EmailMessageBody body={message.body} bodyFormat={message.bodyFormat} />
        </div>
      )}

      {hasAttachments && (
        <div
          className={cn(
            'mx-4 grid grid-cols-1 gap-2 sm:grid-cols-2',
            hasBody ? 'border-border border-t border-dashed pt-2.5 pb-3' : 'pb-3'
          )}
        >
          {message.attachments!.map((att) => (
            <AttachmentPill key={att.id} attachment={att} messageId={messageId} />
          ))}
        </div>
      )}
    </div>
  )
}

export interface EmailThreadPanelProps {
  letter: LetterDetail | null
  isLoading?: boolean
  isError?: boolean
  replyDraft: string
  onReplyDraftChange: (value: string) => void
  onReplySent?: () => void
  onBack?: () => void
  onOpenParameters?: () => void
}

export function EmailThreadPanel({
  letter,
  isLoading = false,
  isError = false,
  replyDraft,
  onReplyDraftChange,
  onReplySent,
  onBack,
  onOpenParameters,
}: EmailThreadPanelProps) {
  const { t, i18n } = useTranslation('common')
  const { data: mailboxesData } = useLegalMailboxes({ enabled: Boolean(letter) })
  const { data: replyTemplatesData } = useLegalComposerReplyTemplates(letter?.letterType, {
    enabled: Boolean(letter),
  })
  const replyMutation = useReplyToLegalThread()
  const letterId = letter?.id ?? ''
  const [mailboxOverride, setMailboxOverride] = useState<{
    letterId: string
    mailboxId: string | null
  } | null>(null)
  const [edoOverride, setEdoOverride] = useState<{
    letterId: string
    edoType: EdoType
  } | null>(null)

  const mailboxes = useMemo(() => mailboxesData?.items ?? [], [mailboxesData?.items])
  const replyTemplates = useMemo(
    () =>
      (replyTemplatesData?.items ?? []).map((template) => ({
        id: template.id,
        name: template.name,
        body: template.body,
      })),
    [replyTemplatesData?.items]
  )

  const handleApplyTemplate = (body: string) => {
    if (!letter) return
    const filled = applyLetterTemplatePlaceholders(
      body,
      {
        clientName: letter.clientName,
        referenceId: letter.referenceId,
        contract: letter.parameters.contractLabel,
        dueDate: letter.parameters.dueDate,
      },
      { language: i18n.language }
    )
    onReplyDraftChange(replyDraft.trim() ? `${replyDraft.trim()}\n\n${filled}` : filled)
  }

  const defaultMailboxId = useMemo(() => {
    if (!letter) return null
    return letter.replyContext.mailboxId ?? mailboxes[0]?.id ?? null
  }, [letter, mailboxes])

  const selectedMailboxId =
    mailboxOverride?.letterId === letterId ? mailboxOverride.mailboxId : defaultMailboxId
  const edoType = edoOverride?.letterId === letterId ? edoOverride.edoType : 'none'

  const {
    stagedAttachments,
    isSavingDraft,
    isUploadingAttachment,
    saveDraft,
    uploadAttachment,
    removeAttachment,
    clearComposerState,
  } = useReplyComposerState({
    messageId: letterId || null,
    selectedMailboxId,
    edoType,
    body: replyDraft,
    enabled: Boolean(letter),
  })

  const loadedDraftForLetterRef = useRef<string | null>(null)

  useEffect(() => {
    if (!letterId || !letter) return
    if (loadedDraftForLetterRef.current === letterId) return
    loadedDraftForLetterRef.current = letterId

    void (async () => {
      const saved = await loadReplyDraftForMessage(letterId)
      if (saved) {
        onReplyDraftChange(saved.body)
        if (saved.mailboxId) {
          setMailboxOverride({ letterId, mailboxId: saved.mailboxId })
        }
        if (saved.edoType !== 'none') {
          setEdoOverride({ letterId, edoType: saved.edoType })
        }
      } else {
        onReplyDraftChange('')
      }
    })()
  }, [letter, letterId, onReplyDraftChange])

  const handleMailboxChange = (mailboxId: string) => {
    setMailboxOverride({ letterId, mailboxId })
  }

  const handleEdoTypeChange = (nextEdoType: EdoType) => {
    setEdoOverride({ letterId, edoType: nextEdoType })
  }

  const handleSendReply = async () => {
    if (!letter || !selectedMailboxId) {
      toast.error(t('pages.lawyerWorkplace.reply.noMailbox', 'Select a mailbox to send from'))
      return
    }

    const body = replyDraft.trim()
    if (!body) return

    const { replyContext } = letter
    const clientId =
      replyContext.clientId ??
      (letter.parameters.clientId ? Number(letter.parameters.clientId) : null)
    const assignedUserId =
      replyContext.assignedUserId ??
      (letter.parameters.lawyerId ? Number(letter.parameters.lawyerId) : null)

    if (edoType !== 'none' && (clientId == null || assignedUserId == null)) {
      toast.error(
        t(
          'pages.lawyerWorkplace.reply.edoRequiresClientLawyer',
          'Select client and lawyer in parameters before registering EDO'
        )
      )
      return
    }

    replyMutation.mutate(
      {
        threadId: replyContext.threadId,
        payload: {
          mailbox_id: selectedMailboxId,
          in_reply_to_message_id: replyContext.inReplyToMessageId,
          to_addresses: [letter.senderEmail],
          subject: letter.subject.startsWith('RE:') ? letter.subject : `RE: ${letter.subject}`,
          body_text: body,
          edo_type: edoType,
          client_id: edoType !== 'none' ? clientId : null,
          assigned_to_user_id: edoType !== 'none' ? assignedUserId : null,
          contract_number:
            edoType !== 'none' ? letter.parameters.contractLabel.trim() || null : null,
          attachment_ids: stagedAttachments.map((item) => item.id),
          draft_message_id: letter.id,
        },
      },
      {
        onSuccess: () => {
          onReplyDraftChange('')
          clearComposerState()
          loadedDraftForLetterRef.current = null
          onReplySent?.()
        },
      }
    )
  }

  if (!letter) {
    const title = isError
      ? t('pages.lawyerWorkplace.thread.loadError.title', 'Could not load thread')
      : isLoading
        ? t('pages.lawyerWorkplace.thread.loading', 'Loading thread…')
        : t('pages.lawyerWorkplace.thread.empty.title', 'Select a letter to view the thread')

    const description = isError
      ? t(
          'pages.lawyerWorkplace.thread.loadError.description',
          'Select another letter or try again in a moment.'
        )
      : isLoading
        ? null
        : t(
            'pages.lawyerWorkplace.thread.empty.description',
            'Choose a letter from the list to read the full conversation and reply.'
          )

    return (
      <div
        className="bg-muted/50 flex h-full min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden"
        role={isLoading ? 'status' : isError ? 'alert' : 'status'}
        aria-busy={isLoading || undefined}
      >
        {isLoading ? (
          <div className="flex w-full max-w-md flex-col gap-3 px-6">
            <span className="sr-only">{title}</span>
            <div className="bg-muted h-4 w-40 animate-pulse rounded" />
            <div className="bg-muted h-3 w-full animate-pulse rounded" />
            <div className="bg-muted mt-4 h-24 w-full animate-pulse rounded-xl" />
            <div className="bg-muted h-24 w-full animate-pulse rounded-xl" />
          </div>
        ) : (
          <div className="flex max-w-sm flex-col items-center px-6 text-center">
            <div
              className={cn(
                'mb-4 flex h-12 w-12 items-center justify-center rounded-full',
                isError ? 'bg-error-50' : 'bg-muted'
              )}
            >
              {isError ? (
                <Icons.Warning size={22} strokeWidth={1.5} className="text-error-500" />
              ) : (
                <Icons.Mail size={22} strokeWidth={1.5} className="text-muted-foreground" />
              )}
            </div>
            <p className="text-foreground text-[14px] font-medium">{title}</p>
            {description ? (
              <p className="text-muted-foreground mt-1 text-[12px] leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  const threadCount = letter.thread.length

  const showCompactNav = Boolean(onBack || onOpenParameters)

  return (
    <div className="bg-muted/20 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {showCompactNav && (
        <div className="bg-card border-border flex shrink-0 items-center justify-between border-b px-3 py-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="text-foreground hover:text-secondary-800 flex cursor-pointer items-center gap-1.5 text-[13px] font-medium"
            >
              <Icons.ArrowLeft size={18} strokeWidth={1.5} />
              {t('pages.lawyerWorkplace.thread.backToList', 'Back to list')}
            </button>
          ) : (
            <span />
          )}

          {onOpenParameters && (
            <Button
              type="button"
              variant="cancel"
              size="xs"
              className="ml-auto rounded-md text-[12px]"
              leftIcon={<Icons.Setting07 size={16} strokeWidth={1.5} />}
              onClick={onOpenParameters}
            >
              {t('pages.lawyerWorkplace.thread.parameters', 'Parameters')}
            </Button>
          )}
        </div>
      )}

      {letter.sourceMailboxDisabled ? (
        <div className="border-warning-200 bg-warning-50 mx-3 mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5 sm:mx-6">
          <Icons.Info size={16} strokeWidth={1.5} className="text-warning-700 mt-0.5 shrink-0" />
          <p className="text-warning-900 text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.thread.disabledMailboxNotice',
              'The original mailbox for this letter is disabled. Choose another mailbox below to send a reply.'
            )}
          </p>
        </div>
      ) : null}

      <div className="border-border bg-card shrink-0 border-b px-3 py-2.5 sm:px-6 sm:py-4">
        <div className="mb-1.5 flex min-w-0 items-start gap-2 sm:items-center sm:gap-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-5">
            <span className="bg-muted text-muted-foreground border-border w-fit shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase">
              {formatReferenceId(letter.referenceId)}
            </span>
            <h3 className="text-foreground min-w-0 text-[15px] leading-snug font-medium sm:truncate sm:text-[18px]">
              {letter.subject}
            </h3>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
          <p className="min-w-0 flex-1 text-[10.5px] sm:truncate sm:text-[11.5px]">
            <span className="text-foreground break-all sm:break-normal">
              {letter.routeFromEmail}
            </span>
            <span
              className="text-muted-foreground inline-flex items-center px-0.5 py-0.5 align-middle"
              aria-hidden="true"
            >
              <Icons.ArrowRight02 size={10} strokeWidth={1.5} />
            </span>
            <span className="text-muted-foreground break-all sm:break-normal">
              {letter.routeToEmail}
            </span>
            {threadCount > 1 && (
              <span className="text-muted-foreground block sm:inline">
                {' '}
                /{' '}
                {t('pages.lawyerWorkplace.thread.messagesInThread', {
                  count: threadCount,
                  defaultValue: `${threadCount} messages in thread`,
                })}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-3 py-4 sm:px-5">
        {isLoading && (
          <p className="text-muted-foreground text-center text-xs">
            {t('pages.lawyerWorkplace.thread.loading', 'Loading thread…')}
          </p>
        )}
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
              <MessageCard message={message} messageId={message.id} />
            </div>
          )
        })}
      </div>

      <ReplyComposer
        mailboxes={mailboxes}
        selectedMailboxId={selectedMailboxId}
        onMailboxChange={handleMailboxChange}
        toMailbox={letter.senderEmail}
        value={replyDraft}
        onChange={onReplyDraftChange}
        edoType={edoType}
        onEdoTypeChange={handleEdoTypeChange}
        onSend={handleSendReply}
        replyTemplates={replyTemplates}
        onApplyTemplate={handleApplyTemplate}
        stagedAttachments={stagedAttachments}
        onSaveDraft={saveDraft}
        onAttachFiles={(files) => {
          void Array.from(files).forEach((file) => {
            void uploadAttachment(file)
          })
        }}
        onRemoveAttachment={(attachmentId) => {
          void removeAttachment(attachmentId)
        }}
        isSavingDraft={isSavingDraft}
        isUploadingAttachment={isUploadingAttachment}
        isSending={replyMutation.isPending}
        sendDisabled={!letter.replyContext.threadId}
      />
    </div>
  )
}
