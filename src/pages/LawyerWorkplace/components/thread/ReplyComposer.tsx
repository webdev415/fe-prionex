import { Attachment01Icon } from '@hugeicons/core-free-icons'
import { useTranslation } from 'react-i18next'
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

export interface ReplyComposerProps {
  fromMailbox: string
  toMailbox: string
  value: string
  onChange: (value: string) => void
  markAsNbuResponse: boolean
  onMarkAsNbuResponseChange: (checked: boolean) => void
}

export function ReplyComposer({
  fromMailbox,
  toMailbox,
  value,
  onChange,
  markAsNbuResponse,
  onMarkAsNbuResponseChange,
}: ReplyComposerProps) {
  const { t } = useTranslation('common')
  const nbuLabel = t('pages.lawyerWorkplace.reply.markNbuResponse', 'Mark as NBU response')
  const nbuShortLabel = t('pages.lawyerWorkplace.reply.markNbuShort', 'NBU')

  return (
    <div className="flex shrink-0 flex-col gap-2 bg-[linear-gradient(180deg,#F2F3F0_0%,#FFF_100%)] px-3 py-2.5 sm:px-5 sm:py-3">
      <div className="flex items-center justify-between gap-2 py-0.5 sm:gap-3 sm:py-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <span className="text-light-700 shrink-0 text-[10px] sm:text-[11px]">
            {t('pages.lawyerWorkplace.reply.replyFrom', 'Reply from')}
          </span>
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            <span className="bg-light-100 text-secondary-900 max-w-[42vw] truncate rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-normal sm:max-w-none sm:text-[10.5px]">
              {fromMailbox}
            </span>
            <span className="text-light-400 inline-flex shrink-0 items-center" aria-hidden="true">
              <Icons.ArrowRight02 size={10} strokeWidth={1.5} />
            </span>
            <span className="text-dark-500 max-w-[42vw] truncate text-[10px] sm:max-w-none sm:text-[11px]">
              {toMailbox}
            </span>
          </div>
        </div>

        <label
          className="text-light-700 flex shrink-0 cursor-pointer items-center gap-1 sm:gap-1.5"
          title={nbuLabel}
        >
          <div
            role="checkbox"
            aria-checked={markAsNbuResponse}
            aria-label={nbuLabel}
            tabIndex={0}
            onClick={() => onMarkAsNbuResponseChange(!markAsNbuResponse)}
            onKeyDown={(e) => e.key === 'Enter' && onMarkAsNbuResponseChange(!markAsNbuResponse)}
            className={cn(
              'flex h-4 w-7 shrink-0 items-center rounded-full px-0.5 transition-colors',
              markAsNbuResponse ? 'bg-secondary-500' : 'bg-gray-300'
            )}
          >
            <div
              className={cn(
                'h-3 w-3 rounded-full bg-white shadow transition-transform',
                markAsNbuResponse ? 'translate-x-3' : 'translate-x-0'
              )}
            />
          </div>
          <span className="text-[10px] sm:hidden">{nbuShortLabel}</span>
          <span className="hidden text-[11.5px] sm:inline">{nbuLabel}</span>
        </label>
      </div>

      <div className="flex flex-row items-end rounded-lg border border-gray-200 bg-white p-2.5 sm:p-3">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="text-dark-500 min-h-[96px] w-full resize-none overflow-y-scroll rounded border-none bg-transparent p-0 text-[13px] shadow-none outline-none [scrollbar-width:none] focus:ring-0 focus:ring-offset-0 sm:min-h-[110px] [&::-webkit-scrollbar]:hidden"
          placeholder={t('pages.lawyerWorkplace.reply.placeholder', 'Write your reply...')}
        />
        <Button
          type="button"
          aria-label={t('pages.lawyerWorkplace.reply.send', 'Send')}
          size="icon-sm"
          className="bg-primary-300 text-dark-500 hover:bg-primary-500 active:bg-primary-600 shrink-0 rounded-full"
        >
          <Icons.Sent02 size={20} strokeWidth={1.5} />
        </Button>
      </div>

      <div className="flex items-center gap-0.5 overflow-x-auto px-0.5 [scrollbar-width:none] sm:justify-between sm:overflow-visible sm:px-1 [&::-webkit-scrollbar]:hidden">
        <LinkButton
          type="button"
          variant="regular-gray"
          size="xs"
          className="shrink-0 px-2 sm:px-2"
          aria-label={t('pages.lawyerWorkplace.reply.reassign', 'Reassign')}
          leftIcon={<Icons.User size={13} strokeWidth={1.5} />}
        >
          <span className="hidden sm:inline">
            {t('pages.lawyerWorkplace.reply.reassign', 'Reassign')}
          </span>
        </LinkButton>
        <LinkButton
          type="button"
          variant="regular-gray"
          size="xs"
          className="shrink-0 px-2 sm:px-2"
          aria-label={t('pages.lawyerWorkplace.reply.saveDraft', 'Save draft')}
          leftIcon={<Icons.File size={13} strokeWidth={1.5} />}
        >
          <span className="hidden sm:inline">
            {t('pages.lawyerWorkplace.reply.saveDraft', 'Save draft')}
          </span>
        </LinkButton>
        <LinkButton
          type="button"
          variant="regular-gray"
          size="xs"
          className="shrink-0 px-2 sm:px-2"
          aria-label={t('pages.lawyerWorkplace.reply.attach', 'Attach')}
          leftIcon={<Icon icon={Attachment01Icon} size={13} strokeWidth={1.5} />}
        >
          <span className="hidden sm:inline">
            {t('pages.lawyerWorkplace.reply.attach', 'Attach')}
          </span>
        </LinkButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <LinkButton
              type="button"
              variant="regular-gray"
              size="xs"
              className="shrink-0 bg-transparent px-2 sm:px-2"
              aria-label={t('pages.lawyerWorkplace.reply.template', 'Template')}
              leftIcon={<Icons.Files02Icon size={13} strokeWidth={1.5} />}
              rightIcon={
                <span className="hidden sm:inline-flex">
                  <Icons.ArrowDown size={11} strokeWidth={2} />
                </span>
              }
            >
              <span className="hidden sm:inline">
                {t('pages.lawyerWorkplace.reply.template', 'Template')}
              </span>
            </LinkButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            <DropdownMenuItem>
              {t('pages.lawyerWorkplace.reply.templates.complaintResponse', 'Complaint response')}
            </DropdownMenuItem>
            <DropdownMenuItem>
              {t('pages.lawyerWorkplace.reply.templates.nbuAcknowledgement', 'NBU acknowledgement')}
            </DropdownMenuItem>
            <DropdownMenuItem>
              {t('pages.lawyerWorkplace.reply.templates.extensionRequest', 'Extension request')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
