import { useRef } from 'react'
import { Link01Icon } from '@hugeicons/core-free-icons'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { LinkButton } from '@/components/ui/LinkButton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icon, Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatAttachmentSize } from '@/features/lawyerWorkplace/api/mappers'
import type { LegalMailbox, LegalStagedAttachment } from '@/features/lawyerWorkplace/api/types'

export interface ReplyComposerTemplate {
  id: string
  name: string
  body: string
}

export interface ReplyComposerProps {
  mailboxes: LegalMailbox[]
  selectedMailboxId: string | null
  onMailboxChange: (mailboxId: string) => void
  toMailbox: string
  value: string
  onChange: (value: string) => void
  onSend: () => void
  replyTemplates?: ReplyComposerTemplate[]
  onApplyTemplate?: (body: string) => void
  stagedAttachments?: LegalStagedAttachment[]
  onSaveDraft?: () => void
  onAttachFiles?: (files: FileList) => void
  onRemoveAttachment?: (attachmentId: string) => void
  /** Opens the "attach a document from any client" picker (option 2). */
  onAttachFromClient?: () => void
  /** Opens the document-generation modal seeded with the letter's client (option 3). */
  onGenerateDocument?: () => void
  /**
   * Gates "Generate document" (option 3) — that flow needs the letter's confirmed
   * client + its loans. Attaching a document is NOT gated by this: the picker can
   * search any client.
   */
  clientActionsEnabled?: boolean
  /**
   * Gates "Attached file on client" (option 2). Defaults to enabled — the picker
   * lets the lawyer search any client, so it does not require a letter client.
   */
  attachFromClientEnabled?: boolean
  isSavingDraft?: boolean
  isUploadingAttachment?: boolean
  isSending?: boolean
  sendDisabled?: boolean
}

function StagedAttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: LegalStagedAttachment
  onRemove?: (attachmentId: string) => void
}) {
  const { t } = useTranslation('common')
  return (
    <span className="border-border text-foreground bg-card inline-flex max-w-[180px] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
      <span className="truncate">{attachment.filename}</span>
      <span className="text-muted-foreground shrink-0">
        {formatAttachmentSize(attachment.size_bytes)}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(attachment.id)}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label={t('pages.lawyerWorkplace.thread.removeAttachment', 'Remove attachment')}
        >
          <Icons.Close size={10} strokeWidth={2} />
        </button>
      )}
    </span>
  )
}

