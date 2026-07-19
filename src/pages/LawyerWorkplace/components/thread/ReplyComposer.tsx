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
import type {
  EdoType,
  LegalMailbox,
  LegalStagedAttachment,
} from '@/features/lawyerWorkplace/api/types'

const EDO_OPTIONS: { id: EdoType; labelKey: string; fallback: string; badge?: string }[] = [
  {
    id: 'outgoing',
    labelKey: 'pages.lawyerWorkplace.reply.edoOutgoing',
    fallback: 'Outgoing (ВИХ)',
    badge: 'ВИХ',
  },
  {
    id: 'nbu',
    labelKey: 'pages.lawyerWorkplace.reply.edoNbu',
    fallback: 'NBU reply (НБУ)',
    badge: 'НБУ',
  },
  {
    id: 'none',
    labelKey: 'pages.lawyerWorkplace.reply.edoNone',
    fallback: 'Do not register',
  },
]

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
  edoType: EdoType
  onEdoTypeChange: (edoType: EdoType) => void
  onSend: () => void
  replyTemplates?: ReplyComposerTemplate[]
  onApplyTemplate?: (body: string) => void
  stagedAttachments?: LegalStagedAttachment[]
  onSaveDraft?: () => void
  onAttachFiles?: (files: FileList) => void
  onRemoveAttachment?: (attachmentId: string) => void
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
  return (
    <span className="border-light-200 text-dark-500 bg-card inline-flex max-w-[180px] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
      <span className="truncate">{attachment.filename}</span>
      <span className="text-light-600 shrink-0">{formatAttachmentSize(attachment.size_bytes)}</span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(attachment.id)}
          className="text-light-600 hover:text-dark-500 shrink-0"
          aria-label="Remove attachment"
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
  edoType,
  onEdoTypeChange,
  onSend,
  replyTemplates = [],
  onApplyTemplate,
  stagedAttachments = [],
  onSaveDraft,
  onAttachFiles,
  onRemoveAttachment,
  isSavingDraft = false,
  isUploadingAttachment = false,
  isSending = false,
  sendDisabled = false,
}: ReplyComposerProps) {
  const { t } = useTranslation('common')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedMailbox =
    mailboxes.find((mailbox) => mailbox.id === selectedMailboxId) ?? mailboxes[0] ?? null
  const selectedEdo = EDO_OPTIONS.find((option) => option.id === edoType) ?? EDO_OPTIONS[2]!

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
          <span className="text-light-700 shrink-0 text-[10px] sm:text-[11px]">
            {t('pages.lawyerWorkplace.reply.replyFrom', 'Reply from')}
          </span>
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={mailboxes.length === 0}
                  className="bg-light-100 text-secondary-900 flex max-w-[42vw] items-center gap-1 truncate rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-normal transition-colors hover:bg-gray-100 disabled:opacity-50 sm:max-w-none sm:text-[10.5px]"
                >
                  <span className="truncate">{selectedMailbox?.email ?? '—'}</span>
                  <Icons.ArrowDown size={10} strokeWidth={2} className="shrink-0 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px] p-1.5">
                {mailboxes.map((mailbox) => (
                  <DropdownMenuItem
                    key={mailbox.id}
                    className={cn(
                      'cursor-pointer rounded-md px-2.5 py-1.5 text-[12px] focus:bg-gray-50',
                      mailbox.id === selectedMailboxId && 'bg-gray-50 font-medium'
                    )}
                    onClick={() => onMailboxChange(mailbox.id)}
                  >
                    {mailbox.email}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-light-400 inline-flex shrink-0 items-center" aria-hidden="true">
              <Icons.ArrowRight02 size={10} strokeWidth={1.5} />
            </span>
            <span className="text-dark-500 max-w-[42vw] truncate text-[10px] sm:max-w-none sm:text-[11px]">
              {toMailbox}
            </span>
          </div>
        </div>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors sm:text-[11px]',
                edoType !== 'none'
                  ? 'border-secondary-300 bg-secondary-50 text-secondary-800'
                  : 'border-border bg-input text-gray-500 hover:bg-gray-50'
              )}
            >
              {selectedEdo.badge ? (
                <span className="font-semibold">{selectedEdo.badge}</span>
              ) : (
                <Icons.File size={11} strokeWidth={1.5} />
              )}
              <span className="hidden sm:inline">
                {edoType === 'none'
                  ? t('pages.lawyerWorkplace.reply.edoLabel', 'EDO')
                  : t(selectedEdo.labelKey, selectedEdo.fallback)}
              </span>
              <Icons.ArrowDown size={9} strokeWidth={2} className="text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[190px] p-1.5">
            {EDO_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.id}
                className={cn(
                  'cursor-pointer rounded-md px-2.5 py-1.5 text-[12px] focus:bg-gray-50',
                  option.id === edoType && 'bg-gray-50 font-medium'
                )}
                onClick={() => onEdoTypeChange(option.id)}
              >
                <span className="flex items-center gap-2">
                  {option.badge && (
                    <span className="text-secondary-800 bg-secondary-50 rounded px-1 text-[10px] font-bold">
                      {option.badge}
                    </span>
                  )}
                  {t(option.labelKey, option.fallback)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
          className="text-dark-500 min-h-[96px] w-full resize-none overflow-y-scroll rounded border-none bg-transparent p-0 text-[13px] shadow-none outline-none [scrollbar-width:none] focus:ring-0 focus:ring-offset-0 sm:min-h-[110px] [&::-webkit-scrollbar]:hidden"
          placeholder={t('pages.lawyerWorkplace.reply.placeholder', 'Write your reply...')}
        />
        <Button
          type="button"
          aria-label={t('pages.lawyerWorkplace.reply.send', 'Send')}
          size="icon-sm"
          disabled={sendDisabled || isSending || !value.trim()}
          onClick={handleSend}
          className="bg-primary-300 text-dark-500 hover:bg-primary-500 active:bg-primary-600 shrink-0 rounded-full disabled:opacity-50"
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
          <LinkButton
            type="button"
            variant="regular-gray"
            size="xs"
            className="shrink-0 px-2 sm:px-2"
            aria-label={t('pages.lawyerWorkplace.reply.attach', 'Attach')}
            leftIcon={<Icon icon={Link01Icon} size={13} strokeWidth={1.5} />}
            disabled={isUploadingAttachment || sendDisabled}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="hidden sm:inline">
              {isUploadingAttachment
                ? t('pages.lawyerWorkplace.reply.attaching', 'Attaching…')
                : t('pages.lawyerWorkplace.reply.attach', 'Attach')}
            </span>
          </LinkButton>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <LinkButton
                type="button"
                variant="regular-gray"
                size="xs"
                className="shrink-0 px-2 sm:px-2"
                aria-label={t('pages.lawyerWorkplace.reply.template', 'Template')}
                rightIcon={<Icons.ArrowDown size={10} strokeWidth={2} className="text-gray-400" />}
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
                <DropdownMenuItem disabled className="text-light-600 text-[12px]">
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
