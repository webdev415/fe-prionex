import { useState } from 'react'
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

const MOCK_MAILBOXES = [
  'legal@prionex.ua',
  'court@prionex.ua',
  'nbu@prionex.ua',
  'accounting@prionex.ua',
]

type EdoType = 'outgoing' | 'nbu' | 'none'

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

export interface ReplyComposerProps {
  fromMailbox: string
  toMailbox: string
  value: string
  onChange: (value: string) => void
}

export function ReplyComposer({ fromMailbox, toMailbox, value, onChange }: ReplyComposerProps) {
  const { t } = useTranslation('common')
  const [selectedMailbox, setSelectedMailbox] = useState(fromMailbox)
  const [edoType, setEdoType] = useState<EdoType>('none')

  const selectedEdo = EDO_OPTIONS.find((o) => o.id === edoType) ?? EDO_OPTIONS[2]!

  return (
    <div className="flex shrink-0 flex-col gap-2 bg-[linear-gradient(180deg,#F2F3F0_0%,#FFF_100%)] px-3 py-2.5 sm:px-5 sm:py-3">
      {/* From / To row */}
      <div className="flex items-center justify-between gap-2 py-0.5 sm:gap-3 sm:py-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <span className="text-light-700 shrink-0 text-[10px] sm:text-[11px]">
            {t('pages.lawyerWorkplace.reply.replyFrom', 'Reply from')}
          </span>
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            {/* Interactive mailbox selector */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="bg-light-100 text-secondary-900 flex max-w-[42vw] items-center gap-1 truncate rounded-full border border-gray-200 px-2 py-0.5 text-[10px] font-normal transition-colors hover:bg-gray-100 sm:max-w-none sm:text-[10.5px]"
                >
                  <span className="truncate">{selectedMailbox}</span>
                  <Icons.ArrowDown size={10} strokeWidth={2} className="shrink-0 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px] p-1.5">
                {MOCK_MAILBOXES.map((mb) => (
                  <DropdownMenuItem
                    key={mb}
                    className={cn(
                      'cursor-pointer rounded-md px-2.5 py-1.5 text-[12px] focus:bg-gray-50',
                      mb === selectedMailbox && 'bg-gray-50 font-medium'
                    )}
                    onClick={() => setSelectedMailbox(mb)}
                  >
                    {mb}
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

        {/* EDO type selector */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors sm:text-[11px]',
                edoType !== 'none'
                  ? 'border-secondary-300 bg-secondary-50 text-secondary-800'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
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
            {EDO_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.id}
                className={cn(
                  'cursor-pointer rounded-md px-2.5 py-1.5 text-[12px] focus:bg-gray-50',
                  opt.id === edoType && 'bg-gray-50 font-medium'
                )}
                onClick={() => setEdoType(opt.id)}
              >
                <span className="flex items-center gap-2">
                  {opt.badge && (
                    <span className="text-secondary-800 bg-secondary-50 rounded px-1 text-[10px] font-bold">
                      {opt.badge}
                    </span>
                  )}
                  {t(opt.labelKey, opt.fallback)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Textarea + send */}
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

      {/* Toolbar buttons */}
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