export function ReplyComposer({
  mailboxes,
  selectedMailboxId,
  onMailboxChange,
  toMailbox,
  value,
  onChange,
  onSend,
  replyTemplates = [],
  onApplyTemplate,
  stagedAttachments = [],
  onSaveDraft,
  onAttachFiles,
  onRemoveAttachment,
  onAttachFromClient,
  onGenerateDocument,
  clientActionsEnabled = false,
  attachFromClientEnabled = true,
  isSavingDraft = false,
  isUploadingAttachment = false,
  isSending = false,
  sendDisabled = false,
}: ReplyComposerProps) {
  const { t } = useTranslation('common')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const clientActionsDisabledHint = clientActionsEnabled
    ? undefined
    : t('pages.lawyerWorkplace.reply.attachClientDisabledHint', 'Confirm the client first')

  const selectedMailbox =
    mailboxes.find((mailbox) => mailbox.id === selectedMailboxId) ?? mailboxes[0] ?? null

  const handleSend = () => {
    if (sendDisabled || isSending || !value.trim()) return
    onSend()
  }

  const handleTemplateClick = () => {
    if (replyTemplates.length === 0) {
      toast.info(
        t(
          'pages.lawyerWorkplace.reply.noTemplatesHint',
          'Create letter templates in Settings → Templates'
        )
      )
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      onAttachFiles?.(files)
    }
    event.target.value = ''
  }

  return (
    <div className="from-background to-card flex min-w-0 shrink-0 flex-col gap-2 bg-gradient-to-b px-3 py-2.5 sm:px-5 sm:py-3">
      <div className="flex items-center justify-between gap-2 py-0.5 sm:gap-3 sm:py-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <span className="text-muted-foreground shrink-0 text-[10px] sm:text-[11px]">
            {t('pages.lawyerWorkplace.reply.replyFrom', 'Reply from')}
          </span>
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={mailboxes.length === 0}
                  className="bg-muted text-foreground border-border hover:bg-muted flex max-w-[42vw] items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[10px] font-normal transition-colors disabled:opacity-50 sm:max-w-none sm:text-[10.5px]"
                >
                  <span className="truncate">{selectedMailbox?.email ?? '—'}</span>
                  <Icons.ArrowDown
                    size={10}
                    strokeWidth={2}
                    className="text-muted-foreground shrink-0"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px] p-1.5">
                {mailboxes.map((mailbox) => (
                  <DropdownMenuItem
                    key={mailbox.id}
                    className={cn(
                      'focus:bg-muted cursor-pointer rounded-md px-2.5 py-1.5 text-[12px]',
                      mailbox.id === selectedMailboxId && 'bg-muted font-medium'
                    )}
                    onClick={() => onMailboxChange(mailbox.id)}
                  >
                    {mailbox.email}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span
              className="text-muted-foreground inline-flex shrink-0 items-center"
              aria-hidden="true"
            >
              <Icons.ArrowRight02 size={10} strokeWidth={1.5} />
            </span>
            <span className="text-foreground max-w-[42vw] truncate text-[10px] sm:max-w-none sm:text-[11px]">
              {toMailbox}
            </span>
          </div>
        </div>
      </div>

      {stagedAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-0.5">
          {stagedAttachments.map((attachment) => (
            <StagedAttachmentChip
              key={attachment.id}
              attachment={attachment}
              onRemove={onRemoveAttachment}
            />
          ))}
        </div>
      )}

      <div className="border-border bg-input flex flex-row items-end rounded-lg border p-2.5 sm:p-3">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="text-foreground min-h-[96px] w-full resize-none overflow-y-scroll rounded border-none bg-transparent p-0 text-[13px] shadow-none outline-none [scrollbar-width:none] focus:ring-0 focus:ring-offset-0 sm:min-h-[110px] [&::-webkit-scrollbar]:hidden"
          placeholder={t('pages.lawyerWorkplace.reply.placeholder', 'Write your reply...')}
        />
        <Button
          type="button"
          aria-label={t('pages.lawyerWorkplace.reply.send', 'Send')}
          size="icon-sm"
          disabled={sendDisabled || isSending || !value.trim()}
          onClick={handleSend}
          className="bg-primary-300 text-foreground hover:bg-primary-500 active:bg-primary-600 shrink-0 rounded-full disabled:opacity-50"
        >
          <Icons.Sent02 size={20} strokeWidth={1.5} />
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between gap-2 overflow-x-auto px-0.5 [scrollbar-width:none] sm:px-1 [&::-webkit-scrollbar]:hidden">
        <LinkButton
          type="button"
          variant="regular-gray"
          size="xs"
          className="shrink-0 px-2 sm:px-2"
          aria-label={t('pages.lawyerWorkplace.reply.saveDraft', 'Save draft')}
          leftIcon={<Icons.File size={13} strokeWidth={1.5} />}
          disabled={isSavingDraft || !value.trim()}
          onClick={onSaveDraft}
        >
          <span className="hidden sm:inline">
            {isSavingDraft
              ? t('pages.lawyerWorkplace.reply.savingDraft', 'Saving…')
              : t('pages.lawyerWorkplace.reply.saveDraft', 'Save draft')}
          </span>
        </LinkButton>

        <div className="flex shrink-0 items-center gap-0.5">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <LinkButton
                type="button"
                variant="regular-gray"
                size="xs"
                className="shrink-0 px-2 sm:px-2"
                aria-label={t('pages.lawyerWorkplace.reply.attach', 'Attach')}
                leftIcon={<Icon icon={Link01Icon} size={13} strokeWidth={1.5} />}
                rightIcon={
                  <Icons.ArrowDown size={10} strokeWidth={2} className="text-muted-foreground" />
                }
                disabled={isUploadingAttachment || sendDisabled}
              >
                <span className="hidden sm:inline">
                  {isUploadingAttachment
                    ? t('pages.lawyerWorkplace.reply.attaching', 'Attaching…')
                    : t('pages.lawyerWorkplace.reply.attach', 'Attach')}
                </span>
              </LinkButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[240px] p-1.5">
              <DropdownMenuItem
                className="cursor-pointer text-[12px]"
                onSelect={() => fileInputRef.current?.click()}
              >
                {t('pages.lawyerWorkplace.reply.attachFromComputer', 'File from computer')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn(
                  'cursor-pointer text-[12px]',
                  !attachFromClientEnabled && 'text-muted-foreground opacity-60'
                )}
                aria-disabled={!attachFromClientEnabled}
                title={attachFromClientEnabled ? undefined : clientActionsDisabledHint}
                onSelect={(event) => {
                  if (!attachFromClientEnabled) {
                    event.preventDefault()
                    return
                  }
                  onAttachFromClient?.()
                }}
              >
                {t('pages.lawyerWorkplace.reply.attachFromClient', 'Attached file on client')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={cn(
                  'cursor-pointer text-[12px]',
                  !clientActionsEnabled && 'text-muted-foreground opacity-60'
                )}
                aria-disabled={!clientActionsEnabled}
                title={clientActionsDisabledHint}
                onSelect={(event) => {
                  if (!clientActionsEnabled) {
                    event.preventDefault()
                    return
                  }
                  onGenerateDocument?.()
                }}
              >
                {t('pages.lawyerWorkplace.reply.generateDocument', 'Generate document')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <LinkButton
                type="button"
                variant="regular-gray"
                size="xs"
                className="shrink-0 px-2 sm:px-2"
                aria-label={t('pages.lawyerWorkplace.reply.template', 'Template')}
                rightIcon={
                  <Icons.ArrowDown size={10} strokeWidth={2} className="text-muted-foreground" />
                }
                onClick={replyTemplates.length === 0 ? handleTemplateClick : undefined}
              >
                <span className="hidden sm:inline">
                  {t('pages.lawyerWorkplace.reply.template', 'Template')}
                </span>
              </LinkButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-60 min-w-[220px] overflow-y-auto p-1.5"
            >
              {replyTemplates.length === 0 ? (
                <DropdownMenuItem disabled className="text-muted-foreground text-[12px]">
                  {t('pages.lawyerWorkplace.reply.noTemplates', 'No templates available')}
                </DropdownMenuItem>
              ) : (
                replyTemplates.map((template) => (
                  <DropdownMenuItem
                    key={template.id}
                    className="cursor-pointer text-[12px]"
                    onClick={() => onApplyTemplate?.(template.body)}
                  >
                    {template.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
